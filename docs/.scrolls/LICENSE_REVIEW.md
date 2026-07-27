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
| `@aiden0z/pptx-renderer` | `src/pptxdiff/vendor/pptx-renderer.bundle.js` | Apache-2.0 | `src/pptxdiff/vendor/licenses/pptx-renderer.LICENSE` | Vendoring does not violate Apache-2.0. Apache-2.0 permits copying, modification, and distribution when the license text and required notices are preserved. The upstream npm package includes a `LICENSE` file and no separate `NOTICE` file; the Apache-2.0 license text is now included in the vendored license directory. |

## Compatibility Summary

The vendored assets are under permissive licenses or, for JSZip, a dual license
where the MIT option can be used. MIT and OFL assets can be bundled with an
Apache-2.0 project when their notices remain available. The
`@aiden0z/pptx-renderer` vendored bundle is itself Apache-2.0, matching
`pptxdiff`'s project license family. No reviewed vendored asset requires
changing `pptxdiff` away from Apache-2.0.

## Maintenance Notes

- Keep `src/pptxdiff/vendor/licenses/` included in package outputs whenever
  vendored assets are included.
- If any vendored library is updated, re-check its upstream `LICENSE`, `NOTICE`,
  package metadata, and bundled transitive dependency notices.
- If a future vendored dependency introduces copyleft-only terms, patent notice
  obligations, trademark restrictions, or a separate `NOTICE` file, update this
  review before release.
