# pptxdiff for Linux

This folder holds the built Linux artifact — not committed here, generated
by `../build.mjs` (see `../README.md`; can be built from any host OS,
`@yao-pkg/pkg` cross-compiles it too — no Linux machine strictly needed,
though this one's easiest to verify on Linux itself).

After a build, this folder contains:

- `pptxdiff-linux` — the standalone executable. A true single file: the
  Node runtime AND the static app files it serves are both embedded
  inside it. No separate folder needed alongside it.

Run it with `chmod +x pptxdiff-linux && ./pptxdiff-linux` (the build
already sets the executable bit; re-set it if you moved/copied it
somewhere that dropped it).

Verified end-to-end in this project's own dev sandbox: built for real, the
actual packaged binary was run and confirmed to correctly serve
`index.html`/`support.js`/`vendor/*` over real HTTP requests, with zero
code changes to `bin/cli.js` itself (see `../test_build_e2e.mjs`).

To build: `cd src/packages/binaries && npm install && npm run build -- linux`.
