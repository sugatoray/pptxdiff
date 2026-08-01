---
doc_coverage:
  - id: headless-cli-api
    quality: partial
    anchor: status
---

# Headless CLI & Web API

`pptxdiff` (the [CLI reference](cli.md) covered elsewhere on this site) is a browser app you look
at. Two additional, separate packages let you get a diff result as **data** instead — from a
script, a CI job, a git hook, or an AI agent — without a human clicking through anything.

## Status

**Not yet published to npm.** These packages live in this repository under `src/packages/` and are
usable today from a source checkout, but you need to build/install them locally — see
[Installing from source](#installing-from-source) below. `diff`, `checksum`, and git integration
(`textconv`/`difftool`/`install-git-integration`) are implemented; `batch`, `report`
(HTML/PDF/CSV/etc.), `merge`, and an MCP server are designed but not built yet. Full design
rationale lives in this repo's `docs/.scrolls/CLI_API_DESIGN.md` and `docs/.scrolls/CLI_and_API.md`.

Both packages are thin wrappers around the exact same browser app documented everywhere else on
this site (`src/pptxdiff/index.html`), driven headlessly via [Playwright](https://playwright.dev/)
— they upload files through the real file inputs, wait for the real diff engine, and click the
real "Export → JSON report" button. This is deliberate: it means a diff result from the CLI or the
API can never disagree with what you'd see clicking through the app yourself.

## `pptxdiff-cli`

A headless CLI with `diff(1)`-style exit codes, so it can gate a script or CI step directly.

```bash
pptxdiff-cli diff before.pptx after.pptx
# exit 0 = no differences, 1 = differences found, 2 = a tool error (missing/unparseable file, no browser available)

pptxdiff-cli diff before.pptx after.pptx --json          # print the full JSON report instead of a summary
pptxdiff-cli diff before.pptx after.pptx --out report.json  # write to a file instead of stdout
pptxdiff-cli diff before.pptx after.pptx --quiet          # suppress stdout; only the exit code matters

pptxdiff-cli checksum deck.pptx    # the deck's parser-independent SHA-256 content checksum, standalone
```

The `--json` output is the same report shape the app's own "Export → JSON report" button produces —
deck names, a parser-independent content checksum per side, presentation-level differences, and a
per-slide-pair list of differences.

## Git integration

Wires `*.pptx` into `git diff`/`git difftool`, instead of git's default "Binary files differ":

```bash
cd your-repo
pptxdiff-cli install-git-integration          # local to this repo (default)
pptxdiff-cli install-git-integration --global  # ~/.gitconfig instead — affects every repo
```

This appends `*.pptx diff=pptxdiff` to `.gitattributes` (idempotent — safe to run again) and points
git at two more subcommands:

```bash
pptxdiff-cli textconv deck.pptx     # one deck's plain text, for `git diff`/`git log -p` to line-diff
pptxdiff-cli difftool before.pptx after.pptx  # opens a real, visible browser window with both
                                               # loaded; blocks until you close it, for `git difftool`
```

`textconv` covers shape/placeholder text and speaker notes (not table cells, chart data, or
SmartArt text yet — see [Limitations](limitations.md)). `difftool` reuses the exact same upload/
render path `diff` does, just in a visible window instead of headless.

## `@pptxdiff/server`

A stateless HTTP API over the same engine — `POST /v1/diff`, `POST /v1/checksum`, `GET /v1/health`.
File content travels as base64 inline in the JSON request body (not `multipart/form-data` yet):

```bash
pptxdiff-server            # binds to 127.0.0.1 on an OS-assigned free port by default
```

```bash
curl -s -X POST http://127.0.0.1:PORT/v1/diff \
  -H 'content-type: application/json' \
  -d "{\"before\":{\"content\":\"$(base64 -w0 before.pptx)\"},\"after\":{\"content\":\"$(base64 -w0 after.pptx)\"}}"
```

**No authentication yet.** The default loopback bind keeps it off your network by default, matching
the same hardening the [`pptxdiff` CLI's server](cli.md#security-note) already has — but passing
`--host` to bind elsewhere is currently an unguarded opt-in. Don't expose this server directly to
an untrusted network; put it behind your own auth/reverse proxy if you need non-local access.

## Installing from source

```bash
git clone https://github.com/sugatoray/pptxdiff.git
cd pptxdiff/src/packages/pptxdiff-cli && npm install
cd ../pptxdiff-server && npm install
```

Each package's dependency on its monorepo siblings (`pptxdiff`, `pptxdiff-cli`) is a local `file:`
reference for now, not a published version — this is what "not yet published" means in practice.
Run either binary straight from its `bin/` script:

```bash
node src/packages/pptxdiff-cli/bin/pptxdiff-cli.js diff before.pptx after.pptx
node src/packages/pptxdiff-server/bin/pptxdiff-server.js
```

Both need a real Chrome, Chromium, or Edge available — they'll find one automatically if it's
already installed in a standard location, or you can point at one explicitly:

```bash
PPTXDIFF_CHROME_PATH=/path/to/chrome pptxdiff-cli diff before.pptx after.pptx
```

## Why this exists

Turning a diff result into structured, scriptable data is what makes pptxdiff usable as
infrastructure rather than only a tool a human operates — as a git `difftool`/`textconv` driver for
`*.pptx` files (above), or as something an AI agent can call directly to review a deck alongside a
human reviewer. See [Limitations](limitations.md) for what's not built yet, and the
[Changelog](changelog.md) for what's shipped so far.
