# pptxdiff-cli

Headless CLI for [pptxdiff](https://github.com/sugatoray/pptxdiff): diff two PowerPoint decks
from a script, CI job, or git driver — no browser tab, no manual clicking.

This package is Phase 1 of the design proposal in the root repo's
`docs/.scrolls/CLI_API_DESIGN.md` (see also `docs/.scrolls/CLI_and_API.md` for the
Deno-vs-Playwright reasoning behind this package's browser-automation approach). It reuses the
existing browser app (`src/pptxdiff/index.html`) exactly as a human would see it — driven headlessly
via `playwright-core` — rather than reimplementing the diff engine. That reuse is what guarantees
this CLI's output can never silently disagree with what the GUI shows for the same two files.

## Status

Not yet published to npm. This is a monorepo-local package under active development on the
`claude/pptxdiff-cli-web-api-ezbjpq` branch.

## Development note: the `pptxdiff` dependency

`package.json` currently depends on `pptxdiff` via `"file:../../.."` (a relative path back to
the repo root) rather than a published npm semver range. This is intentional for local development
only: this package needs `bin/cli.js`'s `startServer()` export, which does not exist in the
`pptxdiff` version currently published to npm (0.5.0) — it was added on this same branch. **Before
this package is actually published**, swap that dependency to a real semver range (e.g. `^0.6.0`)
matching whichever published `pptxdiff` version first ships `startServer()`.

## Browser requirement

This package depends on `playwright-core` (not the full `playwright` package), which does **not**
bundle a Chromium download — see `docs/.scrolls/CLI_and_API.md` for why. At runtime it looks for a
browser to drive, in this order:

1. `PPTXDIFF_CHROME_PATH` env var, if set — an explicit path to a Chrome/Chromium/Edge executable.
2. A handful of well-known per-OS install locations for Chrome/Chromium/Edge (see `lib/browser.js`).
3. Failing both, `playwright-core`'s own managed-browser resolution (works for free if you've
   already run `npx playwright install chromium`, or in an environment where
   `PLAYWRIGHT_BROWSERS_PATH` already points at an installed browser).

If none of the three succeed, commands that need a browser fail with a clear error explaining how
to fix it — never a silent hang or a cryptic Playwright stack trace.

## Running the tests

`test_automation_e2e.mjs` genuinely launches a headless browser against a real local copy of the
app and drives it — it needs a real Chrome/Chromium/Edge available via one of the three mechanisms
above. In a sandbox with no system browser installed, point it at a manually-installed one:

```sh
PPTXDIFF_CHROME_PATH=/path/to/chrome npm test
```

## Implementation notes (`lib/automation.js`)

Two non-obvious things were true about driving this specific app that a naive Playwright script
gets wrong — both found via genuine RED test failures during development, not anticipated up front:

- **The app boots with a default sample deck already loading on both sides** (`componentDidMount()`'s
  `buildSample()` call). That load is asynchronous, and the "Differences (N)" panel header can
  render from the component's initial *empty* state before it even starts — so waiting on that text
  alone is not a reliable "finished loading" signal, and uploading a real file too early races the
  default load's own `setState` call, which can silently overwrite what was just uploaded. Each
  side's content checksum (SPEC.md §29) is set in the *same* `setState` call as everything else
  about that side, as the last step of its `ingest()` — so "this side's checksum is a real 64-hex
  value, and (after an upload) differs from what it was before" is the actual atomic, race-proof
  "done" signal this module waits on, both at boot and after every upload.
- **React applies inline styles via the DOM `style` *property*, not an HTML `style="..."`
  *attribute*.** `element.getAttribute('style')` on this app's rendered error banner returns `null`
  despite the template literally saying `style="background:#FBEFEC;..."` — so a
  `div[style*="#FBEFEC"]` CSS attribute selector can never match anything in this app, for any
  element, not just this one. `getComputedStyle(el).backgroundColor` (which browsers normalize to
  `rgb(r, g, b)` regardless of how the color was authored) is the reliable way to find it — see
  `findErrorBannerText()`.
