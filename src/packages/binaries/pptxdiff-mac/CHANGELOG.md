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

- First standalone macOS executable, built via `@yao-pkg/pkg` (see
  `../README.md` and `docs/.scrolls/SPEC.md` §32) — download
  `pptxdiff-mac`, run it. A true single file (Node runtime and the static
  app files it serves are both embedded inside it) — no separate Node.js
  install, no companion folder needed.

### Known limitations

- **Must be built on an actual macOS host, not cross-compiled.** Unlike
  the Windows/Linux targets, this one needs `codesign` (macOS-only) for a
  usable result — an unsigned build may not even launch on Apple Silicon.
  See `../README.md`.
- **Ad-hoc signed, not notarized.** No Apple Developer ID — Gatekeeper
  will likely block a freshly-downloaded copy ("cannot be opened because
  the developer cannot be verified"); right-click → Open, or
  `xattr -d com.apple.quarantine pptxdiff-mac` first. See `../README.md`
  and `docs/.scrolls/GAP_ANALYSIS.md`.
- x64 only — no native arm64 build; runs via Rosetta 2 on Apple Silicon.
- Not yet attached to GitHub Releases — built by
  `.github/workflows/binaries.yml`'s dedicated `build-mac` job and
  available as a workflow artifact.
