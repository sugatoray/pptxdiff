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
- `test_formula.mjs` (`npm test`) — a genuine Red/Green TDD check for the formula, since real
  `brew install`/`brew audit`/`brew test` cannot run in this sandbox (Homebrew refuses to run as
  root, and running it under an unprivileged user still hits a `403` from the outbound proxy on
  `ghcr.io`, needed for Homebrew's portable-ruby — both confirmed by actually attempting it, not
  assumed). The script downloads the real pinned tarball, verifies its sha256, cross-checks it
  against the npm registry's own metadata, then replays the formula's `install` method's exact
  `npm install --global --prefix=<libexec> ...` command against the real tarball and runs/curls the
  resulting real `pptxdiff` binary — the same functional proof `brew test` would give.
- `package.json` (private, no publish) so `npm test` works the same way it does in the other
  `src/packages/*` directories.

### Verified

- Demonstrated genuine RED before GREEN: corrupted the formula's `sha256` pin and deleted its
  `depends_on "node"` line, ran `test_formula.mjs`, confirmed exactly those 2 of 18 assertions
  failed (16/18) while every other check — including the real `npm install`/run/curl against the
  live tarball — stayed green; restored the formula and confirmed 18/18 again.
