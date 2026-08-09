# pptxdiff

A local-first PowerPoint (`.pptx`) deck diff tool with a CLI and browser UI, installable via
Homebrew from this tap.

## Install

```sh
brew tap sugatoray/pptxdiff
brew install pptxdiff
```

## Usage

```sh
pptxdiff
```

This starts a local static server on an OS-assigned loopback port and opens your default browser
at that URL. The diff itself runs entirely client-side in that browser tab — nothing is uploaded
anywhere. Press Ctrl-C in the terminal to stop the server.

## Links

- Source: https://github.com/sugatoray/pptxdiff
- Formula source of truth: `src/packages/pptxdiff-brew/` in the repo above
