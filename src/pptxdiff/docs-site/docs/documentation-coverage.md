---
title: Documentation Coverage
render_macros: true
coverage_summary:
  generated_at: '2026-07-26T21:39:20Z'
  totals:
    overall:
      items: 33
      complete: 33
      partial: 0
      missing: 0
    feature:
      items: 21
      complete: 21
      partial: 0
      missing: 0
    limitation:
      items: 12
      complete: 12
      partial: 0
      missing: 0
  items:
  - id: accessibility
    kind: feature
    title: Accessibility (aria-labels, screen-reader-friendly toasts)
    quality: complete
    locations:
    - page: features/ui-shortcuts.md
      anchor: accessibility
  - id: batch-mode
    kind: feature
    title: Batch mode (multi-pair upload, pairing, reordering)
    quality: complete
    locations:
    - page: features/batch-mode.md
      anchor: null
  - id: dark-mode
    kind: feature
    title: Dark / light mode
    quality: complete
    locations:
    - page: features/ui-shortcuts.md
      anchor: dark-mode
  - id: deck-level-comparison
    kind: feature
    title: Deck-level comparison (alignment, added/removed/moved slides)
    quality: complete
    locations:
    - page: features/deck-comparison.md
      anchor: null
    - page: index.md
      anchor: see-it-in-action
  - id: diff-engine
    kind: feature
    title: Diff engine (per-slide-pair property diffing)
    quality: complete
    locations:
    - page: features/diff-engine.md
      anchor: null
    - page: index.md
      anchor: null
  - id: duplicate-detection
    kind: feature
    title: Duplicate detection (same-deck and cross-deck)
    quality: complete
    locations:
    - page: features/duplicate-detection.md
      anchor: null
  - id: exports
    kind: feature
    title: Exports (PDF/HTML/JSON/CSV/Markdown/Notion/Confluence)
    quality: complete
    locations:
    - page: features/exports.md
      anchor: null
  - id: keyboard-shortcuts
    kind: feature
    title: Keyboard shortcuts
    quality: complete
    locations:
    - page: features/ui-shortcuts.md
      anchor: keyboard-shortcuts
  - id: lite-mode
    kind: feature
    title: 'PPTXDIFF_LITE_MODE: env var + ?lite=1 query param'
    quality: complete
    locations:
    - page: architecture.md
      anchor: runtime-dependencies-vendored-locally
    - page: cli.md
      anchor: lite-mode-cdn-sourcing
    - page: features/ui-shortcuts.md
      anchor: offline-mode
  - id: live-push
    kind: feature
    title: Live push to Slack/Notion/Confluence
    quality: complete
    locations:
    - page: features/exports.md
      anchor: live-push
  - id: npm-cli-packaging
    kind: feature
    title: npm CLI (bin/cli.js)
    quality: complete
    locations:
    - page: architecture.md
      anchor: packaging-layers
    - page: cli.md
      anchor: null
    - page: getting-started.md
      anchor: null
  - id: offline-capability
    kind: feature
    title: Offline capability (vendored React/ReactDOM/Babel/JSZip/pptx-renderer/fonts)
    quality: complete
    locations:
    - page: architecture.md
      anchor: runtime-dependencies-vendored-locally
    - page: getting-started.md
      anchor: requirements
    - page: index.md
      anchor: null
  - id: offline-mode-toggle
    kind: feature
    title: In-app "Offline Mode" corner toggle
    quality: complete
    locations:
    - page: cli.md
      anchor: lite-mode-cdn-sourcing
    - page: features/ui-shortcuts.md
      anchor: offline-mode
  - id: rendering-fidelity
    kind: feature
    title: Rendering fidelity (Rendered vs. Schematic)
    quality: complete
    locations:
    - page: features/rendering.md
      anchor: null
    - page: index.md
      anchor: null
  - id: reviewer-workflow
    kind: feature
    title: Reviewer workflow (reviewers, approvals, comments, history)
    quality: complete
    locations:
    - page: features/reviewer-workflow.md
      anchor: null
    - page: index.md
      anchor: null
  - id: self-tests
    kind: feature
    title: In-browser self-test suite
    quality: complete
    locations:
    - page: architecture.md
      anchor: testing-philosophy
    - page: features/self-tests.md
      anchor: null
  - id: static-sample-fixtures
    kind: feature
    title: On-disk sample .pptx fixtures (gen-sample-pptx.mjs)
    quality: complete
    locations:
    - page: getting-started.md
      anchor: try-it-with-the-bundled-sample-files
  - id: three-way-merge
    kind: feature
    title: Three-way merge (per-diff picks, beta .pptx export)
    quality: complete
    locations:
    - page: features/merge.md
      anchor: null
  - id: views
    kind: feature
    title: Single pair / All pairs / Batch views
    quality: complete
    locations:
    - page: features/deck-comparison.md
      anchor: views
  - id: vscode-extension
    kind: feature
    title: VS Code extension
    quality: complete
    locations:
    - page: architecture.md
      anchor: packaging-layers
    - page: vscode-extension.md
      anchor: null
  - id: word-level-diff
    kind: feature
    title: Word-level (LCS) text diffing
    quality: complete
    locations:
    - page: features/diff-engine.md
      anchor: word-level-diffing
  - id: accessibility-limitations
    kind: limitation
    title: Accessibility limitations (English-only UI, no full keyboard-nav audit)
    quality: complete
    locations:
    - page: limitations.md
      anchor: null
  - id: batch-limitations
    kind: limitation
    title: Batch mode limitations (untuned filename-similarity threshold)
    quality: complete
    locations:
    - page: limitations.md
      anchor: null
  - id: deck-comparison-limitations
    kind: limitation
    title: Deck-level comparison limitations (fixed/untuned alignment thresholds)
    quality: complete
    locations:
    - page: limitations.md
      anchor: null
  - id: diff-engine-limitations
    kind: limitation
    title: Diff engine limitations (partial theme-color map, table-diff cap, no section/OLE/3D
      diff)
    quality: complete
    locations:
    - page: limitations.md
      anchor: null
  - id: exports-limitations
    kind: limitation
    title: 'Export limitations (shareable link is a data: URL, Notion/Confluence live
      push is CORS-limited)'
    quality: complete
    locations:
    - page: features/exports.md
      anchor: sharing
    - page: limitations.md
      anchor: null
  - id: lite-mode-limitations
    kind: limitation
    title: Lite mode is all 5 dependencies at once, no per-dependency mixing
    quality: complete
    locations:
    - page: limitations.md
      anchor: null
  - id: offline-capability-limitations
    kind: limitation
    title: Offline-capability limitations (pdfjs-dist unvendored, latin-only font
      subset)
    quality: complete
    locations:
    - page: limitations.md
      anchor: null
  - id: packaging-limitations
    kind: limitation
    title: Packaging limitations (opens a browser tab, not a native window)
    quality: complete
    locations:
    - page: limitations.md
      anchor: null
  - id: rendering-limitations
    kind: limitation
    title: Rendering fidelity limitations (schematic fallback, non-pixel-perfect master/layout)
    quality: complete
    locations:
    - page: features/rendering.md
      anchor: known-rendering-limitations
    - page: limitations.md
      anchor: null
  - id: reviewer-workflow-limitations
    kind: limitation
    title: Reviewer workflow limitations (merge is planning-scope, review state is
      local)
    quality: complete
    locations:
    - page: features/merge.md
      anchor: why-not-a-full-ooxml-round-trip
    - page: features/reviewer-workflow.md
      anchor: persistence
    - page: limitations.md
      anchor: null
  - id: testing-fixtures-limitations
    kind: limitation
    title: On-disk sample fixture gaps (no SmartArt/transitions/embedded-fonts/real-media)
    quality: complete
    locations:
    - page: limitations.md
      anchor: null
  - id: transitions-limitations
    kind: limitation
    title: Transition preview is a simplified crossfade, not per-type accurate
    quality: complete
    locations:
    - page: features/rendering.md
      anchor: known-rendering-limitations
    - page: limitations.md
      anchor: null
---
# Documentation Coverage — Features & Limitations

Programmatically generated from every page's own `doc_coverage:` front
matter, cross-referenced against `scripts/coverage_registry.yml`. Run
`uv run src/pptxdiff/docs-site/scripts/sync_doc_coverage.py --write` to
regenerate after adding or changing coverage on any page; `--check` verifies
this page is still in sync (see the script's own docstring for exactly what
that checks).

{{ render_coverage_summary() }}

## Features

{{ render_coverage_table(kind="feature") }}

## Limitations

{{ render_coverage_table(kind="limitation") }}
