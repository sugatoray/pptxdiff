# @pptxdiff/binaries

Builds standalone, native `pptxdiff` executables for Windows, macOS, and
Linux — download one file, run it, and pptxdiff opens in your browser. No
Node.js install, no `npm install -g`, no `npx`.

This is deliberately **not** a real OS installer (no `.msi`/`.pkg`/`.deb`
wizard, no PATH registration, no entry in Add/Remove Programs) — see
`docs/.scrolls/GAP_CONTEXT.md` for why: this project already made an
explicit, reasoned call to avoid Electron/Tauri-style installer and
code-signing overhead when it chose the CLI+browser architecture over a
native-window app, and building real signed installers would mean
reversing that without a corresponding ask. A standalone executable gets
"download and run, no Node.js required" — the actual pain point — without
that cost.

## Why `@yao-pkg/pkg`, not Node's own SEA feature

This package originally used Node's built-in Single Executable
Applications (SEA) feature. Switched to `@yao-pkg/pkg` (the
actively-maintained community fork of the Vercel-archived `pkg`) after an
explicit question about it, for two concrete reasons SEA can't match:

1. **Real cross-compilation.** `pkg` downloads a prebuilt "base" node
   binary per target platform and injects the bundled app into it — one
   Linux host can build the Windows AND Linux binaries. SEA injects into a
   copy of the *currently running* node binary, so it can only ever build
   for the OS it's actually running on (the old 3-OS CI matrix existed
   solely to work around that).
2. **Built-in asset embedding.** `pkg`'s snapshot filesystem preserves the
   real project's relative directory structure at runtime, so
   `bin/cli.js`'s existing, UNMODIFIED `ROOT = path.join(__dirname, "..",
   "src", "pptxdiff")` resolution just works — no `assets/` folder
   shipped alongside the binary, no `root` parameter added to `bin/cli.js`
   for packaging's sake. A true single file.

The tradeoff: one more third-party build-tool devDependency (dev-time
only — never shipped in the binaries or the npm package), vs. a fork of a
project Vercel walked away from. Judged worth it for the two wins above;
see `docs/.scrolls/GAP_CONTEXT.md` for the full reasoning.

**macOS is the one target NOT cross-compiled here.** `pkg` CAN produce a
macOS binary from Linux, but it can't codesign it (`codesign` only exists
on macOS) — and on Apple Silicon, a completely unsigned binary may not
even *launch* (AMFI requires at least an ad-hoc signature, not just a
Gatekeeper warning the way Intel Macs work). So the mac target only runs
its codesign step when actually built on a macOS host — see
`.github/workflows/binaries.yml`'s separate `build-mac` job.

## How it works

`build.mjs`'s `buildOne(osKey, target)`:

1. Writes a temporary pkg config (`{"assets": [...]}` — the same static
   files the npm package ships: `index.html`/`support.js`/
   `sample-pptx.js`/`vendor/**`) **directly at the repo root**, next to the
   real `package.json`. This placement matters — see "A hard-won gotcha"
   below.
2. Calls `@yao-pkg/pkg`'s `exec()` with `bin/cli.js` as the entry, that
   config, and the target platform string (e.g. `node22-linux-x64`).
3. On the `mac` target, ad-hoc codesigns the result if running on an
   actual macOS host (`codesign --sign -`); otherwise warns loudly that
   the binary is unsigned rather than silently shipping it.
4. Removes the temporary config in a `finally` block, success or failure.

### A hard-won gotcha (see `docs/.scrolls/WISDOM.md`)

`pkg`'s `"assets"` glob paths in a config file resolve relative to
**wherever that config file itself lives** — not the process's cwd, not
the entry file's directory. Get this wrong and the failure is silent: no
error, no warning, the binary just embeds zero assets and 404s on every
request at runtime. This is why the config is written to `REPO_ROOT`
(where `src/pptxdiff/**` actually resolves) rather than kept as a normal
tracked file inside this package's own directory.

## Building locally

```sh
cd src/packages/binaries
npm install
npm run build              # builds all three (win/mac/linux) by default
npm run build -- linux win # or build a specific subset
```

Output lands in `./pptxdiff-<win|mac|linux>/<binary>` — one file per OS,
nothing else needed alongside it. Each OS folder keeps a tracked
`README.md` (usage/known-warnings) and `CHANGELOG.md` (Keep a Changelog,
tracks the bundled `pptxdiff` app version) — `build.mjs` only ever
touches the binary file itself, never those two.

## Testing (Red/Green TDD)

```sh
npm test          # fast, pure — TARGET_MAP/ASSET_GLOBS shape, a drift
                   # guard against root package.json's "files", and a
                   # regression guard on the config-colocation gotcha above
npm run test:e2e  # slow, real — builds an actual binary for the CURRENT
                   # host OS and drives it over real HTTP (index.html/
                   # support.js/vendor/* + a path-traversal check)
```

`test:e2e` only exercises the current host's own target — win/mac are
structurally identical (same `buildOne()`, only the mac codesign branch
differs) but only actually built-and-run by CI.

## Known gaps (see `docs/.scrolls/GAP_ANALYSIS.md`)

- **Unsigned Windows `.exe` / ad-hoc-signed-only macOS binary.** No
  code-signing certificate — Windows SmartScreen and macOS Gatekeeper will
  warn on a freshly-downloaded copy. Documented per-OS in each
  `pptxdiff-<os>/README.md`.
- **Not attached to GitHub Releases yet.** CI currently only uploads build
  artifacts on push/dispatch; wiring a release-tag trigger to attach them
  to a GitHub Release is a follow-up, not done here.
- **x64 only, no native arm64 build** for any OS (matches the original
  scope) — an Apple Silicon Mac runs the x64 binary via Rosetta 2.
