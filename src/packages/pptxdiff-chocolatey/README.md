# pptxdiff (Chocolatey package)

A [Chocolatey](https://chocolatey.org/) package for [pptxdiff](https://github.com/sugatoray/pptxdiff),
letting Windows users install it with:

```powershell
choco install pptxdiff
```

## What this package actually does

pptxdiff ships as an npm CLI (`bin/cli.js` in the repo root, published to npm as the `pptxdiff`
package — see the root `README.md`'s "Option B — npm (global install)"). This is not a
standalone compiled binary, so this Chocolatey package is a thin wrapper: it depends on the
community `nodejs` package (Node.js >= 18, matching the root `package.json`'s `engines.node`) and
its install script runs

```powershell
npm install --global pptxdiff@<version>
```

Uninstalling runs `npm uninstall --global pptxdiff`. No files are embedded in this package beyond
the install/uninstall scripts themselves — see `tools/VERIFICATION.txt` for the full trust
rationale (this is a documented Chocolatey convention for packages that don't embed binaries).

## Files

- `pptxdiff.nuspec` — package metadata. **Keep `<version>` in sync with the root
  `package.json`'s `version`** (and with the version pinned as a fallback inside
  `tools/chocolateyinstall.ps1`) whenever a new pptxdiff release ships.
- `tools/chocolateyinstall.ps1` — runs `npm install --global pptxdiff@<version>`.
- `tools/chocolateyuninstall.ps1` — runs `npm uninstall --global pptxdiff`.
- `tools/VERIFICATION.txt` — Chocolatey moderation requirement explaining how to verify this
  package's contents, since it has no binary payload of its own.
- `tools/LICENSE.txt` — a copy of the project's Apache-2.0 `LICENSE`, for offline reference.
- `test_chocolatey_package.mjs` — a plain-Node Red/Green regression test (no `choco`/`pwsh`
  required). See "Regression testing" below.

## Regression testing

This repo's dev/CI environment is Linux, so there's no `choco`/`pwsh` here to actually run
`choco pack`/`choco install` (see "Building and testing locally" below for how to do that on a
real Windows machine). What *can* run anywhere is a static-analysis regression test, in the same
spirit as the root project's `src/pptxdiff/test_offline_capable.mjs`:

```sh
node src/packages/pptxdiff-chocolatey/test_chocolatey_package.mjs
```

It checks the things most likely to silently drift or break without an interpreter to catch them:
`pptxdiff.nuspec`'s `<version>` staying in sync with the root `package.json` version and with
`tools/chocolateyinstall.ps1`'s fallback version pin; the nuspec's `nodejs` dependency version
staying in sync with root `package.json`'s `engines.node`; both `.ps1` scripts calling the correct
`npm install --global` / `npm uninstall --global` commands; neither script reintroducing the
PowerShell cmdlet-argument-mode `+`-string-concatenation bug documented in the root project's
`docs/.scrolls/WISDOM.md` (it looks like valid string concatenation but isn't, and throws only the
first time that code path actually runs); `tools/LICENSE.txt` staying byte-identical to the root
`LICENSE`; and every required companion file existing and non-empty. Run it after editing anything
in this package, especially before bumping `<version>` for a release.

## Building and testing locally (on Windows, with Chocolatey installed)

```powershell
cd src\packages\pptxdiff-chocolatey
choco pack
choco install pptxdiff -source . -y
pptxdiff   # should start the local server and open the app
choco uninstall pptxdiff -y
```

This repo's own development/CI environment is Linux, so `choco pack`/`choco install` can't be run
here — the package is authored and reviewed as plain text (nuspec XML + PowerShell) and verified
on a real Windows machine or CI runner before being pushed to the Chocolatey community repository.

## Publishing

Publishing a new version to the [Chocolatey Community Repository](https://community.chocolatey.org/packages)
requires an API key (`choco apikey`) and is a manual, deliberate step — not run automatically by
this repo's CI. After bumping `<version>` in `pptxdiff.nuspec` to match a new npm release:

```powershell
choco pack
choco push pptxdiff.<version>.nupkg --source https://push.chocolatey.org/
```

## Known limitations

- Requires Node.js (>= 18) — pulled in as a Chocolatey dependency on `nodejs`, adding to the
  install footprint versus a single self-contained `.exe`. There's no native Windows binary of
  pptxdiff; this is the same tradeoff the npm/npx install paths already have.
- `pptxdiff` opens your default browser to a locally-served page — it is not a native desktop
  window (no taskbar/dock icon of its own), matching the existing "not a true desktop app" gap
  documented in the root project's `docs/.scrolls/GAP_ANALYSIS.md`.
- This package is authored here but has not yet been submitted to / approved on the Chocolatey
  Community Repository — `choco install pptxdiff` will not work until that submission happens.
