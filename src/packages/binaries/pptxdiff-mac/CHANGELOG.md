# Changelog — pptxdiff for macOS (standalone binaries)

All notable changes to the macOS standalone `pptxdiff-mac`/
`pptxdiff-mac-arm64` builds are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the version
tracked is the `pptxdiff` app version bundled into the binary (see the
root [`CHANGELOG.md`](../../../../CHANGELOG.md) for the app's own history)
since the binaries have no independent feature set of their own.

## [Unreleased]

...

## [0.7.0] - 2026-08-05

### Added

- First standalone macOS executables, built via `@yao-pkg/pkg` (see
  `../README.md` and `docs/.scrolls/SPEC.md` §32) — download
  `pptxdiff-mac` (Intel) or `pptxdiff-mac-arm64` (Apple Silicon, native),
  run it. Each is a true single file (Node runtime and the static app
  files it serves are both embedded inside it) — no separate Node.js
  install, no companion folder needed.
- **Native Apple Silicon (`pptxdiff-mac-arm64`) build**, added after an
  explicit follow-up question ("does the mac binary work for Apple
  Silicon?"). Without it, an Apple Silicon Mac could only run the Intel
  binary via Rosetta 2 translation — real launch overhead, and Rosetta
  isn't guaranteed pre-installed on a fresh Mac. Verified for real in this
  project's own dev sandbox (Linux): built the `node22-macos-arm64` target
  and confirmed via `file` it's a genuine `Mach-O 64-bit arm64 executable`
  (unsigned, since built off a non-macOS host — real signing only happens
  on the `macos-latest` CI runner or a real Mac).

### Known limitations

- **Must be built on an actual macOS host, not cross-compiled.** Unlike
  the Windows/Linux targets, both of these need `codesign` (macOS-only)
  for a usable result — an unsigned build may not even launch on Apple
  Silicon (confirmed independently by `pkg` itself, which prints this
  exact warning when building `mac-arm64` off of a non-macOS host). See
  `../README.md`.
- **Ad-hoc signed, not notarized.** No Apple Developer ID — Gatekeeper
  will likely block a freshly-downloaded copy ("cannot be opened because
  the developer cannot be verified"); right-click → Open, or
  `xattr -d com.apple.quarantine <binary>` first. See `../README.md` and
  `docs/.scrolls/GAP_ANALYSIS.md`.
- Not yet attached to GitHub Releases — built by
  `.github/workflows/binaries.yml`'s dedicated `build-mac` job and
  available as a workflow artifact.
