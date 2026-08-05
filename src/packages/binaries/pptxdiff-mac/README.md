# pptxdiff for macOS

This folder holds the built macOS artifact — not committed here, generated
by `../build.mjs` (run on a macOS host or macOS CI runner; see
`../README.md`).

After a build, this folder contains:

- `pptxdiff-mac` — the standalone executable (bundles the Node runtime; no
  separate Node.js install needed to run it), ad-hoc signed.
- `assets/` — the static app files it serves (must stay next to the binary).
- `pptxdiff-mac-<version>.zip` — the two above, zipped, as the actual
  downloadable artifact.

**Ad-hoc signed, not notarized.** There is no Apple Developer ID
certificate for this project, so Gatekeeper will likely block a
freshly-downloaded copy on first launch ("cannot be opened because the
developer cannot be verified") — right-click the binary → Open, or run
`xattr -d com.apple.quarantine pptxdiff-mac` first. See
`docs/.scrolls/GAP_ANALYSIS.md` for why this is a documented, accepted
tradeoff rather than an oversight.

To build: `cd src/packages/binaries && npm install && npm run build` (from
a macOS machine — Node's Single Executable Applications feature builds
from the currently-running platform's own Node binary, it doesn't
cross-compile).
