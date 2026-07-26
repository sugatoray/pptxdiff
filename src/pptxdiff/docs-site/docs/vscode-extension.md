---
doc_coverage:
  - id: vscode-extension
    quality: complete
---

# VS Code extension

PptxDiff is also available as a VS Code extension — [`sugatoray.pptxdiff-vscode`](https://marketplace.visualstudio.com/items?itemName=sugatoray.pptxdiff-vscode) on the Marketplace.

## What it does

The extension is a thin launcher: it opens the same PptxDiff app you'd get from `npx pptxdiff` or `index.html`, in your browser, from inside VS Code. It doesn't reimplement or wrap the diff engine — it's the identical app, just one command away from the editor you're already in.

## Install

Search for **`pptxdiff`** in the VS Code Extensions panel, or install directly from the [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=sugatoray.pptxdiff-vscode).

## Usage

Run **`pptxdiff: Open Diff Tool`** from the Command Palette:

- Windows/Linux: `Ctrl+Shift+P`
- macOS: `Cmd+Shift+P`

That's the entire interface — one command, opens the app in your browser.

## Source

The extension lives in this repository at `src/packages/pptxdiff-vscode/` and is versioned and released independently of the npm package (see its own `CHANGELOG.md` in that folder).
