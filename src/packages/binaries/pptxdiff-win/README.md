# pptxdiff for Windows

This folder holds the built Windows artifact — not committed here, generated
by `../build.mjs` (run on a Windows host or Windows CI runner; see
`../README.md`).

After a build, this folder contains:

- `pptxdiff-win.exe` — the standalone executable (bundles the Node runtime;
  no separate Node.js install needed to run it).
- `assets/` — the static app files it serves (must stay next to the `.exe`).
- `pptxdiff-win-<version>.zip` — the two above, zipped, as the actual
  downloadable artifact.

**Unsigned.** There is no code-signing certificate for this project, so
Windows SmartScreen will likely warn on first run ("Windows protected your
PC") — click "More info" → "Run anyway". See
`docs/.scrolls/GAP_ANALYSIS.md` for why this is a documented, accepted
tradeoff rather than an oversight.

To build: `cd src/packages/binaries && npm install && npm run build` (from
a Windows machine — Node's Single Executable Applications feature builds
from the currently-running platform's own Node binary, it doesn't
cross-compile).
