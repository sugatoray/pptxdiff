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
- Not yet submitted to the Chocolatey Community Repository — see this package's `README.md`.
