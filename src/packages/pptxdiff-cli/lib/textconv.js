"use strict";

// Pure: renders one deck's already-extracted per-slide text
// (lib/automation.js's extractDeckText() — real shape text + speaker notes
// pulled from the app's own live parsed state, no reimplementation) into a
// deterministic, git-textconv-friendly plain-text stream. Deliberately not
// a diff — a git textconv driver needs ONE file's comparable text
// representation so git's own line-based diff can show something
// meaningful, not pptxdiff's own semantic diff (which needs two decks).
function formatDeckText(slides) {
  if (!slides || !slides.length) return "";
  return slides
    .map((s) => {
      const lines = [`Slide ${s.index}`];
      for (const t of s.shapeTexts || []) {
        const trimmed = (t || "").trim();
        if (trimmed) lines.push(trimmed);
      }
      const notes = (s.notes || "").trim();
      if (notes) lines.push(`Notes: ${notes}`);
      return lines.join("\n");
    })
    .join("\n\n") + "\n";
}

module.exports = { formatDeckText };
