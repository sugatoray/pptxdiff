# Changelog

All notable changes to the `pptxdiff` Homebrew formula (`src/packages/pptxdiff-brew/`) will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package
intends to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once published to a
real tap. Entries here track the formula itself, not the underlying `pptxdiff` npm package (see the
root `CHANGELOG.md` for that).

Versions here follow `{pptxdiff-version}-{calver}` (see `CLAUDE.md` in this directory for the full
methodology) — not plain SemVer, since this package tracks someone else's release, not its own.
`pptxdiff-version` and `calver` for each entry below reflect what was true at the commit(s) that
introduced it, not the date this changelog was last edited.

## [Unreleased]

## [0.7.0-20260809] - 2026-08-09

### Added

- Adopted the `{pptxdiff-version}-{calver}` versioning methodology for this package (`package.json`
  `version` + this file's headings), documented in a new `CLAUDE.md` in this directory.

## [0.7.0-20260808] - 2026-08-08

### Added

- `brew_README.md` — a minimal, tap-facing install doc (`brew tap` + `brew install` + basic usage),
  copied by `.github/workflows/sync-homebrew-tap.yml` into `sugatoray/homebrew-pptxdiff` as that
  repo's `README.md`. Deliberately separate from this package's own `README.md`, which documents
  the formula/package itself (Red/Green TDD, CI pipeline internals, etc.) and isn't meant to ship
  as the tap repo's front page.

### Changed

- `.github/workflows/sync-homebrew-tap.yml` no longer stages or copies `CHANGELOG.md` to the tap
  repo — the tap doesn't carry a changelog copy. The `README.md` it copies now comes from
  `brew_README.md` instead of this package's own `README.md`.
- `README.md`: "Installing" now leads with the real `brew tap sugatoray/pptxdiff && brew install
  pptxdiff` path (noting the one still-open sync PR, `homebrew-pptxdiff#1`, that needs merging for
  install to resolve), demoted the direct-file install to a fallback; "Status" and "Publishing to a
  real tap" updated to reflect that both one-time setup steps (repo + `HOMEBREW_TAP_TOKEN`) are done
  and the pipeline has run green end-to-end for real, not just been written and syntax-checked.

### Fixed

- `.github/workflows/sync-homebrew-tap.yml`'s `brew-audit` job, which failed on its first four real
  `workflow_dispatch` runs against real Homebrew-CLI behavior changes: `brew audit`/`brew install`
  no longer accept a bare formula path (fixed by staging the formula into a throwaway local tap and
  addressing it by tap-qualified name); a freshly created local tap is untrusted by default (fixed
  with `brew trust --formula`); `brew audit --strict` enforces `livecheck` coming before
  `depends_on` in `Formula/pptxdiff.rb` (reordered). All three jobs (`bump-formula` → `brew-audit` →
  `sync-tap-repo`) now pass end-to-end for real, including a genuine PR opened against
  `sugatoray/homebrew-pptxdiff` (`homebrew-pptxdiff#1`).
- `sugatoray/homebrew-pptxdiff` itself had no commits/branches yet, which separately blocked
  `sync-tap-repo`'s `actions/checkout` step ("couldn't find remote ref refs/heads/master"). Given an
  initial commit (README) directly, unblocking the workflow's own PR-opening step.

## [0.7.0-20260805] - 2026-08-05

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
- `LICENSE` — a real copy (not a symlink) of the repo root's Apache-2.0 `LICENSE`, matching
  `pptxdiff-vscode`'s existing precedent of carrying its own copy for the same reason: this
  directory's content is pushed into the separate `sugatoray/homebrew-pptxdiff` repo by CI, which
  needs its own top-level `LICENSE` as a standalone repo.

### Changed

- `.github/workflows/sync-homebrew-tap.yml`: the `bump-formula` job now stages and uploads
  `README.md`/`CHANGELOG.md`/`LICENSE` alongside `Formula/pptxdiff.rb`, and `sync-tap-repo` copies
  all four into the tap repo (formula into `Formula/`, the other three into the repo root) as part of
  the same PR. Added a job-level `should_sync` output (`changed == 'true' || event_name ==
  'workflow_dispatch'`) so a manual `workflow_dispatch` run always pushes the current
  README/CHANGELOG/LICENSE/formula state to the tap even when the version pin itself didn't move
  (e.g. a docs-only edit) — a scheduled run still only proceeds past `bump-formula` when the pin
  actually changed, to avoid a no-op macOS run + empty-diff PR every week.
- `test_formula.mjs`: new "0." check asserting `README.md`/`CHANGELOG.md`/`LICENSE` exist, plus a
  real drift check that this package's `LICENSE` is byte-identical to the repo root's `LICENSE`.
  Self-test count 18 → 22.

### Fixed

- A real bug in the new drift-check assertion itself, caught by its own RED demonstration: the
  first version read the local `LICENSE` file unconditionally inside an `&&` chain without first
  checking it existed, so deleting it crashed the whole test script with an uncaught `ENOENT`
  instead of failing that one assertion. Fixed by adding the missing `fs.existsSync()` guard.

### Verified

- Demonstrated genuine RED before GREEN: corrupted the formula's `sha256` pin and deleted its
  `depends_on "node"` line, ran `test_formula.mjs`, confirmed exactly those 2 of 18 assertions
  failed (16/18) while every other check — including the real `npm install`/run/curl against the
  live tarball — stayed green; restored the formula and confirmed 18/18 again.
- Three real RED states demonstrated before the final GREEN: `LICENSE` moved away entirely (2/22
  failed: existence + identity); `LICENSE` restored but then content-tampered, i.e. drifted rather
  than missing (1/22 failed: identity only, existence correctly passed); restored to genuinely
  byte-identical (22/22).
