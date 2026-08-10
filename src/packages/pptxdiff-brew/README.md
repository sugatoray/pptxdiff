# pptxdiff (Homebrew formula)

A [Homebrew](https://brew.sh) formula for [pptxdiff](https://github.com/sugatoray/pptxdiff),
packaged from the published npm tarball rather than reimplemented — same bytes a user would get
from `npm install -g pptxdiff`, wrapped so `brew install` works too.

## Status

Published to a real Homebrew tap, [`sugatoray/homebrew-pptxdiff`](https://github.com/sugatoray/homebrew-pptxdiff)
(see "Installing" below — one PR there, `homebrew-pptxdiff#1`, still needs merging for `brew
install pptxdiff` to resolve). `pptxdiff` (the root npm package this formula wraps) is
zero-runtime-dependency — every third-party library it needs (React, JSZip, pptx-renderer, ...) is
already vendored under `src/pptxdiff/vendor` — so packaging it for Homebrew only needed a formula
that installs the tarball and symlinks its one bin entry, no `resource` blocks for npm
dependencies.

Real `brew audit --strict --online`/`brew install`/`brew test` now run for real in CI
(`.github/workflows/sync-homebrew-tap.yml`'s `brew-audit` job, on GitHub's `macos-latest`
runners) and pass — this sandbox still can't run real Homebrew itself (see "Why real `brew`
doesn't run here" below), but that gap is closed by CI rather than by hand on a maintainer
machine.

## Why real `brew` doesn't run here

Two real attempts were made to run actual Homebrew in this sandbox, not just assumed impossible:

1. **As root** (the sandbox's only user): `brew` refuses outright — "Running Homebrew as root is
   extremely dangerous and no longer supported," with no override flag in current Homebrew.
2. **Under a fresh unprivileged user** (`useradd -m brewtest`, cloned `Homebrew/brew` directly,
   ran as that user): `brew` itself ran, but installing anything requires Homebrew's
   portable-ruby, fetched from `ghcr.io` — this environment's outbound proxy returns `403` for
   that host (confirmed via `$HTTPS_PROXY/__agentproxy/status`, per the environment's own
   instructions, not assumed or guessed at).

Both attempts were cleaned up afterward (temp user and clone removed). Given that wall,
`test_formula.mjs` (see below) proves everything that CAN be proven for real here instead of
settling for a syntax-only check.

## Red/Green TDD: `test_formula.mjs`

Run from this directory:

```sh
npm test
# or: node test_formula.mjs
```

Since real `brew` can't run here, this script proves the formula for real a different way — it
downloads the actual pinned npm tarball, verifies its sha256 against the formula's pin, cross-checks
the pin against the npm registry's own metadata, then **replays the formula's own `install` method's
exact command** (`npm install --global --prefix=<libexec> --verbose --no-progress`, matching
Homebrew's `std_npm_install_args`) against the real extracted tarball, symlinks the result exactly
like `bin.install_symlink Dir["#{libexec}/bin/*"]` does, then **runs the real resulting `pptxdiff`
binary and curls it** — the same functional proof `brew test` would give, just orchestrated by this
script instead of `brew` itself.

Demonstrated genuine RED before GREEN, not just asserted: temporarily corrupted the formula's
`sha256` and deleted its `depends_on "node"` line, reran the test, confirmed exactly those 2 of 18
assertions failed (16/18) while every other check — including the real npm install/run/curl —
stayed green, then restored the formula and confirmed 18/18 again.

## Installing

**Via the tap** (`sugatoray/homebrew-pptxdiff`, kept in sync with this formula by
`.github/workflows/sync-homebrew-tap.yml` — see "Publishing to a real tap" below):

```sh
brew tap sugatoray/pptxdiff
brew install pptxdiff
```

Homebrew resolves the short tap name `sugatoray/pptxdiff` to the repo
[`sugatoray/homebrew-pptxdiff`](https://github.com/sugatoray/homebrew-pptxdiff), pulling
`Formula/pptxdiff.rb` from its `Formula/` directory. Note: the tap repo's very first sync PR
(`homebrew-pptxdiff#1`) needs to be merged before `brew install pptxdiff` finds the formula —
`brew tap` will succeed regardless, but install fails with "no formula found" until that PR lands.

**Directly from this file**, no tap required (works even before the tap PR above merges):

```sh
brew install --formula https://raw.githubusercontent.com/sugatoray/pptxdiff/HEAD/src/packages/pptxdiff-brew/Formula/pptxdiff.rb
```

or, from a local checkout of this repo:

```sh
brew install --formula src/packages/pptxdiff-brew/Formula/pptxdiff.rb
```

Either way:

```sh
pptxdiff
```

`pptxdiff` starts a local static server on an OS-assigned loopback port and opens your default
browser at that URL. The diff itself runs entirely client-side in that browser tab — nothing is
uploaded anywhere. Press Ctrl-C in the terminal to stop the server.

## What the formula does

- Downloads the published `pptxdiff` npm tarball for a pinned version (currently `0.7.0`) directly
  from the npm registry (`https://registry.npmjs.org/pptxdiff/-/pptxdiff-<version>.tgz`), verified
  against the pinned `sha256`.
- `depends_on "node"` (the only real runtime requirement — `bin/cli.js` is a plain Node script over
  `node:http`/`node:fs`/`node:path`/`node:child_process`, no native addons).
- `npm install` inside `libexec`, then symlinks the package's one `bin` entry
  (`pptxdiff` -> `bin/cli.js`) into Homebrew's `bin`. No `resource` blocks: the tarball's
  `package.json` has no runtime `dependencies`, only `devDependencies` used to build/test this
  monorepo, so nothing else needs to be fetched.
- A `test do` block that starts the real server, reads the printed
  `pptxdiff running at http://localhost:<port>` line to recover the OS-assigned port, curls it, and
  asserts real HTML comes back — then kills the process. Exercises the actual installed binary, not
  just that the formula parses.

## Bumping the version

Automated, via `sync-tap.mjs` — no more hand-editing `url`/`sha256`:

```sh
node sync-tap.mjs                    # bumps to npm's current dist-tags.latest
node sync-tap.mjs --version 0.8.0    # or pin an exact version
```

It downloads the real tarball for that version, computes its real sha256, and rewrites only the
`url`/`sha256` lines in `Formula/pptxdiff.rb` in place (everything else — comments, `install`,
`test do`, `caveats` — is untouched). If the formula already matches that version it prints "already
up to date" and makes no change (idempotent — safe to run on a schedule). After it runs, re-verify
with `npm test` (see above) before committing.

This is exactly what `.github/workflows/sync-homebrew-tap.yml` runs in CI — see "Publishing to a
real tap" below for the full automated pipeline, and for what still needs manual, one-time setup
before that workflow actually reaches a tap repo.

The `livecheck` block (`strategy :npm`) additionally lets `brew livecheck` detect new versions
automatically once this formula lives in a real tap that runs livecheck in CI — a complementary,
Homebrew-native signal, independent of `sync-tap.mjs`.

## Publishing to a real tap

`.github/workflows/sync-homebrew-tap.yml` automates the whole "keep a separate
`sugatoray/homebrew-pptxdiff` tap repo in sync" story, in three jobs:

1. **`bump-formula`** (ubuntu, runs `sync-tap.mjs` against this repo's own `Formula/pptxdiff.rb`,
   then `npm test` for real verification) — opens a PR against **this** repo if the pin changed, so
   the monorepo's source-of-truth copy stays current release-over-release instead of drifting stale
   between manual bumps. Also stages `Formula/pptxdiff.rb`, this directory's **`brew_README.md`**
   (copied into the tap as its `README.md` — a minimal, tap-facing install doc, deliberately not
   this package's own longer `README.md`), and **`LICENSE`** as a build artifact for the next two
   jobs — the tap repo needs its own copies of all three as a standalone repo, same reason
   `pptxdiff-vscode` carries its own copy of the root `LICENSE`. `CHANGELOG.md` is NOT staged or
   copied to the tap — it's monorepo-internal history, not something the tap repo carries.
2. **`brew-audit`** (macOS, needs step 1's `should_sync` output) — runs actual
   `brew audit --strict --online`, `brew install --formula`, and `brew test` against the staged
   formula. GitHub's `macos-latest` runners ship with Homebrew preinstalled as a normal (non-root)
   user, so this is the genuine real-`brew` verification this sandbox cannot do itself (see
   `test_formula.mjs`'s own doc comment for why) — once this workflow runs for real, it closes that
   gap for good.
3. **`sync-tap-repo`** (needs both above) — checks out `sugatoray/homebrew-pptxdiff`, copies
   `Formula/pptxdiff.rb` into its `Formula/` directory and `README.md`/`LICENSE` into its repo root,
   and opens a PR there with all three.

Triggers and the `should_sync` gate, deliberate: `workflow_dispatch` (run by hand, optionally pinning
an exact version) **always** runs jobs 2 and 3 — even if the version pin itself didn't change — so a
docs-only edit (a README wording fix, a CHANGELOG entry) can be pushed to the tap on demand without
waiting for the next real version bump. The weekly `schedule` run only proceeds to jobs 2/3 when
`sync-tap.mjs` actually finds a version change, so a routine no-op week doesn't burn a macOS runner or
open an empty-diff PR. See the workflow file's own header comment for why it doesn't trigger on a
`package.json` push (npm publishing here is still a manual step, so there's no reliable "just
published" CI event to race against).

Both one-time manual setup steps are done: the `sugatoray/homebrew-pptxdiff` repo exists (with a
`HOMEBREW_TAP_TOKEN` secret on this repo scoped to it), and it has an initial commit on `master` so
`actions/checkout` has a branch to target. All three jobs now run end-to-end for real, including
job 3 opening a real PR against the tap repo (see "Installing" above for the current tap state).

**A third one-time manual step, discovered when job 1 actually ran for real (PR #60, 2026-08-10):**
job 1's own "open a PR against this repo" step needs one of the following, or it fails with
"GitHub Actions is not permitted to create or approve pull requests" — a repo-level policy gate on
`GITHUB_TOKEN`-authored PRs that a workflow's `permissions:` block cannot override:

- Enable **Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to create
  and approve pull requests"** on `sugatoray/pptxdiff` (simplest, no new secret), or
- Add a `REPO_PR_TOKEN` secret (a PAT with write access to `sugatoray/pptxdiff` itself — the
  existing `HOMEBREW_TAP_TOKEN` is scoped to the separate tap repo and isn't guaranteed to cover
  this one). The workflow already prefers this secret when present (`secrets.REPO_PR_TOKEN ||
  github.token`), so adding it needs no further workflow edit.

See `WISDOM.md` in the monorepo root's `docs/.scrolls/` for the full trap writeup.

Along the way, three more real Homebrew-CLI checks turned up that this workflow now handles —
`brew audit`/`brew install` no longer accept a bare formula path (must reference a tap-qualified
name), a freshly created local tap is untrusted until `brew trust`'d, and `brew audit --strict`
enforces formula-component ordering (`livecheck` before `depends_on`) — see `WISDOM.md` in the
monorepo root's `docs/.scrolls/` for the full trap writeups if this breaks again after a future
Homebrew release.

## License

`LICENSE` in this directory is a copy of the repo root's `LICENSE` (Apache-2.0 — the same license
the `pptxdiff` npm package ships under). Kept as a real copy here, not a symlink: this directory's
content gets pushed into the separate `sugatoray/homebrew-pptxdiff` repo by CI (see "Publishing to a
real tap" above), and a symlink to a file outside that push wouldn't resolve there — same reasoning
as why the tap sync itself is a CI job instead of a cross-repo symlink/submodule/subtree (see
GAP_CONTEXT.md). `sync-tap.mjs` does not update this copy automatically (it only touches the
formula's `url`/`sha256`) — but `test_formula.mjs` DOES check it: a new "0." assertion fails the
whole suite if this `LICENSE` ever goes byte-different from the repo root's, so an edited root
license that never got copied here shows up as a real, red test failure instead of silently drifting
and eventually shipping stale to the tap.

## Relationship to the other packages in `src/packages/`

This package wraps the **root `pptxdiff` npm package** (`src/pptxdiff/index.html` + `bin/cli.js`),
already published to npm — not `@pptxdiff/cli` or `@pptxdiff/server`, which are still
monorepo-local/unpublished (see their own `README.md`s). A future Homebrew formula for
`pptxdiff-cli` would follow the same shape once that package is published.
