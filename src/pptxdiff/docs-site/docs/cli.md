# CLI reference

`pptxdiff` ships a minimal CLI whose only job is to serve the app locally and open your browser — it has **no runtime dependencies** and doesn't touch your `.pptx` files at all; all parsing/diffing still happens in the browser.

## Usage

```bash
npx pptxdiff        # no install
# or
npm install -g pptxdiff && pptxdiff   # global install
```

There are no command-line flags. One optional environment variable is supported — see [Lite mode](#lite-mode-cdn-sourcing) below.

## What it does

`bin/cli.js` is a stdlib-only Node script (`node:http` / `node:fs` / `node:child_process`, no npm dependencies):

1. Starts a static file server bound to an **OS-assigned free port** (`server.listen(0)` — no `--port` flag needed, no port conflicts to manage).
2. Serves `src/pptxdiff/index.html`, `support.js`, `sample-pptx.js`, and the vendored assets under `vendor/` **unchanged** — the CLI is a pure delivery mechanism, not a build step.
3. Prints the URL to stdout.
4. Best-effort opens your default browser to that URL (`open` on macOS, `start` on Windows, `xdg-open` on Linux). If that fails — e.g. a headless environment with no GUI — it's swallowed silently, since the URL was already printed and you can open it yourself.

## Security note

The server resolves request paths against its serving root and rejects anything that would traverse outside it (`filePath.startsWith(ROOT)`), so `../`-style path traversal requests are blocked with a `403`.

## Lite mode (CDN sourcing)

By default the app loads React, ReactDOM, Babel, JSZip, `@aiden0z/pptx-renderer`, and the Spectral font from the vendored local copies in `src/pptxdiff/vendor/` — no internet needed. Set `PPTXDIFF_LITE_MODE` to switch all five back to their original CDN sources instead:

```bash
PPTXDIFF_LITE_MODE=1 npx pptxdiff
```

Accepted values: `1`, `y`, `yes`, `true` (case-insensitive). The CLI opens your browser at `<url>/?lite=1` — that query param is the actual mechanism (env vars aren't visible to the browser), so you can also just append `?lite=1` to the URL yourself, including for the "just open `index.html`" install path, which has no Node process to read an env var from. Off by default; this is an opt-in escape hatch (e.g. for comparing against unmodified upstream CDN builds), not something most users need.

A third way to toggle it: the app itself has an **"Offline Mode" switch** in the top-right corner of the page. It shows the current state and reloads the page at the flipped URL when clicked — no need to touch the env var or the URL bar at all.

## Requirements

- **Node.js ≥ 18** (see `engines` in `package.json`).
- No internet access required at runtime — the app's dependencies are vendored locally (see [Getting Started](getting-started.md#requirements)), unless you opt into lite mode above.

## Running from source

```bash
git clone https://github.com/sugatoray/pptxdiff.git
cd pptxdiff
node bin/cli.js
```

No `npm install` or build step needed — the CLI has no dependencies to install.
