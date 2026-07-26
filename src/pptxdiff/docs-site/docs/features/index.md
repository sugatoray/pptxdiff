# Feature walkthrough

PptxDiff's feature set breaks down into a few layers, each covered in its own page:

| Area | What it covers |
|---|---|
| [Rendering fidelity](rendering.md) | How slides are parsed and drawn — real render vs. schematic fallback |
| [Diff engine](diff-engine.md) | Everything diffed *within* one slide pair — text, formatting, images, tables, charts, notes, and more |
| [Deck-level comparison](deck-comparison.md) | Aligning two whole decks — added / removed / moved slides |
| [Duplicate detection](duplicate-detection.md) | Finding near-identical slides, within a deck and across decks |
| [Reviewer workflow](reviewer-workflow.md) | Reviewers, approvals, comments, and the history log |
| [Batch mode](batch-mode.md) | Comparing many deck pairs in one pass |
| [Three-way merge](merge.md) | Picking winners per diff and exporting a merged `.pptx` |
| [Exports & live push](exports.md) | PDF, HTML, JSON, CSV, Markdown, Notion, Confluence, Slack |
| [UI, shortcuts & themes](ui-shortcuts.md) | Dark mode, keyboard shortcuts, drag-and-drop |
| [Self-tests](self-tests.md) | The in-browser regression suite |

If you haven't opened the app yet, [get started](../getting-started.md) first — every page below assumes you have a Before/After pair loaded (the built-in sample deck works fine for following along).
