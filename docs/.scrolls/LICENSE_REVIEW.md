# Vendored License Review

This note records the license review for the offline vendored assets under
`src/pptxdiff/vendor/`. `pptxdiff` itself is distributed under Apache-2.0, as
declared in the repository root `LICENSE`, `package.json`, and packaged
extension metadata.

This is an engineering compliance review, not legal advice. The conclusion is
that vendoring these libraries for offline/air-gapped use does not violate the
licenses listed below, provided the license files in
`src/pptxdiff/vendor/licenses/` continue to be distributed with the vendored
assets.

| Vendored asset | Vendored file(s) | License | Included license notice | Review conclusion |
| --- | --- | --- | --- | --- |
| React | `src/pptxdiff/vendor/react.production.min.js` | MIT | `src/pptxdiff/vendor/licenses/react.LICENSE` | Vendoring does not violate the MIT license. The MIT license permits use, copying, modification, publication, distribution, sublicensing, and sale, provided the copyright and permission notices are included. The vendored file keeps its upstream license header and the license text is shipped alongside it. |
| ReactDOM | `src/pptxdiff/vendor/react-dom.production.min.js` | MIT | `src/pptxdiff/vendor/licenses/react-dom.LICENSE` | Vendoring does not violate the MIT license. The vendored file keeps its upstream license header and the full MIT notice is shipped with the vendored assets. |
| Babel standalone | `src/pptxdiff/vendor/babel.min.js` | MIT | `src/pptxdiff/vendor/licenses/babel-standalone.LICENSE` | Vendoring does not violate the MIT license. Redistribution is allowed as long as the copyright and permission notices are included, which this repository does through the license file. |
| JSZip | `src/pptxdiff/vendor/jszip.min.js` | MIT or GPL-3.0, at distributor choice | `src/pptxdiff/vendor/licenses/jszip.LICENSE.markdown` | Vendoring does not violate JSZip's license terms. `pptxdiff` relies on the permissive MIT option, which is compatible with Apache-2.0 distribution when the MIT copyright and permission notices are preserved. The JSZip license file is shipped with the vendored asset. |
| pako, bundled inside JSZip | Included within `src/pptxdiff/vendor/jszip.min.js` and within the JSZip copy bundled in `src/pptxdiff/vendor/pptx-renderer.bundle.js` | MIT | `src/pptxdiff/vendor/licenses/pako.LICENSE` | Vendoring does not violate the MIT license. JSZip identifies pako as an MIT-licensed dependency, and the pako MIT license text is now included in the vendored license directory. |
| Spectral font subset | `src/pptxdiff/vendor/fonts/spectral-*.woff2` and `src/pptxdiff/vendor/fonts/spectral.css` | SIL Open Font License 1.1 | `src/pptxdiff/vendor/licenses/spectral.OFL.txt` | Vendoring does not violate the OFL. The font files are bundled with the application, not sold by themselves, and the OFL text is included. The subset continues to use the Spectral family name for the original font assets; no derivative font naming claim is introduced here. |
| `@aiden0z/pptx-renderer` | `src/pptxdiff/vendor/pptx-renderer.bundle.js` | Apache-2.0 | `src/pptxdiff/vendor/licenses/pptx-renderer.LICENSE` | Vendoring does not violate Apache-2.0. Apache-2.0 permits copying, modification, and distribution when the license text and required notices are preserved. The upstream npm package includes a `LICENSE` file and no separate `NOTICE` file; the Apache-2.0 license text is now included in the vendored license directory. (`manifest.json`/`PROVENANCE.md` previously mislabeled this file's own license as "MIT" — corrected to Apache-2.0 to match this table and the actual license text shipped.) |
| `echarts`, bundled inside `@aiden0z/pptx-renderer`'s own dependency tree | Included within `src/pptxdiff/vendor/pptx-renderer.bundle.js` | Apache-2.0, with a mandatory `NOTICE` file (Apache Software Foundation project) | `src/pptxdiff/vendor/licenses/echarts.LICENSE`, `src/pptxdiff/vendor/licenses/echarts.NOTICE` | Vendoring does not violate Apache-2.0. This dependency was not previously identified or documented — `@aiden0z/pptx-renderer`'s `package.json` lists `echarts` as a runtime dependency (`^6.0.0`), and it is compiled into the bundle (chart-type/renderer strings for it are present in the vendored file). As an ASF project, echarts ships a `NOTICE` file whose attribution text must be reproduced in any redistribution per Apache-2.0 §4(d); that text is now included verbatim. |
| `zrender`, echarts' own rendering dependency | Included within `src/pptxdiff/vendor/pptx-renderer.bundle.js` | BSD-3-Clause | `src/pptxdiff/vendor/licenses/zrender.LICENSE` | Vendoring does not violate the BSD-3-Clause license. BSD-3-Clause permits redistribution in binary form provided the copyright notice, condition list, and disclaimer are reproduced "in the documentation and/or other materials provided with the distribution," which this repository satisfies via the included license file. BSD-3-Clause is compatible with bundling into an Apache-2.0-licensed distribution. |
| `d3.js` fragment, embedded inside echarts (`treemapLayout.ts`, `layoutHelper.ts`, `forceHelper.ts`, `number.ts`) | Included within `src/pptxdiff/vendor/pptx-renderer.bundle.js` (via echarts) | BSD-3-Clause | `src/pptxdiff/vendor/licenses/d3.LICENSE` | Vendoring does not violate the BSD-3-Clause license, for the same reasons as zrender above. echarts' own `LICENSE` file discloses this subcomponent explicitly and points to a separate license file for it, which is preserved here under the same name. |
| `tslib`, echarts' TypeScript helper dependency | Included within `src/pptxdiff/vendor/pptx-renderer.bundle.js` (via echarts) | 0BSD-style (Microsoft) | `src/pptxdiff/vendor/licenses/tslib.LICENSE` | Vendoring does not violate this license. It is a maximally permissive license (use, copy, modify, and/or distribute for any purpose, with or without fee, with no notice-retention condition); including the license text here is a courtesy, not a compliance requirement. |

## Compatibility Summary

The vendored assets are under permissive licenses (MIT, BSD-3-Clause, 0BSD,
Apache-2.0, SIL OFL) or, for JSZip, a dual license where the MIT option can be
used. MIT, BSD-3-Clause, 0BSD, and OFL assets can all be bundled with an
Apache-2.0 project when their notices remain available. The
`@aiden0z/pptx-renderer` vendored bundle is itself Apache-2.0, matching
`pptxdiff`'s project license family, but also compiles in several further
dependencies pulled in transitively (`echarts`, `zrender`, an embedded d3.js
fragment, and `tslib` — see the table above) that were not part of the
original review; each has now been reviewed individually and none is
copyleft. `echarts` is the one entry here with an affirmative obligation
beyond "keep the license text available": as an Apache Software Foundation
project it ships a `NOTICE` file, and Apache-2.0 §4(d) requires that
NOTICE's attribution text be reproduced in any redistribution — satisfied by
`src/pptxdiff/vendor/licenses/echarts.NOTICE`. No reviewed vendored asset
requires changing `pptxdiff` away from Apache-2.0.

## Maintenance Notes

- Keep `src/pptxdiff/vendor/licenses/` included in package outputs whenever
  vendored assets are included.
- If any vendored library is updated, re-check its upstream `LICENSE`, `NOTICE`,
  package metadata, and bundled transitive dependency notices.
- For any bundle built with a bundler (esbuild, webpack, etc.) rather than a
  straight fetch-and-save of one upstream file, check the *bundled* package's
  own dependency tree (`npm view <package> dependencies`, recursively), not
  just the top-level package being vendored — this is exactly how `echarts`,
  `zrender`, `tslib`, and the embedded d3.js fragment went undocumented after
  `pptx-renderer.bundle.js` was first vendored: the review checked
  `@aiden0z/pptx-renderer`'s own license but not what esbuild had pulled in
  underneath it.
- If a future vendored dependency introduces copyleft-only terms, patent notice
  obligations, trademark restrictions, or a separate `NOTICE` file, update this
  review before release.
