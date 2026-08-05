# Changelog

All notable changes to the `pptxdiff` Chocolatey package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package
intends to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html), tracking the root
`pptxdiff` npm package's own version.

## [Unreleased]

### Added

- Initial Chocolatey package (`pptxdiff.nuspec`, `tools/chocolateyinstall.ps1`,
  `tools/chocolateyuninstall.ps1`, `tools/VERIFICATION.txt`). Installs/uninstalls the published
  `pptxdiff` npm package globally via `npm install --global` / `npm uninstall --global`, depending
  on the community `nodejs` package for the Node.js >= 18 runtime.
- `test_chocolatey_package.mjs` — a Red/Green regression test (no `choco`/`pwsh` needed, plain
  Node) asserting: `pptxdiff.nuspec`'s `<version>` matches the root `package.json` version and
  `tools/chocolateyinstall.ps1`'s fallback version pin; the nuspec's `nodejs` dependency's major
  version matches root `package.json`'s `engines.node` minimum; both `.ps1` scripts call the
  correct `npm install --global` / `npm uninstall --global` commands; neither `.ps1` script
  reintroduces the cmdlet-argument-mode `+`-concatenation bug (see `WISDOM.md`); `tools/LICENSE.txt`
  stays byte-identical to the root `LICENSE`; and every required companion file
  (`VERIFICATION.txt`, `README.md`, `CHANGELOG.md`) exists and is non-empty. Run via
  `node src/packages/pptxdiff-chocolatey/test_chocolatey_package.mjs`.
- Not yet submitted to the Chocolatey Community Repository — see this package's `README.md`.

### Fixed

- `tools/chocolateyuninstall.ps1` (and a first draft of `tools/chocolateyinstall.ps1`) originally
  built its warning/error messages with `Write-Warning "a" + "b"` — invalid in PowerShell's
  cmdlet-argument parsing mode, where `+` between quoted strings is a separate positional argument,
  not concatenation; this throws `A positional parameter cannot be found that accepts argument
  '+'` the first time that code path runs (npm missing, or an `npm uninstall` failure). Fixed by
  building the message into a `$msg` variable first (expression mode, where `+` does concatenate)
  and passing `$msg` to `Write-Warning`. Caught before any real `pwsh` run (none available in this
  repo's Linux dev/CI sandbox) by reasoning through PowerShell's parsing-mode rules, then locked in
  as a permanent regression check in `test_chocolatey_package.mjs`.
