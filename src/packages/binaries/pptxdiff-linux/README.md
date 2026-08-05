# pptxdiff for Linux

This folder holds the built Linux artifact — not committed here, generated
by `../build.mjs` (run on a Linux host or Linux CI runner; see
`../README.md`).

After a build, this folder contains:

- `pptxdiff-linux` — the standalone executable (bundles the Node runtime;
  no separate Node.js install needed to run it).
- `assets/` — the static app files it serves (must stay next to the
  binary).
- `pptxdiff-linux-<version>.zip` — the two above, zipped, as the actual
  downloadable artifact.

Run it with `chmod +x pptxdiff-linux && ./pptxdiff-linux` (the build
already sets the executable bit; re-set it if you unzipped the artifact
somewhere that dropped it).

To build: `cd src/packages/binaries && npm install && npm run build` (from
a Linux machine — Node's Single Executable Applications feature builds
from the currently-running platform's own Node binary, it doesn't
cross-compile).
