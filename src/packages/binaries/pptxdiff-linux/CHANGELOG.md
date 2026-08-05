# Changelog — pptxdiff for Linux (standalone binary)

All notable changes to the Linux standalone `pptxdiff-linux` build are
documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the version
tracked is the `pptxdiff` app version bundled into the binary (see the
root [`CHANGELOG.md`](../../../../CHANGELOG.md) for the app's own history)
since the binary has no independent feature set of its own.

## [Unreleased]

...

## [0.7.0] - 2026-08-05

### Added

- First standalone Linux executable, built via `@yao-pkg/pkg` (see
  `../README.md` and `docs/.scrolls/SPEC.md` §32) — download
  `pptxdiff-linux`, `chmod +x pptxdiff-linux && ./pptxdiff-linux`. A true
  single file (Node runtime and the static app files it serves are both
  embedded inside it) — no separate Node.js install, no companion folder
  needed.
- Genuinely cross-compiled: this binary can be built from any host OS, not
  just Linux itself.
- Verified end-to-end in this project's own dev sandbox, twice: once
  against the original Node-SEA-based mechanism, and again after switching
  to `@yao-pkg/pkg` — the actual packaged binary was built and run for
  real, confirmed to correctly serve `index.html`/`support.js`/`vendor/*`
  over real HTTP requests with zero code changes to `bin/cli.js` (see
  `../test_build_e2e.mjs`).

### Known limitations

- Not yet attached to GitHub Releases — built by
  `.github/workflows/binaries.yml`'s `build-linux-win` job and available
  as a workflow artifact.
