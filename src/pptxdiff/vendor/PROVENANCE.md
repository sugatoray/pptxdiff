# Vendored Dependency Provenance

This directory ships pre-built, third-party libraries so `pptxdiff` can run
fully offline by default (see `docs/.scrolls/HANDOFF.md`'s "fully
offline-capable" session for the full vendoring history, and
`docs/.scrolls/SECURITY_HARDENING_PLAN.md` P1 ticket 6 for why this file
exists). `manifest.json` in this same directory is the machine-checkable
source of truth for the same data below; `scripts/verify_vendor.mjs` (repo
root) re-derives each file's hash and checks it against that manifest —
run it any time you want to confirm the bytes on disk still match what's
documented here:

```sh
node scripts/verify_vendor.mjs
```

`PPTXDIFF_LITE_MODE=1` (or `?lite=1`) opts back into loading the *same*
version-pinned libraries from their original CDNs instead of these vendored
copies — see `SECURITY.md` and `bin/cli.js`. That mode is opt-in and
unaffected by anything in this file.

## Files

### vendor/react.production.min.js
- Package: react
- Version: 18.3.1
- Source: https://unpkg.com/react@18.3.1/umd/react.production.min.js
- License: MIT (src/pptxdiff/vendor/licenses/react.LICENSE)
- sha256: `d949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd`
- Note: byte-identical to the unpkg copy — cross-checked against
  `support.js`'s pre-existing `REACT_SRI` (sha384 SRI hash, used for the
  CDN/lite-mode `<script integrity="...">` tag). `scripts/verify_vendor.mjs`
  automates this cross-check.

### vendor/react-dom.production.min.js
- Package: react-dom
- Version: 18.3.1
- Source: https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js
- License: MIT (src/pptxdiff/vendor/licenses/react-dom.LICENSE)
- sha256: `35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d`
- Note: same cross-check as above, against `support.js`'s `REACT_DOM_SRI`.

### vendor/babel.min.js
- Package: @babel/standalone
- Version: 7.26.4
- Source: https://unpkg.com/@babel/standalone@7.26.4/babel.min.js
- License: MIT (src/pptxdiff/vendor/licenses/babel-standalone.LICENSE)
- sha256: `a12872ea8da3d29b2a296c51bfac7c482e81419c755f2207a49ad9b77200f4ea`

### vendor/jszip.min.js
- Package: jszip
- Version: 3.10.1
- Source: https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
- License: MIT / zlib, bundles pako (src/pptxdiff/vendor/licenses/jszip.LICENSE.markdown, pako.LICENSE)
- sha256: `acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e`
- Note: this is the browser-global `JSZip` the app itself loads via
  `index.html`'s `<script>` tag for its own zip parsing — distinct from the
  `jszip` runtime dependency bundled *inside*
  `vendor/pptx-renderer.bundle.js` below (same upstream version, separate
  artifact).

### vendor/pptx-renderer.bundle.js
- Package: @aiden0z/pptx-renderer
- Version: 1.1.0
- Source: npm:@aiden0z/pptx-renderer@1.1.0 + npm:jszip@3.10.1, esbuild-bundled
  locally (not a single fetchable CDN URL — see
  `docs/.scrolls/WISDOM.md`'s "vendoring CDN dependencies" addendum for the
  exact rebuild recipe: `npm install --no-save @aiden0z/pptx-renderer@1.1.0
  jszip@3.10.1 esbuild@<version>` in a scratch dir, then
  `esbuild entry.mjs --bundle --format=esm --platform=browser
  --target=es2020`)
- License: Apache-2.0 (src/pptxdiff/vendor/licenses/pptx-renderer.LICENSE)
- sha256: `698fefd6522b721c30700964f7e5c453927c2a95afac4ffe0304226a5524dc64`
- Note: the original `esm.sh` URL (`https://esm.sh/@aiden0z/pptx-renderer@1.1.0`,
  still used verbatim in lite mode — see `index.html`'s `LIB_URL`) transparently
  rewrites the library's own bare-specifier imports into further CDN URLs at
  request time; a plain downloaded copy would still contain an unresolvable
  bare `import "jszip"`, which is why this file is a custom bundle rather than
  a straight fetch-and-save of one URL.
- Note: this bundle also pulls in `@aiden0z/pptx-renderer`'s own runtime
  dependency, `echarts` (`^6.0.0`, used for chart rendering), and echarts'
  own dependencies `zrender` and `tslib`. `echarts` is an Apache Software
  Foundation project distributed under Apache-2.0 with a mandatory `NOTICE`
  file (ASF projects require reproducing NOTICE-file attribution text in any
  redistribution per Apache-2.0 §4(d)); that text is preserved verbatim at
  `src/pptxdiff/vendor/licenses/echarts.NOTICE`, and echarts' own LICENSE
  (`licenses/echarts.LICENSE`) is included alongside it. `zrender` is
  BSD-3-Clause (`licenses/zrender.LICENSE`, Copyright (c) 2017 Baidu Inc.).
  `tslib` is Microsoft's permissive 0BSD-style license
  (`licenses/tslib.LICENSE`). echarts' own LICENSE further discloses that a
  handful of its source files (`treemapLayout.ts`, `layoutHelper.ts`,
  `forceHelper.ts`, `number.ts`) embed BSD-3-Clause code from `d3.js`
  (Copyright 2010-2016 Mike Bostock); that subcomponent license is preserved
  at `licenses/d3.LICENSE`. None of this was previously documented here —
  see `docs/.scrolls/LICENSE_REVIEW.md` for the full compliance review and
  `docs/.scrolls/WISDOM.md`'s vendoring addendum for why this was missed the
  first time and how to avoid repeating it on the next rebuild.

### vendor/fonts/spectral-400-normal.woff2
- Package: Spectral (Google Fonts)
- Version: latin subset, weight 400 normal
- Source: https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;1,400&display=swap
- License: SIL Open Font License 1.1 (src/pptxdiff/vendor/licenses/spectral.OFL.txt)
- sha256: `cf8daee3b83c1e662196c6e34e444bc41344d54bfeb4fb5351e197de6ce94539`

### vendor/fonts/spectral-400-italic.woff2
- Package: Spectral (Google Fonts)
- Version: latin subset, weight 400 italic
- Source: https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;1,400&display=swap
- License: SIL Open Font License 1.1 (src/pptxdiff/vendor/licenses/spectral.OFL.txt)
- sha256: `db397149a9f73fd6a41dd2fdf3314cf8a9daf0485134465cc268cac578766b71`

### vendor/fonts/spectral-500-normal.woff2
- Package: Spectral (Google Fonts)
- Version: latin subset, weight 500 normal
- Source: https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;1,400&display=swap
- License: SIL Open Font License 1.1 (src/pptxdiff/vendor/licenses/spectral.OFL.txt)
- sha256: `2b70215ed40f2c73bbc7bb53cff9c8975a244c8462569e60989c77b8c5a87a00`

### vendor/fonts/spectral-600-normal.woff2
- Package: Spectral (Google Fonts)
- Version: latin subset, weight 600 normal
- Source: https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;1,400&display=swap
- License: SIL Open Font License 1.1 (src/pptxdiff/vendor/licenses/spectral.OFL.txt)
- sha256: `33faca8b5795a0de1af77cbc43a050a3655c4b1e03e04847fdef4d19d2e361d2`

### vendor/fonts/spectral.css
- Package: Spectral (Google Fonts) @font-face CSS
- Version: hand-authored, mirrors the Google Fonts css2 response shape for
  the vendored subset above
- Source: https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;1,400&display=swap
- License: SIL Open Font License 1.1 (src/pptxdiff/vendor/licenses/spectral.OFL.txt)
- sha256: `0a32fec8b83fbbb191b2f56c8662a712dce917f51480bdb70e186a7d7f127897`
- Note: per `docs/.scrolls/WISDOM.md`'s font-vendoring addendum, this is
  deliberately a **latin-only** subset (the app is English-only today) —
  vendoring a `@font-face` gives up the browser's automatic
  `unicode-range`-based subset negotiation that Google Fonts' live CSS
  response provides, so non-Latin text falls back to the browser default
  font. This is a documented tradeoff, not an oversight (see
  `docs/.scrolls/GAP_ANALYSIS.md`).

## Keeping this file in sync

If a vendored file is ever updated (a version bump, a re-run of the
`pptx-renderer.bundle.js` rebuild recipe, a font re-subset), update **both**
this file and `manifest.json` with the new version/source/hash — then run
`node scripts/verify_vendor.mjs` to confirm they agree with each other and
with the bytes on disk. `verify_vendor.mjs` treats a hash-string mismatch
between this file and `manifest.json` as a failure, so an update to only one
of the two will be caught.

For any bundle produced by esbuild (or any other bundler) rather than a
straight fetch-and-save of one upstream file — currently only
`pptx-renderer.bundle.js` — also re-check the *runtime* dependencies of the
bundled package itself, not just the package named in the rebuild recipe.
`@aiden0z/pptx-renderer`'s own `package.json` lists `echarts` as a
dependency, which pulled in `zrender`, `tslib`, and an embedded d3.js
fragment — none of which were caught the first time this bundle was
vendored, because the review only looked at the top-level package's own
license. `npm view <package> dependencies` (recursively, for anything with
its own further dependencies) is the fastest way to catch this before it
ships undocumented again.
