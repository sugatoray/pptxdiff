# PptxDiff for VS Code

![banner](https://github.com/sugatoray/pptxdiff/HEAD/docs/assets/pptxdiff_banner.png)

Opens the [pptxdiff](https://github.com/sugatoray/pptxdiff) PowerPoint diff tool in your browser.

## Usage

Run **`pptxdiff: Open Diff Tool`** from the Command Palette (windows: `Ctrl+Shift+P`, mac: `Cmd+Shift+P`).

![demo-banner-allpairs](https://github.com/sugatoray/pptxdiff/HEAD/docs/assets/pptxdiff_demo_1_allpairs.png)

## Packaging

Standalone: `npm run build` vendors `index.html` / `support.js` / `sample-pptx.js` from the sibling `src/pptxdiff` package into `./media`, which ships inside the `.vsix`. `vsce package` / `vsce publish` run this automatically via `vscode:prepublish`, so the packaged extension has no dependency on the rest of this repo at install/run time.

`media/` is generated (gitignored) — `src/pptxdiff` is the source of truth; re-run `npm run build` after it changes.
