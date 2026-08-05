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

- First standalone Windows executable, built via Node's Single Executable
  Applications feature (see `../README.md` and
  `docs/.scrolls/SPEC.md` §32) — download `pptxdiff-win-0.7.0.zip`, unzip,
  run `pptxdiff-win.exe`. No separate Node.js install required.

### Known limitations

- **Unsigned.** No code-signing certificate — Windows SmartScreen will
  likely warn on first run ("Windows protected your PC"); click "More
  info" → "Run anyway". See `../README.md` and
  `docs/.scrolls/GAP_ANALYSIS.md`.
- Not yet attached to GitHub Releases — built by
  `.github/workflows/binaries.yml`'s CI matrix and available as a workflow
  artifact.
