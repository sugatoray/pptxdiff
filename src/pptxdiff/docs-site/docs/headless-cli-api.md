---
doc_coverage:
  - id: headless-cli
    quality: partial
    anchor: pptxdiffcli
  - id: git-integration
    quality: partial
    anchor: git-integration
  - id: web-api
    quality: partial
    anchor: pptxdiffserver
  - id: openapi-docs
    quality: complete
    anchor: api-discovery
---

# Headless CLI & Web API

The browser app remains the primary `pptxdiff` experience. The packages under
`src/packages/` expose the same diff engine to scripts, CI jobs, Git drivers,
and local automation.

Both packages are Phase 1 wrappers around the existing browser app
(`src/pptxdiff/index.html`) driven through Playwright. They upload the decks
through the same file inputs, wait for the same diff engine, and read the same
JSON report export the UI produces. That keeps CLI/API results aligned with what
a human reviewer sees in the browser.

!!! warning "Early-stage packages"
    `@pptxdiff/cli` and `@pptxdiff/server` are in very early stages of
    development. Their current commands, API shape, package layout, and local
    dependency wiring may change before the packages are published for general
    npm use. Treat them as experimental source-checkout tools for now.

## Status

The packages are not published to npm yet. They are usable from a source checkout
with local `file:` dependencies.

Implemented now:

- `@pptxdiff/cli`: `diff`, `checksum`, `textconv`, `difftool`, and
  `install-git-integration`.
- `@pptxdiff/server`: `GET /v1/health`, `POST /v1/diff`,
  `POST /v1/checksum`, `GET /openapi.json`, and `GET /docs`.

Designed but not built yet:

- `batch`
- non-JSON `report` outputs such as HTML, PDF, CSV, Markdown, Notion, and
  Confluence
- `merge`
- MCP server
- browser-free `@pptxdiff/core` engine extraction

The design rationale lives in `docs/.scrolls/CLI_API_DESIGN.md` and
`docs/.scrolls/CLI_and_API.md`.

## `@pptxdiff/cli`

`@pptxdiff/cli` provides the `pptxdiff-cli` binary for headless deck comparison.
The `diff` command follows `diff(1)`-style exit codes, so it can gate a script or
CI step directly.

```bash
pptxdiff-cli diff before.pptx after.pptx
# exit 0 = no differences
# exit 1 = differences found
# exit 2 = tool error, such as missing file, unparseable file, or no browser

pptxdiff-cli diff before.pptx after.pptx --json
pptxdiff-cli diff before.pptx after.pptx --out report.json
pptxdiff-cli diff before.pptx after.pptx --quiet

pptxdiff-cli checksum deck.pptx
```

`--json` emits the same report shape as the browser app's "Export -> JSON
report" action: deck names, parser-independent checksums, presentation-level
differences, and per-slide-pair differences.

## Git Integration

`pptxdiff-cli` can wire `.pptx` files into Git so `git diff` and `git difftool`
show useful PowerPoint-specific output instead of only "Binary files differ".

```bash
cd your-repo
pptxdiff-cli install-git-integration
pptxdiff-cli install-git-integration --global
```

The installer adds an idempotent `*.pptx diff=pptxdiff` entry to `.gitattributes`
and configures Git to use these subcommands:

```bash
pptxdiff-cli textconv deck.pptx
pptxdiff-cli difftool before.pptx after.pptx
```

`textconv` extracts shape/placeholder text and speaker notes for line-oriented
Git diffs. It does not extract table cell text, chart data labels, or SmartArt
text yet; see [Limitations](limitations.md).

`difftool` opens a visible browser window with both decks loaded through the real
app path. It waits until the browser window closes, then returns control to Git.

## `@pptxdiff/server`

`@pptxdiff/server` provides the `pptxdiff-server` binary and a stateless HTTP API
over the same engine. It binds to `127.0.0.1` on an OS-assigned free port by
default.

```bash
pptxdiff-server
```

Endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/health` | Health check with package version. |
| `POST` | `/v1/diff` | Diff two base64-encoded `.pptx` files. |
| `POST` | `/v1/checksum` | Compute a parser-independent SHA-256 deck checksum. |
| `GET` | `/openapi.json` | Serve the OpenAPI 3.1 specification. |
| `GET` | `/docs` | Serve browser API docs backed by `/openapi.json`. |

File content is sent as base64 inline in JSON, not as `multipart/form-data` yet.

```bash
curl -s -X POST http://127.0.0.1:PORT/v1/diff \
  -H 'content-type: application/json' \
  -d '{
    "before": {"name": "before.pptx", "content": "BASE64_BEFORE"},
    "after": {"name": "after.pptx", "content": "BASE64_AFTER"}
  }'
```

No authentication is implemented yet. The default loopback bind keeps the server
off the network by default, but `--host` is an explicit opt-in. Do not expose the
server directly to an untrusted network; put it behind your own auth or reverse
proxy if you need non-local access.

## API Discovery

The Web API exposes lightweight, FastAPI-style discovery endpoints:

```text
GET /openapi.json
GET /docs
```

`/openapi.json` is generated locally by the server and works offline. `/docs`
serves a small Swagger UI page that loads Swagger UI assets from a CDN, so the
HTML page currently needs network access for the interactive UI to render. If
offline API docs become important, the next step is to vendor those assets or
replace the page with a tiny local renderer.

## Installing From Source

```bash
git clone https://github.com/sugatoray/pptxdiff.git
cd pptxdiff/src/packages/pptxdiff-cli
npm install

cd ../pptxdiff-server
npm install
```

Run either binary directly from its package:

```bash
node src/packages/pptxdiff-cli/bin/pptxdiff-cli.js diff before.pptx after.pptx
node src/packages/pptxdiff-server/bin/pptxdiff-server.js
```

Both packages need a real Chrome, Chromium, or Edge installation. They look in
standard locations automatically, or you can point at a browser explicitly:

```bash
PPTXDIFF_CHROME_PATH=/path/to/chrome pptxdiff-cli diff before.pptx after.pptx
```

## Why This Exists

Structured CLI/API output makes `pptxdiff` useful as infrastructure: CI can gate
deck changes, Git can diff `.pptx` files, and other tools or agents can request
deck comparisons without shelling out to the browser UI manually.

See [Limitations](limitations.md) for current gaps and [Changelog](changelog.md)
for the shipped history.
