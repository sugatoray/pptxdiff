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
   binary per target platform+arch and injects the bundled app into it —
   one Linux host can build the Windows AND Linux binaries, x64 AND arm64
   (confirmed directly: real `ELF ... ARM aarch64` and `PE32+ ... Aarch64`
   executables, both built on this project's own x64 Linux dev sandbox).
   SEA injects into a copy of the *currently running* node binary, so it
   can only ever build for the OS+arch it's actually running on (the old
   3-OS CI matrix existed solely to work around that).
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

**macOS is the one OS NOT cross-compiled here** (for either chip). `pkg`
CAN produce macOS binaries from Linux, but it can't codesign them
(`codesign` only exists on macOS) — and on Apple Silicon, a completely
unsigned binary may not even *launch* (AMFI requires at least an ad-hoc
signature, not just a Gatekeeper warning the way Intel Macs work; `pkg`
itself prints this exact warning if you try). So both mac targets only run
their codesign step when actually built on a macOS host — see
`.github/workflows/binaries.yml`'s separate `build-mac` job. (`pkg` does
mention one Linux-side workaround — installing the `ldid` utility so it
can ad-hoc-sign Mach-O binaries without a real Mac at all — not pursued
here; a real `macos-latest` CI runner was judged simpler and more
reliable than depending on a third tool for signing.)

## arm64 targets

Six targets exist total, two per OS, sharing one output folder each:

| osKey | pkg target | binary | chip |
|---|---|---|---|
| `linux` | `node22-linux-x64` | `pptxdiff-linux` | x64 |
| `linux-arm64` | `node22-linux-arm64` | `pptxdiff-linux-arm64` | arm64 |
| `win` | `node22-win-x64` | `pptxdiff-win.exe` | x64 |
| `win-arm64` | `node22-win-arm64` | `pptxdiff-win-arm64.exe` | arm64 |
| `mac` | `node22-macos-x64` | `pptxdiff-mac` | Intel |
| `mac-arm64` | `node22-macos-arm64` | `pptxdiff-mac-arm64` | Apple Silicon (native) |

`TARGET_MAP` entries share an `outDirKey` (e.g. `"mac"` for both mac
targets) separate from their own map key, specifically so multiple chip
variants of the same OS land in one folder — see `build.mjs`'s
`buildOne()`.

**Cross-ARCH builds need `--fallback-to-source`.** Generating V8 bytecode
for a foreign architecture requires running a matching-arch "fabricator"
helper — confirmed directly: attempting `node22-linux-arm64` from this
project's x64 sandbox without the flag failed with a genuine exec-format
error (the shell tried to interpret the arm64 ELF helper's raw bytes as a
script). `--fallback-to-source` ships the entry as plain JS instead of
precompiled bytecode whenever that happens — a real, worthwhile tradeoff
here (this is already-open-source code; bytecode's only benefit is
marginal startup speed and minor reverse-engineering friction, neither
worth a hard build failure). Harmless for same-arch builds, where
bytecode generation just succeeds and the flag is never invoked.

macOS is the one OS where arm64 isn't "just another cross-compiled
target" — without a native arm64 build, an Apple Silicon Mac could only
run the Intel binary via Rosetta 2 translation (extra launch overhead,
and Rosetta isn't guaranteed pre-installed on a fresh Mac). Windows/Linux
arm64 desktops are a comparatively small fraction of this app's likely
audience, so those two targets exist for completeness/parity rather than
a specific reported need — see `docs/.scrolls/GAP_CONTEXT.md`.

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
npm run build                                      # builds all six targets by default
npm run build -- linux linux-arm64 win win-arm64    # or build a specific subset
npm run build -- mac mac-arm64                      # (on macOS, for a properly-signed result)
```

Output lands in `./pptxdiff-<win|mac|linux>/<binary>` — one file per
target, nothing else needed alongside it (each OS's two chip variants
share one folder). Each OS folder keeps a tracked `README.md`
(usage/known-warnings) and `CHANGELOG.md` (Keep a Changelog, tracks the
bundled `pptxdiff` app version) — `build.mjs` only ever touches the
specific binary file it's building, never those two or any other target's
binary.

## Testing (Red/Green TDD)

```sh
npm test          # fast, pure — TARGET_MAP/ASSET_GLOBS shape, a drift
                   # guard against root package.json's "files", and a
                   # regression guard on the config-colocation gotcha above
npm run test:e2e  # slow, real — builds an actual binary for the CURRENT
                   # host OS and drives it over real HTTP (index.html/
                   # support.js/vendor/* + a path-traversal check)
```

`test:e2e` only exercises the current host's own target — it picks the
`-arm64` variant of whatever OS it's running on when the HOST's actual
`os.arch()` is arm64, so an arm64 CI runner (or Apple Silicon macOS one)
genuinely tests the native build, not the x64 one. Every target is
structurally identical (same `buildOne()`, only the mac codesign branch
differs) but only actually built-and-run by CI — this sandbox is x64, so
only `linux`/`win`/`mac`'s x64 code paths are actually EXECUTED locally;
the four arm64 targets are structurally verified (real builds via
`buildOne()`, confirmed via `file`) but not run.

## Known gaps (see `docs/.scrolls/GAP_ANALYSIS.md`)

- **Unsigned Windows `.exe`s / ad-hoc-signed-only macOS binaries.** No
  code-signing certificate — Windows SmartScreen and macOS Gatekeeper will
  warn on a freshly-downloaded copy. Documented per-OS in each
  `pptxdiff-<os>/README.md`.
- **Not attached to GitHub Releases yet.** CI currently only uploads build
  artifacts on push/dispatch; wiring a release-tag trigger to attach them
  to a GitHub Release is a follow-up, not done here.
- **`ldid` (Linux-side macOS signing) not pursued** — see "arm64 targets"
  above; would let `build-mac` fold into the cross-compiled Linux job.
