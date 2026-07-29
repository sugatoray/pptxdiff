# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

No changes yet.

## [0.4.2] - 2026-07-29

### Changed

- Add link to documentation site in README.
- Add badge: [![Docs - GitHub.io](https://img.shields.io/static/v1?logo=github&style=flat&color=pink&label=docs&message=pptxdiff)][#docs-package]

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
