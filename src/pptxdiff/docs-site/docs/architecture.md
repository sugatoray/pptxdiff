# Architecture

## One file, on purpose

The entire application — UI, diff engine, and OOXML parsing — lives in a single self-contained file: `src/pptxdiff/index.html` (template + logic). This is a deliberate constraint, not an accident of growth:

- **Zero build step.** Clone the repo, open the file, done. No bundler, no transpile step, no `node_modules` needed to *run* it.
- **Zero server-side component.** Everything — parsing, rendering, diffing, exporting — happens in the browser, against files that never leave your machine.
- **Trivially distributable.** The same file is what `npx pptxdiff`, the global npm install, the VS Code extension, and a plain `git clone` + double-click all ultimately serve. There's exactly one artifact to keep correct.

`support.js` is the runtime the app is authored against — pinned intentionally, not casually upgraded — and `sample-pptx.js` is a plain ES module that builds the in-browser sample/test-fixture `.pptx` files used by "Reset to sample" and the self-test suite.

## No backend, by design

There is no server component beyond the CLI's static file server (see [CLI reference](cli.md)), which serves files unchanged and contains no application logic. This shapes several features directly:

- **Exports are files or best-effort direct network calls from the browser**, never routed through a backend you'd have to trust or host — see [Exports & live push](features/exports.md) for exactly which services this makes reliable (Slack) vs. CORS-limited (Notion, Confluence).
- **"Shareable link" is a self-contained `data:` URL**, not a hosted short link — there's no server to host one on.
- **Review state lives in `localStorage`**, not a shared database — a review session is local to one browser unless you explicitly export/import a JSON report.

## Runtime dependencies, loaded from CDNs

The app loads React, ReactDOM, Babel-standalone, [`@aiden0z/pptx-renderer`](https://www.npmjs.com/package/@aiden0z/pptx-renderer), JSZip, and fonts from CDNs (unpkg, esm.sh, cdnjs, Google Fonts) at runtime. This is a deliberate trade-off: it keeps the shipped file small and dependency-free to *distribute*, at the cost of requiring internet access to *run* — even for the fully offline `.pptx` files you're comparing. Vendoring these for offline use was considered and deliberately deferred (see `docs/.scrolls/GAP_ANALYSIS.md` in the repository for the full reasoning).

## Packaging layers

```text
src/pptxdiff/index.html  (the app: template + logic + diff engine)
  ├── opened directly ──────────────► Option C: git clone + open the file
  └── served unchanged by bin/cli.js (static file server, no app logic)
        ├── npx pptxdiff
        ├── npm install -g pptxdiff
        └── VS Code extension (sugatoray.pptxdiff-vscode)
```

All four surfaces above serve the identical app — none of them modify or rebuild it. Fixing a bug or shipping a feature happens exactly once, in `index.html`.

## Testing philosophy

Because there's no build step and no separate test runner wired into CI, correctness is verified by the app's own [in-browser self-test suite](features/self-tests.md), run against the app's real parsing/rendering/diffing code in a real browser — not a mocked unit-test harness. New logic is written pure-function-first (a testable decision/builder function, with a Red/Green test) before the impure DOM/network/`localStorage` shell is wired around it.
