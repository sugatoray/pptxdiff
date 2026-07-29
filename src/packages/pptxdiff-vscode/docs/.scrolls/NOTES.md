# Notes for VS Code Extension: `sugatoray.pptxdiff-vscode`

## Packaging

Standalone: `npm run build` vendors `index.html` / `support.js` / `sample-pptx.js` and the whole `vendor/` directory (React, ReactDOM, Babel, JSZip, pptx-renderer, Spectral font — what `index.html` loads by default in its offline-first mode) from the sibling `src/pptxdiff` package into `./media`, which ships inside the `.vsix`. `vsce package` / `vsce publish` run this automatically via `vscode:prepublish`, so the packaged extension has no dependency on the rest of this repo at install/run time.

`media/` is generated (gitignored) — `src/pptxdiff` is the source of truth; re-run `npm run build` after it changes.
