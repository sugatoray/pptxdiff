# Rendering fidelity

PptxDiff parses real `.pptx` files — full OOXML: slides, relationships, layouts, masters, themes, notes, charts, tables, diagrams — using JSZip in the browser. Nothing is converted server-side; there is no server.

## Rendered vs. Schematic

Each slide preview carries a badge showing how it was drawn:

- **Rendered** — the slide was handed to [`@aiden0z/pptx-renderer`](https://www.npmjs.com/package/@aiden0z/pptx-renderer) (vendored locally as a self-contained bundle, not loaded from a CDN), which parses the zip, builds an internal presentation model, and paints a pixel-accurate thumbnail into the DOM: `parseZip → buildPresentation → PptxViewer.renderThumbnailToContainer`.
- **Schematic** — a graceful fallback. If a part can't be parsed by the renderer, PptxDiff draws a simplified box-and-text representation instead of failing outright.

This fallback is what lets the app stay usable even against decks with unusual or partially-invalid parts, rather than refusing to diff them.

## Change-highlight overlays

On top of the real (or schematic) render, PptxDiff draws highlight boxes for anything that differs — outline colors are keyed to diff status:

- **Changed** elements get one outline color
- **Added** elements (present only in the After slide) get another
- **Removed** elements (present only in the Before slide) get a third

This lets you *see* where on the slide a change lives, not just read it in a list below.

## Known rendering limitations

- **Slide master & layout thumbnails** are schematic (dashed rectangles from placeholder geometry) rather than pixel-perfect — the renderer library only renders slides, not raw layout/master parts. You'll still see the layout name and theme name resolved correctly per side.
- **Transition preview** shows the After slide's transition type/speed plus a simplified crossfade swatch — not a literal PowerPoint transition render. This is a deliberate, clearly-labeled simplification, not a bug.

See [Limitations](../limitations.md) for the full list of known, accepted trade-offs.
