# Changelog

All notable changes to `@pptxdiff/cli` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package
intends to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once published.

## [Unreleased]

### Added

- Scoped package name `@pptxdiff/cli`, while preserving the `pptxdiff-cli` executable name.
- Headless `diff <before.pptx> <after.pptx>` command with `diff(1)`-style exit codes:
  `0` for no differences, `1` for differences found, `2` for tool/runtime errors.
- `--json`, `--out`, `--quiet`, and `--timeout` options for script and CI usage.
- `checksum <file.pptx>` command for parser-independent SHA-256 content checksums.
- `textconv <file.pptx>` command for git text conversion of `.pptx` files.
- `difftool <local.pptx> <remote.pptx>` command that opens the real pptxdiff GUI in a visible
  browser window with both decks pre-loaded.
- `install-git-integration [--global]` command that configures git `textconv`/`difftool` support
  for `*.pptx`.
- Browser resolution through `PPTXDIFF_CHROME_PATH`, well-known per-OS Chrome/Chromium/Edge paths,
  and Playwright-managed browser fallback.
- Regression coverage for browser resolution, report formatting, textconv output, git integration,
  CLI parsing, automation, real spawned CLI behavior, and visible-browser difftool behavior.

### Fixed

- `difftool` now returns control to git/the shell when the visible browser window is closed on
  macOS/Chrome. The close wait now resolves on either page `close` or browser `disconnected`.
- Added display-free regression coverage for the page-close path so the close wait is not reduced
  back to browser-disconnect-only behavior.
- Automation waits for app content checksums instead of early-rendered UI text, avoiding races with
  the app's default sample-deck load.
- Error-banner detection uses computed styles rather than React inline `style` attributes.

### Changed

- Package remains private and monorepo-local. It depends on root `pptxdiff` via `"file:../../.."`
  until the root package version containing `startServer()` is published.

