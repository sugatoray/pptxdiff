# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

...

## [0.7.0] - 2026-08-02

### Added

- New private `@pptxdiff/cli` package (`src/packages/pptxdiff-cli/`) with the `pptxdiff-cli` executable for headless deck automation.
- `pptxdiff-cli diff <before.pptx> <after.pptx>` with `diff(1)`-style exit codes: `0` for no differences, `1` for differences found, and `2` for tool/runtime errors.
- `pptxdiff-cli diff` options for script and CI usage: `--json`, `--out`, `--quiet`, and `--timeout`.
- `pptxdiff-cli checksum <file.pptx>` for parser-independent SHA-256 deck checksums.
- Browser resolution for headless automation through `PPTXDIFF_CHROME_PATH`, well-known Chrome/Chromium/Edge install paths, and Playwright fallback behavior.
- Git integration commands in `@pptxdiff/cli`: `textconv <file.pptx>`, `difftool <before.pptx> <after.pptx>`, and `install-git-integration [--global]`.
- New private `@pptxdiff/server` package (`src/packages/pptxdiff-server/`) exposing a stdlib-only local HTTP API over the same headless engine.
- `@pptxdiff/server` endpoints: `GET /v1/health`, `POST /v1/diff`, `POST /v1/checksum`, `GET /openapi.json`, and `GET /docs`.
- `bin/cli.js` now exports `startServer()` for reuse by the headless CLI/API packages while preserving the existing browser app launch behavior.
- Docs-site coverage for the headless CLI/API work, including package-specific sections for `@pptxdiff/cli`, Git integration, `@pptxdiff/server`, and OpenAPI docs endpoints.
- Dedicated docs-site changelog subpages for the root `pptxdiff` npm package, `@pptxdiff/cli`, `@pptxdiff/server`, and `pptxdiff-vscode`.
- MkDocs page revision metadata showing page creation date, last update date, and authors.
- Repository `.mailmap` support so Git/MkDocs collapse multiple GitHub noreply identities for the same author.
- Makefile CLOC helpers for counting lines of code while excluding vendored dependencies such as `src/pptxdiff/vendor`.

### Changed

- Renamed the new CLI package metadata to scoped npm package name `@pptxdiff/cli` while keeping the executable name `pptxdiff-cli`.
- Updated package docs and scrolls to capture scoped npm package tradeoffs, the owned `@pptxdiff` org direction, and the future `@pptxdiff/core` extraction plan.
- Updated docs-site navigation so changelogs appear under grouped `NPM Package(s)` and `VS Code Extension(s)` sections.

### Fixed

- `pptxdiff-cli difftool` now returns control to Git/the shell when the visible browser window is closed.
- `@pptxdiff/server` now imports the scoped CLI package path (`@pptxdiff/cli/lib/index.js`) instead of the old unscoped `pptxdiff-cli` package path.
- Docs-site snippet resolution now works from both direct MkDocs commands and the Makefile docs targets.

## [0.6.0] - 2026-07-31

### Added

- Diff screenshot exports under `Export` -> `Diff Screenshots`, with downloadable SVG screenshots as a ZIP and a self-contained HTML viewer.
- Shareable links now embed the same report JSON used by `Export` -> `Import report JSON...`, so review decisions, comments, history, and UI state can be restored on another machine.
- Parser-independent SHA-256 content checksums for each deck, computed from raw `.pptx` zip parts while excluding save metadata (`docProps/core.xml`, `docProps/app.xml`) and derived thumbnails.
- Content checksum display in the app and checksum output across PDF/print, HTML, JSON, Markdown, Notion, Confluence, Slack, Email, and shareable-link exports.

### Changed

- Extracted shared report-building helpers so JSON export and shareable-link export use one canonical report shape.
- Reused shared slide-pair labeling and collapsed-pair helpers across report rows, all-pairs controls, and screenshot exports.
- Updated npm package metadata and lockfile to version `0.6.0`.

### Security

- Escaped embedded report JSON in shareable-link HTML so comment text containing script-closing markup cannot break out of the JSON script tag.

## [0.5.0] - 2026-07-30

### Added

- New repo-root `SECURITY.md`: local-first model, zero production
  dependencies/no lifecycle scripts, the CLI hardening below, the DC
  runtime's `new Function` scoping, `PPTXDIFF_LITE_MODE`'s CDN opt-in,
  live-push credential caveats, and a vulnerability-reporting process.
- Vendored-dependency provenance: `src/pptxdiff/vendor/manifest.json` +
  `PROVENANCE.md` documenting each vendored file's upstream package,
  version, source URL, hash, and license, plus `scripts/verify_vendor.mjs`
  to re-derive and check those hashes.

### Changed

- Hardened the `pptxdiff` CLI (`bin/cli.js`):
  - The static file server now binds explicitly to loopback (`127.0.0.1`)
    instead of an unspecified host.
  - The browser-launch step uses `execFile()` with an argv array instead of
    a shell-interpolated `exec()` call.
  - Static-file path containment now uses a `path.relative()`-based check
    instead of a raw `startsWith()` prefix check, closing a sibling-directory
    edge case.
  - Every response now sets `X-Content-Type-Options: nosniff` and
    `Cache-Control: no-store`.

## [0.4.2] - 2026-07-29

### Changed

- Added a link to the documentation site in README.
- Added a badge: [![Docs - GitHub.io](https://img.shields.io/static/v1?logo=github&style=flat&color=pink&label=docs&message=pptxdiff)][#docs-package]

[#docs-package]: https://sugatoray.github.io/pptxdiff/

## [0.4.1] - 2026-07-26

### Changed

- Add in-app "Offline Mode" toggle for `PPTXDIFF_LITE_MODE=0`.

## [0.4.0] - 2026-07-26

### Changed

- Vendored all dependencies along with optional escape hatch for using the Lite Mode (CDNs) via environment variable: `PPTXDIFF_LITE_MODE=1`.

## [0.3.1] - 2026-07-24

### Changed

- Updated README with badges for npm and vscode marketplace.
- 📦 Introduced a VS Code Extension. `PptxDiff` can now be installed from VS Code as well: 📦 → Search for `pptxdiff` [![vscode-badge][#vsce-svg-url-version]][#vsce-marketplace-url]

[#vsce-svg-url-version]: https://vsmarketplacebadges.dev/version/sugatoray.pptxdiff-vscode.svg

[#vsce-marketplace-url]: https://marketplace.visualstudio.com/items?itemName=sugatoray.pptxdiff-vscode

## [0.3.0] - 2026-07-23

### Added

- New packaged project assets for npm consumers: `docs/assets/pptxdiff_banner.png`, `pptxdiff_logo.png`, `icon.png`, and `pptxdiff_demo_1_allpairs.png`.
- README demo image showing the all-pairs comparison workflow.

### Changed

- Renamed the app-facing brand from "Slide Diff" to `PptxDiff` across the main app UI and generated report titles.
- Updated exported report filenames to use the `pptxdiff-report.*` naming convention for JSON, HTML, Markdown, Notion Markdown, and Confluence text exports.
- Updated npm package metadata to version `0.3.0`.
- Expanded the npm package `files` allow-list to include the refreshed banner, logo, icon, and demo assets.
- Updated the main README title, banner reference, warning copy, and demo imagery for the `PptxDiff` npm package.

## [0.2.0] - 2026-07-21

### Added

- Static sample `.pptx` test fixtures, `docs/assets/sample_before.pptx` / `sample_after.pptx`, covering the diff engine's test scenarios in one pair of real files: text/font/size/color/alignment, hyperlinks, text wrap, shape borders, images, tables (per-cell formatting), charts, speaker notes, slide backgrounds, and added/removed/reordered slides.
- `src/pptxdiff/gen-sample-pptx.mjs`: the generator script that produces the fixtures above (dev-only tooling, not part of the published package).
- `src/pptxdiff/test_gen-sample-pptx.py`: a self-contained (`uv run`-able) regression check for the generated fixtures — validates OOXML content-type integrity and that every shape stays within the slide bounds, using `python-pptx`.
- New `devDependencies` for the fixture generator/tests: `pptxgenjs`, `@aiden0z/pptx-renderer`, `jszip`, `prettier`, `typescript`. No new runtime dependencies for the shipped CLI/app.

### Changed

- Narrowed the npm package's `files` allow-list to the specific runtime files needed (`src/pptxdiff/index.html`, `support.js`, `sample-pptx.js`) instead of the whole `src/pptxdiff` directory, so dev/test-only scripts are never published.

## [0.1.1] - 2026-07-19

### Added

- Added a screenshot of the user-interface as a banner image.

## [0.1.0] - 2026-07-19

### Added

- `pptxdiff` npm CLI (`bin/cli.js`): serves `src/pptxdiff/` locally on an OS-assigned free port and opens it in the default browser. No new runtime dependencies.

- Root `package.json` making the project installable via `npm install -g pptxdiff` / runnable via `npx pptxdiff`.
