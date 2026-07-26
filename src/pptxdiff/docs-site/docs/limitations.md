---
doc_coverage:
  - id: reviewer-workflow-limitations
    quality: complete
  - id: transitions-limitations
    quality: complete
  - id: rendering-limitations
    quality: complete
  - id: exports-limitations
    quality: complete
---

# Known limitations

These are documented, accepted trade-offs — not bugs waiting to be fixed. Each stems directly from a deliberate scope decision (see [Architecture](architecture.md)).

| Limitation | Why |
|---|---|
| **Merge is a planning tool with a scope-limited real export** | The beta `.pptx` export carries over text/tables/background/notes/transitions, but drops images/charts/SmartArt/media — only a content hash was ever kept for those. A full lossless OOXML round-trip writer is out of scope. See [Three-way merge](features/merge.md). |
| **Transition preview is a simplified crossfade** | Not a literal PowerPoint transition engine — clearly labeled as such in the UI. See [Rendering fidelity](features/rendering.md). |
| **Master/layout thumbnails are schematic, not pixel-perfect** | The renderer library (`@aiden0z/pptx-renderer`) renders slides, not raw layout/master parts, so these fall back to dashed placeholder rectangles. |
| **"Shareable link" is a `data:` URL, not a hosted short link** | There's no backend server to host a real short link on — see [Architecture](architecture.md#no-backend-by-design). |
| **Notion and Confluence live push usually fail from a static page** | Neither service exposes a browser-origin-enabled write API; both are caught gracefully with a fallback pointer to the working file-based export. Slack is the one live-push integration reasonably likely to succeed client-side. See [Exports & live push](features/exports.md#live-push). |
| **Chart/SmartArt/media parts may render as "Schematic," not "Rendered"** | A graceful fallback for parts the renderer library can't fully parse — expected behavior, not a parsing failure. |
| **Review state is local to one browser** | `localStorage`-backed, not a shared/synced database. Use the JSON report export/import round-trip to hand a review session to someone else. |

## Not currently accepting contributions

The project is not open to external contributions at this time. Bug reports and feature requests are still welcome via [GitHub issues](https://github.com/sugatoray/pptxdiff/issues).
