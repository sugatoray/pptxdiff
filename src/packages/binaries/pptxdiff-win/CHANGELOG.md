# Changelog — pptxdiff for Windows (standalone binary)

All notable changes to the Windows standalone `pptxdiff-win.exe` build are
documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the version
tracked is the `pptxdiff` app version bundled into the binary (see the
root [`CHANGELOG.md`](../../../../CHANGELOG.md) for the app's own history)
since the binary has no independent feature set of its own.

## [Unreleased]

...

## [0.7.0] - 2026-08-05

### Added

- First standalone Windows executable, built via `@yao-pkg/pkg` (see
  `../README.md` and `docs/.scrolls/SPEC.md` §32) — download
  `pptxdiff-win.exe`, run it. A true single file (Node runtime and the
  static app files it serves are both embedded inside it) — no separate
  Node.js install, no companion folder needed.
- Genuinely cross-compiled: this binary can be built from any host OS
  (Linux, macOS, or Windows), not just Windows itself.

### Known limitations

- **Unsigned.** No code-signing certificate — Windows SmartScreen will
  likely warn on first run ("Windows protected your PC"); click "More
  info" → "Run anyway". See `../README.md` and
  `docs/.scrolls/GAP_ANALYSIS.md`.
- Not yet attached to GitHub Releases — built by
  `.github/workflows/binaries.yml`'s `build-linux-win` job and available
  as a workflow artifact.
