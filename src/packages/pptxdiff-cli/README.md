# @pptxdiff/cli

Headless CLI for [pptxdiff](https://github.com/sugatoray/pptxdiff): diff two PowerPoint decks
from a script, CI job, or git driver with JSON output and `diff(1)`-style exit codes.

This package follows the Phase 1 design proposal in the root repo's
`docs/.scrolls/CLI_API_DESIGN.md` (see also `docs/.scrolls/CLI_and_API.md` for the
Deno-vs-Playwright reasoning behind the browser-automation approach). It reuses the existing
browser app (`src/pptxdiff/index.html`) exactly as a human would see it, driven headlessly by
`playwright-core`, rather than reimplementing the diff engine.

## Status

Not yet published to npm. This monorepo-local package is named `@pptxdiff/cli`, but it exposes
the shell command `pptxdiff-cli`.

## Development note: `pptxdiff` dependency

`package.json` currently depends on `pptxdiff` via `"file:../../.."`, a relative path back to the
repo root, rather than a published npm semver range. This is intentional for local development:
the CLI package needs the root package's `bin/cli.js` `startServer()` export from the current
checkout.

The root package version in this repo is currently `pptxdiff@0.6.0`. Before `@pptxdiff/cli` is
published, replace the local `file:` dependency with the published semver range for the first
`pptxdiff` release that includes `startServer()`; at the time of this note, that expected range is
`^0.6.0`.

## Browser requirement

The package depends on `playwright-core` instead of the full `playwright` package, so it does not
bundle a Chromium download.

At runtime it looks for a browser to drive, in order:

1. `PPTXDIFF_CHROME_PATH`.
2. Well-known per-OS install paths (see `lib/browser.js`).
3. `playwright-core` managed-browser resolution (`PLAYWRIGHT_BROWSERS_PATH`, etc.) if present.

If none of the three succeed, browser-dependent commands fail with a clear error explaining how to
fix it.

## Commands

- `pptxdiff-cli diff <before.pptx> <after.pptx>` — `diff(1)`-style exit codes (0/1/2), with
  `--json` available.
- `pptxdiff-cli checksum <file.pptx>` — file's parser-independent SHA-256 content checksum.
- `pptxdiff-cli textconv <file.pptx>` — one deck's plain-text content, for git's `textconv`.
- `pptxdiff-cli difftool <local.pptx> <remote.pptx>` — opens a visible browser window with both
  files loaded, then blocks until you close that window; for git's `difftool`.
- `pptxdiff-cli install-git-integration [--global]` — wires `textconv` and `difftool` into git for
  `*.pptx` files.

## Git integration

`textconv` and `difftool` exist specifically to make `git diff` and `git difftool` useful for
`*.pptx` files instead of git's default "Binary files differ."

```sh
cd your-repo
pptxdiff-cli install-git-integration
```

This does two idempotent things:

1. Appends `*.pptx diff=pptxdiff` to the repo's `.gitattributes`, creating it if needed and
   preserving existing content. Commit this file so the whole team gets it.
2. Sets `diff.pptxdiff.textconv` and `difftool.pptxdiff.cmd` in local `.git/config` by default.
   With `--global`, it writes `~/.gitconfig` instead.

After that, `git diff` / `git log -p` line-diff the deck's extracted text. For visual review, run:

```sh
git difftool --tool=pptxdiff -- path/to/deck.pptx
```

For two arbitrary files outside normal git history, use:

```sh
git difftool --tool=pptxdiff --no-index before.pptx after.pptx
```

Close the browser window when finished; the command should then return control to the shell. The
installer must run inside a git repository (`git rev-parse --show-toplevel`).

## Running tests

From this package directory:

```sh
npm install
npm test
```

`npm test` launches a headless browser against the real local app. On machines where browser
discovery fails, point it at Chrome/Chromium/Edge manually:

```sh
PPTXDIFF_CHROME_PATH=/path/to/chrome npm test
```

To exercise the installed binary name locally:

```sh
npm link
pptxdiff-cli --help
npm unlink -g @pptxdiff/cli
```

`test_difftool_e2e.mjs` and `test_difftool_cli.mjs` are separate because they launch a visible
browser window:

```sh
npm run test:difftool
```

In a display-less Linux CI environment, use a virtual display:

```sh
PPTXDIFF_CHROME_PATH=/path/to/chrome xvfb-run -a npm run test:difftool
```

## Implementation notes (`lib/automation.js`)

Three non-obvious automation details are intentional and covered by regression tests:

- The app boots with default sample decks loading asynchronously on both sides. Waiting on visible
  "Differences (N)" text alone is not a reliable "finished loading" signal; the automation waits on
  each side's real 64-hex content checksum instead.
- React applies inline styles through the DOM `style` property, not necessarily as an HTML
  `style="..."` attribute. Error-banner detection therefore uses computed styles instead of CSS
  attribute selectors.
- `difftool` waits for either the visible page's `close` event or the browser's `disconnected`
  event. On macOS/Chrome, closing the visible window may not immediately disconnect the browser
  process, so page-close detection is required for Git to regain control promptly.
