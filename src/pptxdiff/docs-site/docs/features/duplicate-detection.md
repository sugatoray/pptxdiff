# Duplicate detection

Beyond diffing matched pairs, PptxDiff looks for slides that closely resemble *other* slides — a common source of deck bloat and reviewer confusion.

## Same-deck duplicates

`findDuplicateSlides` flags near-identical slides **within one deck** (> 92% similarity) — surfaced as a note panel. This catches the classic "copy-pasted this slide and forgot to remove the original" case.

## Cross-deck duplicates

`findCrossDeckDuplicates(slidesA, slidesB, alignment, threshold, maxPairs, force)` flags a Before slide that closely resembles a **different, unaligned** After slide — i.e. content that moved somewhere else in the deck and reappeared under a different heading, distinct from a straightforward [MOVED](deck-comparison.md) match. Already-aligned pairs are excluded, so this only surfaces genuinely ambiguous overlaps.

It returns `{pairs, skipped, totalComparisons}` and supports:

- **Sensitivity** — a slider (0.70–0.99) controlling the similarity threshold for what counts as "near."
- **Performance cap** — a `maxPairs` limit (default 6000 comparisons); past it, detection returns `{skipped: true, totalComparisons}` instead of scanning, with a "Run anyway" override in the UI for large decks.
- **Per-pair ignore list** — a permanent "Ignore" button per note dismisses one specific pair (`ignoredCrossDupKeys`) without affecting the sensitivity threshold for everything else.
- **Section awareness** — each note names the section (if any) each side's slide belongs to.
- **Batch mode** — cross-deck duplicate detection also runs per pair in [Batch mode](batch-mode.md), appending a "· N cross-deck duplicate(s)" note to that row's summary.

## Interaction with merge

The [three-way merge](merge.md) preview has a "Skip Before-only slides that closely resemble an After slide elsewhere" checkbox. When enabled, a dropped Before-only slide with an (unignored) cross-deck duplicate shows "Skipped — duplicate of After slide N" instead of "Dropped," and is excluded from the merged `.pptx` export — avoiding a merged deck that accidentally keeps both the original and its near-duplicate cousin.
