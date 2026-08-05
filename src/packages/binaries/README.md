# @pptxdiff/binaries

Builds standalone, native `pptxdiff` executables for Windows, macOS, and
Linux — download one file (well, one file plus its `assets/` folder,
zipped together), run it, and pptxdiff opens in your browser. No Node.js
install, no `npm install -g`, no `npx`.

This is deliberately **not** a real OS installer (no `.msi`/`.pkg`/`.deb`
wizard, no PATH registration, no entry in Add/Remove Programs) — see
`docs/.scrolls/GAP_CONTEXT.md` for why: this project already made an
explicit, reasoned call to avoid Electron/Tauri-style installer and
code-signing overhead when it chose the CLI+browser architecture over a
native-window app, and building real signed installers would mean
reversing that without a corresponding ask. A standalone executable gets
"download and run, no Node.js required" — the actual pain point — without
that cost.

## How it works

[Node's Single Executable Applications (SEA)](https://nodejs.org/api/single-executable-applications.html)
feature injects a JS blob into a **copy of the currently-running `node`
binary**. `build.mjs`:

1. Bundles `sea-entry.cjs` (which reuses `bin/cli.js`'s existing
   `startServer()`/`buildBrowserOpenCommand()` — no server logic is
   duplicated) into one flat CommonJS file via `esbuild`.
2. Generates the SEA blob (`node --experimental-sea-config`).
3. Copies `process.execPath` and injects the blob via `postject`.
4. Copies the same static app files the npm package ships
   (`index.html`/`support.js`/`sample-pptx.js`/`vendor/`) into an
   `assets/` folder next to the built binary — `sea-entry.cjs` resolves
   `root` from `path.dirname(process.execPath)` at runtime, since a
   packaged executable has no `__dirname`-relative sibling files of its
   own the way an npm-installed package does.
5. Zips the binary + `assets/` into `pptxdiff-<os>-<version>.zip`, the
   actual downloadable artifact.

## Building locally

```sh
cd src/packages/binaries
npm install
npm run build   # or: make pkg.binaries.build, from the repo root
```

Output lands in `./pptxdiff-<win|mac|linux>/` — whichever one matches the
OS you ran this on. **SEA has no cross-compilation mode**: this only ever
builds for the platform it's currently running on. To get all three, run
it on all three platforms — `.github/workflows/binaries.yml` does exactly
that via a `windows-latest`/`macos-latest`/`ubuntu-latest` CI matrix and
uploads each as a workflow artifact.

Each OS folder keeps a tracked `README.md` (usage/known-warnings) and
`CHANGELOG.md` (Keep a Changelog, tracks the bundled `pptxdiff` app
version) — `build.mjs` only ever removes the specific files/folders it
itself generates (the binary, `assets/`, `*.zip`), never those two, even
across repeated builds.

## Testing (Red/Green TDD)

```sh
npm test        # fast, pure — PLATFORM_MAP/ASSET_ENTRIES/resolveTarget shape,
                 # an ASSET_ENTRIES-vs-root-package.json drift guard, and a
                 # regression guard on bin/cli.js's startServer(root = ROOT)
                 # signature this whole feature depends on
npm run test:e2e # slow, real — builds an actual binary for the CURRENT host
                 # OS and drives it over real HTTP (index.html/support.js/
                 # vendor/* + a path-traversal check), same split as
                 # pptxdiff-cli's `npm test` vs `npm run test:difftool`
```

`test:e2e` only exercises the current host's platform branch — the other
two OS branches are structurally identical (same `build.mjs`, only the
codesign step differs) but only actually built-and-run by CI's 3-OS
matrix.

## Known gaps (see `docs/.scrolls/GAP_ANALYSIS.md`)

- **Unsigned/ad-hoc-signed.** No code-signing certificate — Windows
  SmartScreen and macOS Gatekeeper will warn on a freshly-downloaded copy.
  Documented per-OS in each `pptxdiff-<os>/README.md`.
- **Not attached to GitHub Releases yet.** The CI workflow currently only
  uploads build artifacts on push/dispatch; wiring a release-tag trigger
  to attach the zips to a GitHub Release is a follow-up, not done here.
- **~120MB per binary.** SEA embeds the entire Node runtime — there's no
  way around this with the SEA approach itself (it's not a JS-only
  bundle-size problem).
