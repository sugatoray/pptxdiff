# CLI reference

`pptxdiff` ships a minimal CLI whose only job is to serve the app locally and open your browser — it has **no runtime dependencies** and doesn't touch your `.pptx` files at all; all parsing/diffing still happens in the browser.

## Usage

```bash
npx pptxdiff        # no install
# or
npm install -g pptxdiff && pptxdiff   # global install
```

There are no flags or options — running the command is the entire interface.

## What it does

`bin/cli.js` is a stdlib-only Node script (`node:http` / `node:fs` / `node:child_process`, no npm dependencies):

1. Starts a static file server bound to an **OS-assigned free port** (`server.listen(0)` — no `--port` flag needed, no port conflicts to manage).
2. Serves `src/pptxdiff/index.html`, `support.js`, and `sample-pptx.js` **unchanged** — the CLI is a pure delivery mechanism, not a build step.
3. Prints the URL to stdout.
4. Best-effort opens your default browser to that URL (`open` on macOS, `start` on Windows, `xdg-open` on Linux). If that fails — e.g. a headless environment with no GUI — it's swallowed silently, since the URL was already printed and you can open it yourself.

## Security note

The server resolves request paths against its serving root and rejects anything that would traverse outside it (`filePath.startsWith(ROOT)`), so `../`-style path traversal requests are blocked with a `403`.

## Requirements

- **Node.js ≥ 18** (see `engines` in `package.json`).
- Internet access at runtime, same as every other install path — the app itself loads its dependencies from CDNs (see [Getting Started](getting-started.md#requirements)).

## Running from source

```bash
git clone https://github.com/sugatoray/pptxdiff.git
cd pptxdiff
node bin/cli.js
```

No `npm install` or build step needed — the CLI has no dependencies to install.
