# FAQ

## Does my `.pptx` file get uploaded anywhere?

No. Parsing, rendering, and diffing all happen in your browser's memory. There's no server component beyond a static file server that serves the app itself (see [Architecture](architecture.md)).

## Does it need internet access to run?

No. React, ReactDOM, Babel-standalone, `@aiden0z/pptx-renderer`, JSZip, and fonts are all vendored locally under `src/pptxdiff/vendor/` and loaded from disk — no CDN fetch on load. The app works fully offline/air-gapped, and your `.pptx` files never leave your machine either. See [Getting Started](getting-started.md#requirements).

## A slide shows "Schematic" instead of "Rendered" — is that a bug?

No. It's a graceful fallback for a slide part the rendering library couldn't fully parse (often SmartArt, certain charts, or unusual media). PptxDiff still diffs it correctly; only the visual preview is simplified. See [Rendering fidelity](features/rendering.md).

## Can PptxDiff actually rewrite my `.pptx` file with the merge choices I picked?

Yes, with a scope limit: the beta "Merged .pptx" export produces a real, valid, openable file carrying over text/tables/background/notes/transitions — but images, charts, SmartArt, and media are dropped (only a content hash was kept, not re-embeddable bytes). The export toast says this explicitly every time. See [Three-way merge](features/merge.md).

## Will my review session (approvals/comments) still be there if I close the tab?

Yes — reviewer state is persisted to `localStorage` and restored automatically on load. To move a review session to another machine or share it with someone, use the JSON report export, then **Import report JSON…** on the other side (with a Merge/Overwrite choice if there's already local state). See [Reviewer workflow](features/reviewer-workflow.md) and [Exports](features/exports.md#report-round-trip-import).

## Does live push to Slack/Notion/Confluence actually work?

Slack is the most reliable — it uses a hidden-form POST to your incoming webhook. Notion and Confluence attempt real API calls too, but will typically fail with a CORS error from a static, client-side page (neither exposes a browser-origin-enabled write API); both fall back cleanly to a working file export with clear import instructions. See [Exports & live push](features/exports.md#live-push).

## Is this project open to contributions?

Not currently — see [Getting Started](getting-started.md#not-open-to-contributions). Issues and bug reports are welcome on [GitHub](https://github.com/sugatoray/pptxdiff/issues).

## Where's the API reference?

There isn't a conventional Python/JS "API reference" page, because PptxDiff isn't a library you import — it's a single self-contained web app plus a zero-dependency CLI launcher. The [Feature walkthrough](features/index.md) is the closest equivalent: what each part of the app does, feature by feature. See [Architecture](architecture.md) for why it's built this way, and `docs/.scrolls/DOCS.md` in the repository for the reasoning behind this documentation site's own tooling choice.
