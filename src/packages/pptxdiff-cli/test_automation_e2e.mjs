#!/usr/bin/env node
// Red/Green end-to-end check for lib/automation.js.
//
// This is the impure, browser-driving half of Phase 1 (see
// docs/.scrolls/CLI_API_DESIGN.md §6) — it genuinely launches a headless
// browser against a real local copy of the pptxdiff app and drives it
// exactly the way a human would (upload two files via the real file
// inputs, wait for the real diff engine, click the real "Export → JSON
// report" button). Per this project's own established practice for impure
// DOM/network code (see WISDOM.md), correctness here is proven end-to-end
// against the real app and the repo's own Red/Green sample fixtures
// (docs/assets/sample_before.pptx / sample_after.pptx — SPEC.md §22),
// not by mocking the browser away.
//
// Needs a real Chrome/Chromium/Edge — set PPTXDIFF_CHROME_PATH if none of
// lib/browser.js's well-known install locations apply and playwright-core
// has no managed browser of its own available.
//
// Run: node src/packages/pptxdiff-cli/test_automation_e2e.mjs

import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(DIR, "..", "..", "..");
const SAMPLE_BEFORE = path.join(REPO_ROOT, "docs", "assets", "sample_before.pptx");
const SAMPLE_AFTER = path.join(REPO_ROOT, "docs", "assets", "sample_after.pptx");

const automation = await import(`file://${path.join(DIR, "lib", "automation.js")}`);
const { diffDecks, computeChecksum, extractDeckText, BrowserUnavailableError, PptxParseError } = automation.default || automation;
const { formatDeckText } = await import(`file://${path.join(DIR, "lib", "textconv.js")}`);

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
  else console.log(`  ok — ${label}`);
}

console.log("1. diffDecks(sample_before, sample_after) — real differences expected");
const diffReport = await diffDecks(SAMPLE_BEFORE, SAMPLE_AFTER);
assert("report has deckBefore/deckAfter names", diffReport.deckBefore === "sample_before.pptx" && diffReport.deckAfter === "sample_after.pptx");
assert("report has at least one slide", Array.isArray(diffReport.slides) && diffReport.slides.length > 0);
const changedSlides = diffReport.slides.filter((s) => s.differences && s.differences.length > 0);
assert("at least one slide has real differences (Red fixture)", changedSlides.length > 0);
assert("content checksum before/after are both 64-hex-char SHA-256 strings", /^[0-9a-f]{64}$/i.test(diffReport.contentChecksum.before) && /^[0-9a-f]{64}$/i.test(diffReport.contentChecksum.after));
assert("content checksums differ (files genuinely differ)", diffReport.contentChecksum.before !== diffReport.contentChecksum.after);

console.log("2. diffDecks(sample_before, sample_before) — identical file both sides, zero real differences expected");
const identicalReport = await diffDecks(SAMPLE_BEFORE, SAMPLE_BEFORE);
const identicalChanged = identicalReport.slides.filter((s) => s.differences && s.differences.length > 0);
assert("zero slides report differences when before===after", identicalChanged.length === 0);
assert("content checksums are identical when before===after", identicalReport.contentChecksum.before === identicalReport.contentChecksum.after);

console.log("3. computeChecksum(sample_before) agrees with diffDecks' own checksum for the same file");
const checksumResult = await computeChecksum(SAMPLE_BEFORE);
assert("computeChecksum returns a well-formed SHA-256 hash", /^[0-9a-f]{64}$/i.test(checksumResult.hash));
assert(
  "computeChecksum(sample_before) matches diffDecks' contentChecksum.before for the same file (two independent code paths agree)",
  checksumResult.hash === identicalReport.contentChecksum.before
);

console.log("4. computeChecksum on an unparseable file surfaces a clear PptxParseError, not a timeout");
let parseErrorCaught = null;
try {
  await computeChecksum({ name: "not-a-real-pptx.pptx", buffer: Buffer.from("this is not a zip file at all") }, { timeoutMs: 10000 });
} catch (e) {
  parseErrorCaught = e;
}
assert("throws for garbage input instead of hanging/timing out", parseErrorCaught !== null);
assert("thrown error is a PptxParseError with a real message", parseErrorCaught instanceof PptxParseError && !!parseErrorCaught.message);

console.log("5. an unresolvable browser executable surfaces a clear BrowserUnavailableError");
let browserErrorCaught = null;
try {
  await computeChecksum(SAMPLE_BEFORE, { env: { PPTXDIFF_CHROME_PATH: "/definitely/does/not/exist/chrome" } });
} catch (e) {
  browserErrorCaught = e;
}
assert("throws BrowserUnavailableError for a bad executable path", browserErrorCaught instanceof BrowserUnavailableError);
assert("error message points at the fix (PPTXDIFF_CHROME_PATH / playwright install)", /PPTXDIFF_CHROME_PATH|playwright install/.test(browserErrorCaught && browserErrorCaught.message || ""));

console.log("6. extractDeckText(sample_before) — real per-slide text, for a git textconv driver");
const slides = await extractDeckText(SAMPLE_BEFORE);
assert("extracts the real slide count", slides.length === 6);
assert("first slide's title shape text is real, not empty", slides[0].shapeTexts.some((t) => t.includes("Q3 Business Review")));
assert("a slide with real speaker notes has them extracted", slides.some((s) => s.notes.includes("Walk through the roadmap")));
assert("formatDeckText renders it into deterministic, non-empty text", formatDeckText(slides).includes("Q3 Business Review"));
assert("re-extracting the same file twice produces byte-identical text (deterministic)", formatDeckText(await extractDeckText(SAMPLE_BEFORE)) === formatDeckText(slides));

console.log(`automation-e2e check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All automation-e2e checks passed (GREEN).");
}
