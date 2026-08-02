"use strict";

// Pure functions operating on the JSON report shape buildJsonReport()
// produces in the browser app (index.html) — the same shape
// lib/automation.js's diffDecks() returns. Kept dependency-free (no DOM,
// no browser) so bin/pptxdiff-cli.js's exit-code/formatting logic is
// directly unit-testable without a real browser.

// Pure: parses a slide-pair report row's `key` field
// (pairKey(aIdx,bIdx) = 'a'+aIdx+':b'+bIdx, using 'x' for a null side —
// see index.html's pairKey()). The exported report doesn't carry an
// explicit added/removed flag, so this is how isSlideChanged() below
// recovers "this side doesn't exist" from the same key the app itself
// keys decisions/comments by.
function slideKeyParts(key) {
  const m = /^a(x|\d+):b(x|\d+)$/.exec(key || "");
  if (!m) return { aIdx: null, bIdx: null, valid: false };
  return {
    aIdx: m[1] === "x" ? null : Number(m[1]),
    bIdx: m[2] === "x" ? null : Number(m[2]),
    valid: true,
  };
}

// Pure: mirrors the app's own definition of "this slide pair changed"
// (index.html:3897 — `const changed = !pa || !pb || diffs.length > 0`).
// An added or removed slide has nothing to diff against, so its own
// `differences` array is empty even though it's obviously not identical —
// checking `differences.length` alone would silently miss it.
function isSlideChanged(slide) {
  const { aIdx, bIdx } = slideKeyParts(slide.key);
  return aIdx === null || bIdx === null || (Array.isArray(slide.differences) && slide.differences.length > 0);
}

// Pure: the CLI/API's canonical "did these two decks differ at all"
// answer — drives the diff(1)-style exit code (0 = no differences,
// 1 = differences found). True if any slide pair changed (per
// isSlideChanged) OR there's a presentation-level difference (embedded
// fonts, etc. — the one category buildJsonReport() tracks outside the
// per-slide list).
function hasDifferences(report) {
  if (report.presentationDiffs && report.presentationDiffs.length > 0) return true;
  return (report.slides || []).some(isSlideChanged);
}

function countChangedSlides(report) {
  return (report.slides || []).filter(isSlideChanged).length;
}

function formatBeforeAfter(before, after) {
  const b = Array.isArray(before) ? before.join(", ") : before;
  const a = Array.isArray(after) ? after.join(", ") : after;
  return `${b} -> ${a}`;
}

// Pure: the CLI's default human-readable stdout output for `pptxdiff-cli
// diff` (the --json flag bypasses this and prints the report object
// directly instead).
function formatDiffSummary(report) {
  const lines = [`${report.deckBefore}  vs  ${report.deckAfter}`];
  if (report.contentChecksum) {
    lines.push(`  content checksum (before): ${report.contentChecksum.before}`);
    lines.push(`  content checksum (after):  ${report.contentChecksum.after}`);
  }
  lines.push("");

  if (!hasDifferences(report)) {
    lines.push("No differences found.");
    return lines.join("\n");
  }

  const changed = countChangedSlides(report);
  const total = (report.slides || []).length;
  lines.push(`${changed} of ${total} slide pair(s) differ:`);
  for (const slide of report.slides || []) {
    if (!isSlideChanged(slide)) continue;
    lines.push(`  - ${slide.label}`);
    for (const d of slide.differences || []) {
      lines.push(`      ${d.type}: ${d.label} — ${formatBeforeAfter(d.before, d.after)}`);
    }
  }

  if (report.presentationDiffs && report.presentationDiffs.length) {
    lines.push("");
    lines.push("Presentation-level differences:");
    for (const d of report.presentationDiffs) {
      lines.push(`  - ${d.type}: ${formatBeforeAfter(d.before, d.after)}`);
    }
  }

  return lines.join("\n");
}

module.exports = { slideKeyParts, isSlideChanged, hasDifferences, countChangedSlides, formatDiffSummary };
