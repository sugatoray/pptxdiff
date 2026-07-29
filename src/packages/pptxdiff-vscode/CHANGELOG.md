# Changelog

All notable changes to the pptxdiff VS Code extension will be documented in this file.

## [0.1.7] - 2026-07-27

### Fixed

- `build.js` now also vendors `src/pptxdiff/vendor/` (React, ReactDOM, Babel, JSZip, pptx-renderer, and the Spectral font) into `media/vendor/`. The app now loads these locally by default (`?lite=1` opts into CDN sourcing instead — see the "Offline Mode" toggle added upstream); without this, the packaged extension 404'd on React itself and never booted.
- The extension's static file server now serves `.css` and `.woff2` with correct MIME types, so the vendored stylesheet and font actually apply in strict browsers.

## [0.1.4] - 2026-07-24

### Changed

- Updated README with badge, and corrected image urls for publishing on the vscode marketplace.

## [0.1.3] - 2026-07-23

### Changed

- Updated the root packaging script to write generated `.vsix` files into `src/packages/pptxdiff-vscode/dist/`.
- Ignored generated VS Code extension packages from Git.

## [0.1.2] - 2026-07-22

### Added

- Added the pptxdiff logo as the extension icon.
- Added packaging ignores so generated `.vsix` artifacts and development-only files are excluded.

## [0.1.1] - 2026-07-22

### Changed

- Updated extension packaging metadata.

## [0.1.0] - 2026-07-22

### Added

- Initial VS Code extension package for launching pptxdiff from VS Code.
