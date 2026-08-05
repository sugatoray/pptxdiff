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

## [Unreleased] (continued)

### Added

- `lib.mjs` — shared pure/network helpers (`parseFormula`, `fetch`, `sha256hex`,
  `resolveNpmVersion`, and a new `updateFormulaPin`) factored out of `test_formula.mjs` so
  `sync-tap.mjs` doesn't duplicate the same formula-parsing/network logic.
- `sync-tap.mjs` (`node sync-tap.mjs [--file <path>] [--version <x.y.z>|latest]`) — resolves a
  target `pptxdiff` npm version (default: npm's `dist-tags.latest`), downloads its real tarball,
  computes its real sha256, and rewrites only the `url`/`sha256` lines of a target formula file in
  place. Idempotent (no-op, no write, if the file already matches) so it's safe to run
  unconditionally on a schedule. Verified end-to-end against the real npm registry: a no-op run
  against the current formula, and an update run against a deliberately stale scratch copy that
  correctly restored it to the real `0.7.0` pin.
- `test_sync_tap.mjs` (`npm test`, now `test_sync_tap.mjs && test_formula.mjs`) — pure, network-free
  Red/Green tests for `updateFormulaPin` (replaces only url/sha256, leaves every other line
  byte-identical, idempotent on already-current values) and `parseArgs` (defaults, overrides,
  rejects unknown flags). Demonstrated genuine RED before GREEN: broke `updateFormulaPin`'s sha256
  regex so it could never match, confirmed exactly 1 of 11 assertions failed, restored it, confirmed
  11/11 — and re-confirmed `test_formula.mjs` was unaffected (still 18/18) after the shared `lib.mjs`
  extraction.
- `.github/workflows/sync-homebrew-tap.yml` (root of the monorepo) — three-job CI pipeline:
  `bump-formula` (runs `sync-tap.mjs` + `npm test` against this repo's own formula copy, opens a PR
  here if changed), `brew-audit` (macOS runner, real `brew audit --strict --online`/`brew
  install`/`brew test` against the updated formula — the genuine real-Homebrew verification this
  sandbox cannot do), `sync-tap-repo` (opens a PR against `sugatoray/homebrew-pptxdiff` with the same
  file, once that repo + a `HOMEBREW_TAP_TOKEN` secret exist). Triggers: `workflow_dispatch` +
  weekly `schedule`. See README.md's "Publishing to a real tap" for the full pipeline description
  and the two manual one-time setup steps (repo + secret) still needed before job 3 can succeed.
- `README.md`: new "Publishing to a real tap" section; "Bumping the version" rewritten to point at
  `sync-tap.mjs` instead of manual editing.
