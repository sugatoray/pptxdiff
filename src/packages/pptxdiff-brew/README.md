# pptxdiff (Homebrew formula)

A [Homebrew](https://brew.sh) formula for [pptxdiff](https://github.com/sugatoray/pptxdiff),
packaged from the published npm tarball rather than reimplemented — same bytes a user would get
from `npm install -g pptxdiff`, wrapped so `brew install` works too.

## Status

Not yet published to a real Homebrew tap. `pptxdiff` (the root npm package this formula wraps) is
zero-runtime-dependency — every third-party library it needs (React, JSZip, pptx-renderer, ...) is
already vendored under `src/pptxdiff/vendor` — so packaging it for Homebrew only needed a formula
that installs the tarball and symlinks its one bin entry, no `resource` blocks for npm
dependencies.

`Language::Node`-based Node CLI formulae like this one are more Homebrew-idiomatic on the
maintainer's own machine than in this sandbox: real `brew install`/`brew audit`/`brew test` have
not been run here, and not for lack of trying — see "Why real `brew` doesn't run here" below for
what was actually attempted and why it hit a hard wall. Do that once on a real macOS/Linuxbrew
machine before treating this as fully done.

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

## Why this isn't `brew install pptxdiff` yet

Homebrew resolves a short tap name like `sugatoray/pptxdiff` to a repo literally named
`homebrew-pptxdiff`, with formulae living at that repo's own `Formula/` directory — not a
subdirectory of an unrelated monorepo. Two paths forward, neither taken yet:

1. **Install directly from this file**, no tap required (works today):

   ```sh
   brew install --formula https://raw.githubusercontent.com/sugatoray/pptxdiff/HEAD/src/packages/pptxdiff-brew/Formula/pptxdiff.rb
   ```

   or, from a local checkout of this repo:

   ```sh
   brew install --formula src/packages/pptxdiff-brew/Formula/pptxdiff.rb
   ```

2. **A dedicated `sugatoray/homebrew-pptxdiff` tap repo** that vendors (or symlinks in CI to) this
   same `Formula/pptxdiff.rb`, so `brew tap sugatoray/pptxdiff && brew install pptxdiff` works.
   Not created yet — this formula is the source of truth to copy into that tap once it exists.

## Installing

```sh
brew install --formula src/packages/pptxdiff-brew/Formula/pptxdiff.rb
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
   between manual bumps.
2. **`brew-audit`** (macOS, needs a real `changed` pin from step 1) — runs actual
   `brew audit --strict --online`, `brew install --formula`, and `brew test` against the updated
   formula. GitHub's `macos-latest` runners ship with Homebrew preinstalled as a normal (non-root)
   user, so this is the genuine real-`brew` verification this sandbox cannot do itself (see
   `test_formula.mjs`'s own doc comment for why) — once this workflow runs for real, it closes that
   gap for good.
3. **`sync-tap-repo`** (needs both above) — checks out `sugatoray/homebrew-pptxdiff` and opens a PR
   there with the same updated formula file.

Triggers: `workflow_dispatch` (run by hand right after `npm publish`, optionally pinning an exact
version) and a weekly `schedule` as a drift-catching safety net. See the workflow file's own header
comment for why it doesn't trigger on a `package.json` push (npm publishing here is still a manual
step, so there's no reliable "just published" CI event to race against).

**Two things still need one-time manual setup before job 3 can succeed** (deliberately not done by
an agent — creating a new public repo and a cross-repo credential are both real, visible actions a
human should take explicitly):

1. **Create the `sugatoray/homebrew-pptxdiff` repo** (empty is fine — the first sync PR will add
   `Formula/pptxdiff.rb`).
2. **Add a `HOMEBREW_TAP_TOKEN` secret to this repo** (Settings -> Secrets and variables -> Actions):
   a token with write + pull-request access scoped to `sugatoray/homebrew-pptxdiff` (a fine-grained
   PAT limited to that one repo is the least-privilege option; the default `GITHUB_TOKEN` cannot
   reach a different repository).

Until both exist, jobs 1 and 2 still run and are useful on their own (keeping this repo's formula
current, with real macOS `brew` verification on every version bump); job 3 fails at the checkout step
with a clear "repository not found" / auth error rather than doing anything silently wrong.

## Relationship to the other packages in `src/packages/`

This package wraps the **root `pptxdiff` npm package** (`src/pptxdiff/index.html` + `bin/cli.js`),
already published to npm — not `@pptxdiff/cli` or `@pptxdiff/server`, which are still
monorepo-local/unpublished (see their own `README.md`s). A future Homebrew formula for
`pptxdiff-cli` would follow the same shape once that package is published.
