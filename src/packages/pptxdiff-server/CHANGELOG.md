# Changelog

All notable changes to `@pptxdiff/server` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package
intends to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once published.

## [Unreleased]

### Added

- Initial private `@pptxdiff/server` package.
- Stdlib-only `node:http` server wrapper around `@pptxdiff/cli`'s Playwright-driven automation
  layer.
- `GET /v1/health` endpoint.
- `POST /v1/diff` endpoint accepting base64-encoded JSON file payloads and returning the same JSON
  report shape as the GUI export.
- `POST /v1/checksum` endpoint accepting one base64-encoded JSON file payload and returning the
  parser-independent SHA-256 content checksum.
- `GET /openapi.json` endpoint serving an OpenAPI 3.1 specification.
- `GET /docs` endpoint serving browser API documentation backed by `/openapi.json`.
- `pptxdiff-server` executable bin entrypoint.
- Unit, spawned-bin, and end-to-end server tests.

### Fixed

- Runtime import now uses the scoped CLI package path `@pptxdiff/cli/lib/index.js`; the old
  `pptxdiff-cli/lib/index.js` path fails after a fresh install of the renamed package.
- Oversized JSON request bodies return a structured `413` response instead of resetting the socket.

### Changed

- Package depends on local `@pptxdiff/cli` via `"file:../pptxdiff-cli"` while private/unpublished.
- Server binds to `127.0.0.1` by default. Non-loopback binding remains explicit and unauthenticated.
