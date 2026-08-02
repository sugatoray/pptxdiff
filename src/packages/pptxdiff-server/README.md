# @pptxdiff/server

Web API for [pptxdiff](https://github.com/sugatoray/pptxdiff): diff two PowerPoint decks over
HTTP, so other tools and AI agents can use pptxdiff without shelling out to a CLI.

This package follows the Phase 1 design proposal in the root repo's
`docs/.scrolls/CLI_API_DESIGN.md` §8. It is a thin stdlib-only (`node:http`, no framework) HTTP
wrapper around `@pptxdiff/cli`'s automation layer (`diffDecks`/`computeChecksum`), using the same
Playwright-driven engine as the CLI and GUI.

## Status

Not yet published to npm. Stateless endpoints only (`/v1/diff`, `/v1/checksum`, `/v1/health`) are
implemented. Stateful review-session endpoints described in the design doc are a later step.

## Development note: `@pptxdiff/cli` dependency

`package.json` depends on `@pptxdiff/cli` via `"file:../pptxdiff-cli"` as a monorepo-local
development convenience. Swap it to a real published semver range before this package is published.

Runtime imports must use the scoped package name too. The server imports the CLI automation layer
from `@pptxdiff/cli/lib/index.js`; using the old `pptxdiff-cli/lib/index.js` path fails after a
fresh `npm install`.

The package bin entrypoint is executable, so after install/linking it can also be invoked as
`pptxdiff-server`.

## API

All endpoints accept/return JSON. File content is base64-encoded inline in the request body:

- `GET /v1/health` -> `{ status: "ok", version }`
- `POST /v1/diff` body: `{ before: { name?, content }, after: { name?, content } }`
  -> same JSON report shape as the GUI's "Export -> JSON report" button.
- `POST /v1/checksum` body: `{ file: { name?, content } }`
  -> `{ algorithm, hash }`
- `GET /openapi.json` -> OpenAPI 3.1 specification for the implemented API.
- `GET /docs` -> browser documentation page backed by `/openapi.json`.

Status codes: `200` success, `400` malformed/missing body, `413` request body over configured size
limit, `422` file could not be parsed as `.pptx`, `503` no browser available, `500` unexpected
server error.

## Security posture

`startServer()` binds `127.0.0.1` by default, matching `bin/cli.js`'s existing hardening precedent.
This server does not yet implement authentication. Passing `--host` to bind elsewhere is an
explicit, unguarded opt-in; put it behind your own auth/reverse proxy before exposing it to an
untrusted network.

## Running tests

`test_server_e2e.mjs` starts a real server and launches a headless browser, so a real
Chrome/Chromium/Edge must be available. In a sandbox with no system browser installed:

```sh
PPTXDIFF_CHROME_PATH=/path/to/chrome npm test
```
