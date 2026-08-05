# Changelog — pptxdiff for macOS (standalone binary)

All notable changes to the macOS standalone `pptxdiff-mac` build are
documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the version
tracked is the `pptxdiff` app version bundled into the binary (see the
root [`CHANGELOG.md`](../../../../CHANGELOG.md) for the app's own history)
since the binary has no independent feature set of its own.

## [Unreleased]

...

## [0.7.0] - 2026-08-05

### Added

- First standalone macOS executable, built via Node's Single Executable
  Applications feature (see `../README.md` and
  `docs/.scrolls/SPEC.md` §32) — download `pptxdiff-mac-0.7.0.zip`, unzip,
  run `./pptxdiff-mac`. No separate Node.js install required.

### Known limitations

- **Ad-hoc signed, not notarized.** No Apple Developer ID — Gatekeeper
  will likely block a freshly-downloaded copy ("cannot be opened because
  the developer cannot be verified"); right-click → Open, or
  `xattr -d com.apple.quarantine pptxdiff-mac` first. See `../README.md`
  and `docs/.scrolls/GAP_ANALYSIS.md`.
- Not yet attached to GitHub Releases — built by
  `.github/workflows/binaries.yml`'s CI matrix and available as a workflow
  artifact.
