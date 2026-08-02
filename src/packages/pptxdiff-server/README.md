# @pptxdiff/server

Web API for [pptxdiff](https://github.com/sugatoray/pptxdiff): diff two PowerPoint decks over
HTTP, so other tools and AI agents can use pptxdiff without shelling out to a CLI.

This package is Phase 1 of the design proposal in the root repo's
`docs/.scrolls/CLI_API_DESIGN.md` §8. It's a thin stdlib-only (`node:http`, no framework) HTTP
wrapper around `@pptxdiff/cli`'s automation layer (`diffDecks`/`computeChecksum`) — the same
Playwright-driven engine the CLI uses, so this API's answers can never silently disagree with
either the CLI's or the GUI's for the same two files.

## Status

Not yet published to npm. Stateless endpoints only (`/v1/diff`, `/v1/checksum`, `/v1/health`) —
the stateful review-session endpoints described in the design doc (mirroring the GUI's reviewer
workflow) are a documented next step, not built yet. See PLAN.md.

## Development note: the `@pptxdiff/cli` dependency

`package.json` depends on `@pptxdiff/cli` via `"file:../pptxdiff-cli"` — a monorepo-local
development convenience, same reasoning as `@pptxdiff/cli`'s own dependency on `pptxdiff` (see that
package's README). Swap to a real published semver range before this package is actually published.

## API

All endpoints accept/return JSON. File content is base64-encoded inline in the request body
(`{ name?, content }`) rather than `multipart/form-data` — the simplest wire format that needs no
extra dependency; real multipart upload support is a documented fast-follow (see PLAN.md), not a
final design decision.

- `GET /v1/health` → `{ status: "ok", version }`
- `POST /v1/diff` — body: `{ before: { name?, content }, after: { name?, content } }` → the same
  JSON report shape the GUI's "Export → JSON report" button produces (`deckBefore`, `deckAfter`,
  `contentChecksum`, `presentationDiffs`, `slides[]`, `history`, `uiState`).
- `POST /v1/checksum` — body: `{ file: { name?, content } }` → `{ algorithm, hash }` — the
  parser-independent SHA-256 content checksum (SPEC.md §29).

Status codes: `200` success, `400` malformed/missing request body, `413` request body over the
configured size limit (100MB default), `422` the file couldn't be parsed as a `.pptx`, `503` no
browser was available to drive the automation layer, `500` anything else unexpected.

## Security posture — read before binding anywhere but loopback

`startServer()` binds to `127.0.0.1` by default, matching `bin/cli.js`'s existing hardening
precedent (see `docs/.scrolls/SECURITY_ANALYSIS.md`). **This server has no authentication of its
own yet.** Passing `--host` to bind elsewhere is an explicit, unguarded opt-in — CLI_API_DESIGN.md
§8 calls for an API-key requirement on any non-loopback bind, and that is **not implemented in this
first pass**. Do not expose this server directly to an untrusted network; put it behind your own
auth/reverse proxy if you need non-local access before that gap closes.

## Running the tests

`test_server_e2e.mjs` starts a real server and genuinely launches a headless browser — needs a
real Chrome/Chromium/Edge available (see `@pptxdiff/cli`'s README for the three resolution
mechanisms). In a sandbox with no system browser installed:

```sh
PPTXDIFF_CHROME_PATH=/path/to/chrome npm test
```
