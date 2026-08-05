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
maintainer's own machine than in CI here: this sandbox does not have Homebrew installed, so this
formula has been checked with `ruby -c` (valid Ruby syntax) but not yet run through
`brew audit`/`brew install`/`brew test` end-to-end. Do that once on a real macOS/Linuxbrew machine
before treating it as done — see "Verifying locally" below.

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

When a new `pptxdiff` version is published to npm:

1. Update the `url` in `Formula/pptxdiff.rb` to the new tarball URL.
2. Recompute the sha256 of that tarball and update `sha256`:

   ```sh
   curl -sL "https://registry.npmjs.org/pptxdiff/-/pptxdiff-<new-version>.tgz" | shasum -a 256
   ```

3. Run `brew audit --strict --online Formula/pptxdiff.rb` and
   `brew install --formula Formula/pptxdiff.rb && brew test pptxdiff` on a real Homebrew machine
   before committing.

The `livecheck` block (`strategy :npm`) lets `brew livecheck` detect new versions automatically
once this formula lives in a real tap that runs livecheck in CI.

## Relationship to the other packages in `src/packages/`

This package wraps the **root `pptxdiff` npm package** (`src/pptxdiff/index.html` + `bin/cli.js`),
already published to npm — not `@pptxdiff/cli` or `@pptxdiff/server`, which are still
monorepo-local/unpublished (see their own `README.md`s). A future Homebrew formula for
`pptxdiff-cli` would follow the same shape once that package is published.
