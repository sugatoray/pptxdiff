---
doc_coverage:
  - id: homebrew-formula
    quality: partial
---

# Homebrew formula

PptxDiff has a [Homebrew](https://brew.sh) formula — an alternative to `npm install -g pptxdiff` for anyone who prefers `brew install`. It doesn't reimplement anything: the formula packages the exact same published npm tarball, so `brew install` and `npm install -g` produce the identical `pptxdiff` binary.

## Status

Not yet published to a real Homebrew tap — `brew install pptxdiff` doesn't work yet. Two things stand between here and there:

1. A dedicated `sugatoray/homebrew-pptxdiff` tap repository needs to exist.
2. This repo needs a `HOMEBREW_TAP_TOKEN` secret so CI can push updates to it.

Both are deliberate manual steps (creating a public repo and minting a cross-repo credential aren't things automated tooling should do unprompted) — see the formula's own [`README.md`](https://github.com/sugatoray/pptxdiff/blob/master/src/packages/pptxdiff-brew/README.md) for the exact setup checklist.

## Install today

Works right now, no tap required — install directly from the formula file:

```bash
brew install --formula https://raw.githubusercontent.com/sugatoray/pptxdiff/HEAD/src/packages/pptxdiff-brew/Formula/pptxdiff.rb
pptxdiff
```

Or from a local clone of the repo:

```bash
git clone https://github.com/sugatoray/pptxdiff.git
cd pptxdiff
brew install --formula src/packages/pptxdiff-brew/Formula/pptxdiff.rb
pptxdiff
```

Once the tap exists, installing will simplify to the familiar two-liner:

```bash
brew tap sugatoray/pptxdiff
brew install pptxdiff
```

## What the formula does

- Downloads the published `pptxdiff` npm tarball for a pinned version, verified against a pinned `sha256`.
- `depends_on "node"` — the only real runtime requirement. `bin/cli.js` is a plain Node script over `node:http`/`node:fs`/`node:path`/`node:child_process`, no native addons, no other dependencies to resolve (see [Architecture](architecture.md#runtime-dependencies-vendored-locally) for why the app itself has zero runtime deps).
- Installs into Homebrew's `libexec` and symlinks the one `pptxdiff` bin entry — no `resource` blocks needed.
- A real `test do` block starts the installed server, curls it, and asserts actual HTML comes back — not just that the formula file parses.

Running `pptxdiff` behaves identically regardless of how it was installed: a local static server on an OS-assigned loopback port, your default browser opened to it, nothing uploaded anywhere. See the [CLI reference](cli.md) for the full behavior.

## Keeping the formula current

A CI workflow (`.github/workflows/sync-homebrew-tap.yml`) keeps the formula's version pin current with npm automatically, and — once the tap repo exists — pushes the formula plus this package's `README.md`/`CHANGELOG.md`/`LICENSE` into it as a pull request. It runs on a manual trigger (anytime) and a weekly schedule (as a drift-catching safety net), and includes a real `brew audit`/`brew install`/`brew test` pass on a macOS GitHub Actions runner — genuine Homebrew verification, not just a syntax check.

## Source

The formula lives in this repository at `src/packages/pptxdiff-brew/` — see its own [`README.md`](https://github.com/sugatoray/pptxdiff/blob/master/src/packages/pptxdiff-brew/README.md) for the full maintainer-facing story (version-bump procedure, the sync workflow's design, and why a symlink/submodule/subtree couldn't be used instead of a CI job), and [`CHANGELOG.md`](changelogs/pptxdiff-brew.md) for what's changed.
