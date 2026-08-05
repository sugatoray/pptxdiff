# Changelog

All notable changes to the `pptxdiff` Homebrew formula (`src/packages/pptxdiff-brew/`) will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package
intends to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once published to a
real tap. Entries here track the formula itself, not the underlying `pptxdiff` npm package (see the
root `CHANGELOG.md` for that).

## [Unreleased]

### Added

- Initial `Formula/pptxdiff.rb`, pinned to the published `pptxdiff@0.7.0` npm tarball
  (`sha256:b7bc10ffee012efa1d4914e53b264b338dfbb15dea0714f31c6f664023bff272`).
- `depends_on "node"`, `npm install` into `libexec` + symlinked `bin`, no `resource` blocks needed
  (the tarball has zero runtime `dependencies`).
- `livecheck` block (`strategy :npm`) for automatic new-version detection once tapped.
- A `test do` block that starts the real server, recovers its OS-assigned port from stdout, curls
  it, and asserts real HTML comes back.
- `README.md` documenting current status (not yet in a real tap — install directly from this
  formula file for now), the direct-install command, and the version-bump procedure.
