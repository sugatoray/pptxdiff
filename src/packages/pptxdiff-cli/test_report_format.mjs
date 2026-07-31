#!/usr/bin/env node
// Red/Green regression check for lib/format.js's pure report-summary
// helpers. These operate on the SAME JSON report shape buildJsonReport()
// produces in the browser (see index.html), which does not carry an
// explicit added/removed flag per slide — only the `key` field
// (pairKey(aIdx,bIdx), using 'x' for a null side). So "is this slide pair
// actually different" has to mirror the app's OWN definition
// (`!pa || !pb || diffs.length > 0` — see index.html:3897) by parsing that
// key, not just checking `differences.length`, which alone would silently
// miss every added/removed slide (an added slide has nothing to diff
// against, so its `differences` array is empty even though the slide is
// obviously not identical). This is exactly the kind of thing a CLI
// exit-code contract (0 = no diffs, 1 = diffs found) must get right.
//
// Run: node src/packages/pptxdiff-cli/test_report_format.mjs

import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const { slideKeyParts, isSlideChanged, hasDifferences, countChangedSlides, formatDiffSummary } =
  await import(`file://${path.join(DIR, "lib", "format.js")}`);

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
}

// --- slideKeyParts ---
assert("parses a matched pair", JSON.stringify(slideKeyParts("a0:b0")) === JSON.stringify({ aIdx: 0, bIdx: 0, valid: true }));
assert("parses a matched pair with multi-digit indices", JSON.stringify(slideKeyParts("a12:b7")) === JSON.stringify({ aIdx: 12, bIdx: 7, valid: true }));
assert("parses an added-in-After slide (no Before side)", JSON.stringify(slideKeyParts("ax:b2")) === JSON.stringify({ aIdx: null, bIdx: 2, valid: true }));
assert("parses a removed-from-After slide (no After side)", JSON.stringify(slideKeyParts("a3:bx")) === JSON.stringify({ aIdx: 3, bIdx: null, valid: true }));
assert("marks garbage input invalid rather than throwing", slideKeyParts("not-a-key").valid === false);
assert("marks undefined input invalid rather than throwing", slideKeyParts(undefined).valid === false);

// --- isSlideChanged ---
assert(
  "matched pair with zero differences is NOT changed",
  isSlideChanged({ key: "a0:b0", differences: [] }) === false
);
assert(
  "matched pair with real differences IS changed",
  isSlideChanged({ key: "a0:b0", differences: [{ type: "TEXT", label: "x", before: "a", after: "b" }] }) === true
);
assert(
  "an added slide (ax:bN) IS changed even with an empty differences array",
  isSlideChanged({ key: "ax:b2", differences: [] }) === true
);
assert(
  "a removed slide (aN:bx) IS changed even with an empty differences array",
  isSlideChanged({ key: "a2:bx", differences: [] }) === true
);

// --- hasDifferences / countChangedSlides ---
const identicalReport = {
  deckBefore: "a.pptx", deckAfter: "b.pptx", presentationDiffs: [],
  slides: [{ key: "a0:b0", label: "Slide 1", differences: [] }, { key: "a1:b1", label: "Slide 2", differences: [] }],
};
const changedReport = {
  deckBefore: "a.pptx", deckAfter: "b.pptx", presentationDiffs: [],
  slides: [
    { key: "a0:b0", label: "Slide 1", differences: [] },
    { key: "a1:b1", label: "Slide 2", differences: [{ type: "TEXT", label: "Title", before: "Q3", after: "Q4" }] },
    { key: "ax:b2", label: "Slide 3 (added in After)", differences: [] },
  ],
};
const presentationOnlyReport = {
  deckBefore: "a.pptx", deckAfter: "b.pptx",
  presentationDiffs: [{ type: "Embedded fonts", before: ["Sans"], after: ["Sans", "Mono"] }],
  slides: [{ key: "a0:b0", label: "Slide 1", differences: [] }],
};

assert("hasDifferences is false when every slide is identical and no presentation diffs", hasDifferences(identicalReport) === false);
assert("hasDifferences is true when at least one slide changed", hasDifferences(changedReport) === true);
assert("hasDifferences is true for presentation-level-only diffs (no slide diffs)", hasDifferences(presentationOnlyReport) === true);
assert("countChangedSlides counts both a real diff and an added slide", countChangedSlides(changedReport) === 2);
assert("countChangedSlides is 0 for an all-identical report", countChangedSlides(identicalReport) === 0);

// --- formatDiffSummary ---
const noDiffSummary = formatDiffSummary(identicalReport);
assert("no-diff summary says so in plain text", /no differences/i.test(noDiffSummary));
assert("no-diff summary still names both decks", noDiffSummary.includes("a.pptx") && noDiffSummary.includes("b.pptx"));

const diffSummary = formatDiffSummary(changedReport);
assert("diff summary lists the changed slide's label", diffSummary.includes("Slide 2"));
assert("diff summary lists the added slide's label", diffSummary.includes("Slide 3 (added in After)"));
assert("diff summary does NOT list the identical slide", !diffSummary.includes("Slide 1"));
assert("diff summary shows the before/after diff detail", diffSummary.includes("Q3") && diffSummary.includes("Q4"));

const presSummary = formatDiffSummary(presentationOnlyReport);
assert("presentation-only summary mentions the presentation-level diff type", presSummary.includes("Embedded fonts"));

console.log(`report-format check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All report-format checks passed (GREEN).");
}
