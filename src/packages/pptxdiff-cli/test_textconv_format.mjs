#!/usr/bin/env node
// Red/Green regression check for lib/textconv.js's pure formatDeckText().
//
// Context: a git `textconv` driver needs ONE deck's plain-text content (so
// git's own line-based diff can show something meaningful for `git diff`/
// `git log -p` on a `.pptx`), not a diff between two decks — the existing
// diffDecks()/buildJsonReport() shape only ever reports what CHANGED
// between two sides, so it structurally can't answer "what does this one
// slide say." formatDeckText() takes the per-slide shape text + notes
// already extracted by lib/automation.js's extractDeckText() (which reuses
// the app's own real `shapeText()` method via the live component instance
// — see that file for why) and renders the final deterministic text.
//
// Run: node src/packages/pptxdiff-cli/test_textconv_format.mjs

import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const { formatDeckText } = await import(`file://${path.join(DIR, "lib", "textconv.js")}`);

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
}

assert("empty deck (no slides) formats to an empty string", formatDeckText([]) === "");
assert("empty/null input formats to an empty string, not a throw", formatDeckText(null) === "" && formatDeckText(undefined) === "");

assert(
  "a single slide with one shape formats with a Slide header and the text",
  formatDeckText([{ index: 1, shapeTexts: ["Q3 Business Review"], notes: "" }]) === "Slide 1\nQ3 Business Review\n"
);

assert(
  "multiple shape texts on one slide each get their own line",
  formatDeckText([{ index: 1, shapeTexts: ["Title", "Body text here"], notes: "" }]) === "Slide 1\nTitle\nBody text here\n"
);

assert(
  "blank/whitespace-only shape texts are filtered out, not rendered as empty lines",
  formatDeckText([{ index: 1, shapeTexts: ["Title", "   ", "", "Body"], notes: "" }]) === "Slide 1\nTitle\nBody\n"
);

assert(
  "shape text is trimmed",
  formatDeckText([{ index: 1, shapeTexts: ["  Title  "], notes: "" }]) === "Slide 1\nTitle\n"
);

assert(
  "non-empty notes are appended with a Notes: prefix, trimmed",
  formatDeckText([{ index: 1, shapeTexts: ["Title"], notes: "  speaker notes here  " }]) === "Slide 1\nTitle\nNotes: speaker notes here\n"
);

assert(
  "whitespace-only notes are omitted entirely, not rendered as an empty 'Notes:' line",
  formatDeckText([{ index: 1, shapeTexts: ["Title"], notes: "   " }]) === "Slide 1\nTitle\n"
);

assert(
  "a slide with zero non-empty shape texts still renders its header",
  formatDeckText([{ index: 1, shapeTexts: [], notes: "" }]) === "Slide 1\n"
);

assert(
  "multiple slides are separated by a blank line",
  formatDeckText([
    { index: 1, shapeTexts: ["First"], notes: "" },
    { index: 2, shapeTexts: ["Second"], notes: "" },
  ]) === "Slide 1\nFirst\n\nSlide 2\nSecond\n"
);

console.log(`textconv-format check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All textconv-format checks passed (GREEN).");
}
