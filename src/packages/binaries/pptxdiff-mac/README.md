# pptxdiff for macOS

This folder holds the built macOS artifact — not committed here, generated
by `../build.mjs`. **Must be built on an actual macOS host** (or
`macos-latest` CI runner) — see `../README.md`'s "Why `@yao-pkg/pkg`"
section for why this one target isn't cross-compiled: it needs `codesign`
(macOS-only) to be ad-hoc signed, without which the binary may not even
launch on Apple Silicon.

After a build, this folder contains:

- `pptxdiff-mac` — the standalone executable, ad-hoc signed. A true
  single file: the Node runtime AND the static app files it serves are
  both embedded inside it.

**Ad-hoc signed, not notarized.** There is no Apple Developer ID
certificate for this project, so Gatekeeper will likely block a
freshly-downloaded copy on first launch ("cannot be opened because the
developer cannot be verified") — right-click the binary → Open, or run
`xattr -d com.apple.quarantine pptxdiff-mac` first. See
`docs/.scrolls/GAP_ANALYSIS.md` for why this is a documented, accepted
tradeoff rather than an oversight.

To build (on macOS only, for a properly-signed result):
`cd src/packages/binaries && npm install && npm run build -- mac`. Building
this target from Linux/Windows produces an unsigned binary that likely
won't launch on Apple Silicon — `build.mjs` warns loudly if you try.
