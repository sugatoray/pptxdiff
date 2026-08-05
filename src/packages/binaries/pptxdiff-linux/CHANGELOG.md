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

- First standalone Linux executable, built via Node's Single Executable
  Applications feature (see `../README.md` and
  `docs/.scrolls/SPEC.md` §32) — download `pptxdiff-linux-0.7.0.zip`,
  unzip, `chmod +x pptxdiff-linux && ./pptxdiff-linux`. No separate
  Node.js install required.
- Verified end-to-end in this project's own dev sandbox: built for real,
  the actual packaged binary was run and confirmed to correctly serve
  `index.html`/`support.js`/`vendor/*` over real HTTP requests (see
  `../test_build_e2e.mjs`).

### Known limitations

- Not yet attached to GitHub Releases — built by
  `.github/workflows/binaries.yml`'s CI matrix and available as a workflow
  artifact.
