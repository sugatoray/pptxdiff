# Changelog — pptxdiff for Windows (standalone binaries)

All notable changes to the Windows standalone `pptxdiff-win.exe`/
`pptxdiff-win-arm64.exe` builds are documented here. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the version
tracked is the `pptxdiff` app version bundled into the binary (see the
root [`CHANGELOG.md`](https://github.com/sugatoray/pptxdiff/blob/master/CHANGELOG.md) for the app's own history)
since the binaries have no independent feature set of their own.

## [Unreleased]

...

## [0.7.0] - 2026-08-05

### Added

- First standalone Windows executable, built via `@yao-pkg/pkg` (see
  `../README.md` and `docs/.scrolls/SPEC.md` §36) — download
  `pptxdiff-win.exe`, run it. A true single file (Node runtime and the
  static app files it serves are both embedded inside it) — no separate
  Node.js install, no companion folder needed.
- Genuinely cross-compiled: this binary can be built from any host OS
  (Linux, macOS, or Windows), not just Windows itself.
- **Native arm64 build (`pptxdiff-win-arm64.exe`)**, added after an
  explicit follow-up ask to extend the macOS arm64 work to Windows/Linux
  too. Needs `--fallback-to-source` (see `../README.md`) since generating
  V8 bytecode for a foreign architecture isn't possible without QEMU
  emulation on the build host — confirmed directly via a genuine
  exec-format failure without the flag. Verified for real in this
  project's own dev sandbox (x64 Linux): built the `node22-win-arm64`
  target and confirmed via `file` it's a genuine `PE32+ ... Aarch64`
  executable.

### Known limitations

- **Unsigned.** No code-signing certificate — Windows SmartScreen will
  likely warn on first run ("Windows protected your PC"); click "More
  info" → "Run anyway". See `../README.md` and
  `docs/.scrolls/GAP_ANALYSIS.md`.
- Not yet attached to GitHub Releases — built by
  `.github/workflows/binaries.yml`'s `build-linux-win` job and available
  as a workflow artifact.
