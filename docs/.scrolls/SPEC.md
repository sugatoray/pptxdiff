# SPEC.md — Slide Diff: Feature Specification

Single-file Design Component (`Slide Diff.dc.html`) that compares two PowerPoint decks (or many pairs) side by side, renders them with real fidelity, diffs every property PowerPoint exposes, and supports a full reviewer workflow.

## 1. Rendering
- Real `.pptx` parsing via JSZip (OOXML: slides, rels, layouts, masters, themes, notes, charts, tables, diagrams).
- High-fidelity slide rendering via `@aiden0z/pptx-renderer` (npm, loaded via esm.sh CDN) — `parseZip → buildPresentation → PptxViewer.renderThumbnailToContainer`.
- Graceful fallback to a schematic (box+text) renderer per-slide if the library can't parse a part ("Rendered" vs "Schematic" badge).
- Change-highlight overlay boxes drawn on top of the real render (outline colors keyed by diff status: changed/added/removed).

## 2. Diff engine (per slide pair)
Diffs text, font family/size/weight/italic, color, alignment, position, box size, wrap, shape border (width/color), hyperlinks.
Also diffs: images (content hash + position/size), charts (type + series data), tables (cell text, per-cell background/border, row/col counts, capped at 6 shown + "+N more"), SmartArt (text content), slide backgrounds (solid/gradient/image/pattern + color), animations (effect sequence signature), speaker notes (text AND formatting — bold/italic/font/color), slide transitions (type + speed/auto-advance), video/audio media (content hash), master/layout inheritance (layout name + theme name mismatch), embedded fonts (deck-level, not per-slide).

Word-level diff (LCS-based) highlights changed words within text/table-cell/chart-data/SmartArt content (strikethrough removed, bold added).

## 3. Deck-level comparison (not just 1:1 pairs)
- `alignSlides(A,B)`: LCS/Needleman-Wunsch-style alignment using per-slide word-overlap similarity (Dice coefficient) — handles inserted/removed slides without misaligning everything after.
- `refineMoves(alignment,A,B)`: post-processes remove+add pairs, re-matching by content similarity (>0.55) to detect **moved** slides (same content, different position) vs true add/remove.
- Four slide-level states surfaced: **added**, **removed**, **moved**, **modified** (+ identical/no-diff).

## 4. Views
- **Single pair**: two big slide previews (prev/next steppers per side) + full diff list below.
- **All pairs**: grid of every aligned slide pair (compact previews both sides) with Identical/Moved/N-changes badges; filter chips (All / Changed only / Pending / Approved / Rejected).
- **Batch**: upload multiple Before files + multiple After files (paired by order), fast diff-only parse (no renderer) produces a results table with per-pair diff counts; "Open" loads a pair into full single/all view with rendering.

## 5. Reviewer workflow
- Multiple reviewers: add via required `@handle`/email + optional display name → removable chips; click a chip to set "voting as."
- Per-slide Approve/Reject, tracked **per reviewer** (`decisions[pairKey][handle]`); slide-level aggregate status = rejected if any reviewer rejected, else approved if any approved, else pending.
- Per-slide comments with threaded replies (`comments[pairKey] = [{author,text,ts,replies:[...]}]`).
- Approval history log (newest-first, toggle panel) recording every approve/reject/comment/reply with reviewer + timestamp.
- Per-INDIVIDUAL-diff (not just per-slide) Approve/Reject, also per-reviewer, keyed `pairKey::diffKey`.
- Three-way merge **planning** (not an automatic file rewrite): per diff, "Keep Before / Keep After / Custom" picker → exportable merge plan JSON. Real OOXML-preserving auto-merge of arbitrary uploaded files is out of scope (would need a full round-trip OOXML writer).

## 6. Exports
- PDF (print, via `omelette-owns-print` meta + `window.print()`; chrome hidden via `.no-print` + `@media print`).
- Standalone HTML report (downloaded file, static, read-only summary of all diffs/decisions/comments).
- JSON report (full: deck names, presentation-level diffs, per-slide diffs, decisions, comments, history).
- Decisions → CSV / JSON (slide, decision, reviewer votes, comments).
- Merge plan → JSON.
- Copy Slack message (clipboard, plain-text mrkdwn-ish summary).
- Email summary (`mailto:` with subject+body).
- Copy shareable link (self-contained `data:text/html;base64,...` URL of the HTML report, copied to clipboard — no server/backend, so this is a self-contained data URL, not a hosted short link).

## 7. Other UI
- Dark/light mode toggle — full theme palette (bg/card/border/text/muted/chip) threaded through every panel via `theme.*` holes in `renderVals()`.
- Slide master & layout thumbnails: schematic (dashed rects from placeholder geometry) + layout name + theme name, per side, in single-pair view. NOT pixel-perfect (the renderer library only renders slides, not raw layout/master parts).
- Transition preview: shows the After slide's transition type/speed + a simplified crossfade animation swatch (not a literal PowerPoint transition render — technical limitation, clearly labeled).
- Tweaks (host Tweaks panel): `accentColor` (color), `wordLevelDiff` (boolean).

## 8. Files
- `Slide Diff.dc.html` — the DC (template + logic class).
- `sample-pptx.js` — ES module, builds real minimal-but-valid `.pptx` ArrayBuffers from a compact JS shape spec (used for the built-in sample deck AND exercises every OOXML feature: hyperlinks, tables w/ cell formatting, images, charts, SmartArt, video/audio (dummy bytes), notes (with formatting), transitions, backgrounds, embedded fonts).
- Sample deck ships 3 slide pairs: original Q3 slide (baseline diffs), a **RED** "Feature Showcase" pair with an intentional difference planted in every new-feature category, a **GREEN** control pair that's byte-identical across every category (proves no false positives) — Red/Green TDD fixture.
- `gen-sample-pptx.mjs` (Node-only, run via `node src/pptxdiff/gen-sample-pptx.mjs`) — materializes that same sample-deck spec as real files, `docs/assets/sample_before.pptx` / `sample_after.pptx`, for testing the diff engine without a running browser session. Not shipped as part of the CLI/app (`package.json`'s `files` list doesn't include it); it's a repo-local dev/test asset.

## Known/accepted limitations
- Merge = planning tool, not binary rewrite.
- Transition preview = simplified crossfade, not literal PPT transition engine.
- Master/layout thumbnails = schematic rects, not pixel-perfect render.
- Shareable link = self-contained data URL (no server-backed short link).
- Chart/SmartArt/media parts in generated sample are minimal-valid OOXML; the pptx-renderer library may fall back to "Schematic" mode for slides it can't fully parse (graceful, not a bug).

## 9. Added since initial SPEC (reviewer workflow, alignment, merge, testing)
- **Approve/reject rollup**: per-slide "X of Y diffs reviewed" summary (single view + All-pairs badge); All-pairs filter chips for "Has rejected diffs" / "Unreviewed diffs" alongside slide-decision filters.
- **Alignment tuning**: LCS match threshold raised 0.12→0.18; `refineMoves` runs a second order-preserving LCS pass over leftover removed/added slides so a whole reordered SECTION of slides links pairwise in sequence instead of via greedy nearest-neighbor (fixes cross-matching within moved blocks). Section-aware move note ("Section 'X' moved from slide N to slide M") surfaces separately from per-slide moved detection, driven by real `p:sectionLst` parsing.
- **Gap closures**: shape-level hyperlinks (`cNvPr > a:hlinkClick`) diffed for text boxes AND images, not just text-run hyperlinks; section headers parsed from `p:sectionLst` and diffed at the presentation level; duplicate-slide detection (>92% similarity within one deck) surfaces as a note panel; table cell-formatting diff cap raised 6→20; fuller theme-color resolution — table cell fill/border and background gradient/pattern first-stop colors now resolve `schemeClr` through the same theme+color-map resolver as text runs.
- **Reviewer state persistence**: reviewers, active reviewer, per-slide decisions, comments+replies, history log, per-diff decisions, and merge choices are saved to `localStorage` (key `slideDiffReviewerState_v1`) after every mutation and restored on mount.
- **Reviewer @mention notifications**: mentioning a registered @handle in a comment/reply queues an in-app notification; a bell icon (with unread badge) next to "Voting as" shows them, marked read on open. In-session only — no push/email delivery (client-only, no backend).
- **Batch mode upgrades**: pairing-mode toggle (Upload order / Filename-similarity via bigram Dice coefficient — `filenameSim`/`pairFilesByName`); unmatched files surface as their own "no match found" row; a real progress bar (`batchProgress`/`batchTotal`) replaces the static "Parsing…" label; "Batch report → CSV/JSON" export buttons.
- **Real OOXML merge writer**: "Merged .pptx (beta)" export button. For each aligned slide pair, tallies that slide's Keep-before/Keep-after per-diff picks (majority wins, ties default to After), converts the winning parsed slide back into `buildPptx`'s spec shape via `slideToBuildSpec`, and downloads a real, valid, openable `.pptx`. Scope: text/tables/background/notes/transitions carry over; images/charts/SmartArt/media are dropped (only a hash/reference was kept for those, not re-embeddable bytes) — a toast states this on export.
- **In-browser regression self-tests**: "Run self-tests" button runs `runSelfTests()` (async), covering word-diff, slide similarity, alignment (add/remove/move), duplicate detection, scheme-color resolution, key-namespacing, diff rollups, filename similarity, AND a real merge-export round-trip (builds a 2-slide `.pptx` via `buildPptx`, re-parses it with our own reader, asserts slide count + text survive). Results shown pass/fail in a panel.
- **Accessibility pass**: `aria-label`s on icon-only controls (remove-reviewer ✕, per-diff approve/reject ✓/✕, prev/next slide arrows ‹›); toast uses `role="status" aria-live="polite"`.

## 10. Added this session (collapsible panels, all-pairs selection, tags, keyboard, batch reorder, merge preview)
- Collapsible Approval history and Regression self-tests panels (click header to toggle, chevron indicator).
- All-pairs view: per-card checkbox selection + collapse chevron (hides preview thumbnails, keeps header); a global 'Collapse all / Expand all' button; a 'Selected (N)' filter toggle to show only checked pairs.
- Slide-pair status tags replaced the old Identical/Moved badges: primary tag IDENTICAL or CHANGED (always shown for matched pairs), ADDED/DELETED for slides only on one side, plus an orthogonal MOVED tag shown alongside the primary tag when a slide's relative order changed (e.g. "IDENTICAL, MOVED" or "CHANGED, MOVED").
- MOVED detection rewritten as a global Longest-Increasing-Subsequence check (`markMovedByLIS`) over all matched (aIdx,bIdx) pairs, with an O(n^2) DP tie-break that prefers keeping same-position pairs (aIdx===bIdx) out of the 'moved' set when LIS length ties with a genuinely-reordered pair. Replaces the old local-heuristic ('came from the leftover-matching pass') definition, which mislabeled same-position slides as moved and missed real reorders.
- Keyboard shortcuts (ignored while focus is in an input/textarea/contenteditable): A approve, R reject, ←/→ prev/next slide (both sides), V toggle single/all view, D toggle dark mode, C jump to single view and focus the comment box, N jump to the next changed slide after the current one. Hint shown in the toolbar.
- Batch upload: drag-to-reorder file lists per side (drag handle, remove button) — order matters for the default 'upload order' pairing mode.
- Merge winner preview: 'Preview merge winners…' opens a panel listing every aligned slide with its computed Before/After/Dropped/New winner (using the exact same `pickMergeWinner` the real export uses) before committing to a download.
- Regression tests added: a direct RED/GREEN case reproducing the exact same-position-vs-moved tie-break bug (`markMovedByLIS` unit test), and a test verifying the merge-preview winner matches `pickMergeWinner`'s real output for a given diff-choice set.

## 11. Added this session (merge-winner override, shortcuts help, touch reorder, persistence, new export formats)
- Merge-winner override: per-slide Before/After override buttons in the 'Preview merge winners…' panel force that slide's export winner regardless of the computed per-diff majority vote (labeled '(overridden)'); `pickMergeWinner` checks the override first.
- Full keyboard shortcuts help modal: '⌨ Shortcuts' button or press '?' opens an overlay listing every binding (A/R/←→/V/D/C/N/?), closable via Esc, click-outside, or ✕.
- Touch drag-to-reorder for batch upload file lists: touchstart/touchmove/touchend handlers (using `elementFromPoint` to find the row under the finger) alongside the existing HTML5 drag-and-drop, so reordering works on mobile/tablet.
- localStorage persistence extended to `collapsedPairs`, `selectedPairs`, and `mergeWinnerOverrides` (previously only reviewer/decision state persisted).
- JSON report export (`exportJsonReport`) now includes a `uiState` block (`collapsedPairs`, `selectedPairs`, `mergeWinnerOverrides`) so review-session UI state is captured in the exported report, not just reviewer decisions.
- Three new export formats, all built from the same `buildReportRows()` data as the other reports: **Markdown summary** (plain .md with a table per slide), **Notion** (same Markdown body, named/toasted to guide the user through Notion's Settings → Import → Markdown flow — Notion has no public write API usable from a static client-side file, so this is the honest maximum), **Confluence** (Confluence wiki markup .txt — `h1./h2.` headings, `||...||` table syntax — toasted to guide the user through Insert → Markup → Wiki Markup; same reasoning as Notion, no write API from client-side).

## 12. Added this session (touch drag-preview, report-JSON round-trip import, live push to Slack/Notion/Confluence) — built with Red/Green TDD
- Touch drag-preview ghost: a small floating label (filename + drag-handle glyph) follows the finger during a batch-file touch-drag, positioned via a genuinely-live `touchGhostStyle` coordinate hole (updated on touchmove, cleared on touchend) — the one legitimate use of a style hole per this project's authoring rules, since finger position cannot exist at parse time.
- Report-JSON round-trip import: `exportJsonReport` now includes each slide's internal `key` (pairKey) alongside its label; a new 'Import report JSON…' file control in the export menu re-parses a previously-exported report and restores `decisions`, `comments`, `history`, and the `uiState` block (`collapsedPairs`/`selectedPairs`/`mergeWinnerOverrides`) via a pure `parseReportForImport(report)` function, then persists to localStorage. Older exports without a `key` field are tolerated (skipped, not errored).
- Live push to Slack/Notion/Confluence — a 'Live push…' modal collects credentials (kept in component state only, explicitly NOT written to localStorage — the modal says so) and attempts a real network call per service:
  - **Slack**: POSTs to the user's incoming-webhook URL as a form-encoded `payload=` body with `mode:'no-cors'` (the standard client-only workaround for Slack's webhook CORS behavior — response is opaque, so success is reported optimistically).
  - **Notion**: PATCHes `/v1/blocks/{pageId}/children` with a bearer integration token, converting report rows into real Notion blocks (`buildNotionChildren` — heading_2 per slide, bulleted_list_item per diff, paragraph for identical slides). Expected to fail with a CORS error in practice (Notion's API isn't browser-origin-enabled) — caught and reported with a clear explanation plus a pointer to the existing file-based Notion export as a working fallback.
  - **Confluence**: GETs the current page (for its version number + existing body), then PUTs an appended body in Confluence storage format (`buildConfluenceStorageBody` — real `<table>`/`<h2>` HTML, not wiki markup) with HTTP Basic auth (email + API token). Same CORS caveat/fallback message as Notion.
- All three push flows' request-building logic (`buildSlackPayload`, `buildNotionChildren`, `buildConfluenceStorageBody`) are pure functions with no network/DOM dependency, specifically so they're unit-testable without mocking fetch — see the new self-tests.
- New Red/Green self-tests added for all three features above (touch ghost lifecycle, import round-trip incl. an older-export-without-key tolerance case, and the three payload/block/body builders) — written and reasoned about test-first per this session's explicit Red/Green TDD instruction, though committed in the same turn as the implementation (see WISDOM.md for the practical process note on this).

## 13. Added this session (merge-vs-overwrite import, Confluence replace/append, Slack delivery confirmation, opt-in credential persistence) — Red/Green TDD
- **Report-JSON import: merge vs. overwrite.** If the current session already has in-progress decisions/comments/history/UI state, importing a report now opens a choice modal (Merge / Overwrite / Cancel) instead of silently overwriting. `mergeReportPatch(current, imported)` is a pure function: the current session's own choices win on any per-key conflict (a reviewer's vote, a collapse/select/override flag); anything only present in the import is adopted; comments are unioned and de-duplicated; history is unioned, de-duplicated, and re-sorted newest-first.
- **Confluence replace-vs-append.** A toggle in the Live-push modal (default: Append) controls whether a Confluence push adds new content after the page's existing body (separated by `<hr/>`) or replaces it outright. `buildConfluenceNewBody(existingBody, newContent, mode)` is the pure decision function.
- **Slack delivery confirmation.** Replaced the old `mode:'no-cors'` fetch (zero information — always reported optimistic success) with a hidden `<form>` POST into a hidden `<iframe>`, whose `load`/`error` events give a real (if coarse) signal distinguishing "the request round-tripped" from "it never went out" (bad URL, offline). `interpretSlackDeliveryOutcome(kind)` maps `'load'→sent`, `'error'→failed`, `'timeout'→unknown` to user-facing messages, and is the pure/tested piece of this flow.
- **Opt-in credential persistence.** A checkbox in the Live-push modal ("Remember these credentials in this browser") controls whether Notion/Confluence/Slack credentials are written to a SEPARATE localStorage key (`slideDiffLivePushCreds_v1`, distinct from the main reviewer-state key) — off by default; unchecking immediately clears that key. `buildCredsPayload(state)` is the pure function defining exactly which fields are captured (and only those).
- New Red/Green self-tests for all four: `mergeReportPatch` (conflict-wins, adopt-imported-only, comment/history dedup), `buildConfluenceNewBody` (append/replace/missing-body), `interpretSlackDeliveryOutcome` (all three outcome kinds), `buildCredsPayload` (exact field-set capture, no leakage of unrelated state).

## 14. Added this session (per-field credential persistence, configurable merge-conflict winner, duplicate-slide 4th alignment state) — Red/Green TDD
- **Per-field credential persistence.** Replaced the single all-or-nothing 'Remember these credentials' checkbox with an individual 'Remember' checkbox next to each of the 7 live-push fields (Slack webhook URL; Notion token/page ID; Confluence base URL/email/token/page ID). `persistedCredFields` (state) tracks which fields are opted in; `buildCredsPayload(state, fieldsToPersist)` is the pure function filtering to exactly those fields; unchecking one field's box immediately drops just that field from the `slideDiffLivePushCreds_v1` localStorage entry (re-persisted from the remaining opted-in fields).
- **Configurable merge-conflict winner.** The report-import Merge/Overwrite choice modal now also offers 'On conflict: Current session wins / Imported file wins' (default: current). `mergeReportPatch(current, imported, conflictWinner)` takes the winner as a parameter — decisions, collapsedPairs, selectedPairs, and mergeWinnerOverrides all respect it; comments/history are unaffected (always unioned, no 'conflict' concept for list data).
- **Duplicate-slide 4th alignment state.** A slide-pair's status is no longer just the primary tag (IDENTICAL/CHANGED/ADDED/DELETED) plus an optional single MOVED badge — `computeExtraTags(al, dupIndicesA, dupIndicesB)` is a pure function returning a stackable array of extra tags: MOVED (relative order changed, from the existing LIS detector) and/or DUPLICATE (either side's slide is part of a near-identical group found by `findDuplicateSlides` within its OWN deck). These are independent facts and can co-occur (e.g. a slide that moved AND is a duplicate of another slide shows both tags) — this generalizes the earlier single `secondaryTag` field into a proper `extraTags` array rendered as a loop of badges.
- New Red/Green self-tests for all three: `mergeReportPatch` with `conflictWinner='imported'` (mirroring the existing 'current wins' test but for the opposite direction), `buildCredsPayload` field-filtering (none-selected → empty, some-selected → exactly those), and `computeExtraTags` (duplicate-only, moved-only, both-stacked, neither).

## 15. Added this session (cross-deck duplicate detection, select-all/none for credentials/batch files/reviewers) — Red/Green TDD
- **Cross-deck duplicate detection.** `findCrossDeckDuplicates(slidesA, slidesB, alignment)` is a pure function that flags a Before slide closely resembling a DIFFERENT After slide it is NOT aligned to (already-aligned pairs are excluded) — surfaced as a new 'Possible cross-deck duplicates' note panel alongside the existing same-deck duplicate-detection panel. Distinct from same-deck `findDuplicateSlides` (within one deck) and from move detection (a slide's own matched partner).
- **Select-all/none for credential checkboxes.** 'Remember all' / 'Forget all' buttons in the Live-push modal act on all 7 per-field 'Remember' checkboxes at once via the shared `buildSelectAllMap`/`buildSelectNoneMap` helpers.
- **Select-all/none for batch file selection.** Each side of the Batch upload file lists gained per-row checkboxes plus 'Select all' / 'Select none' / 'Remove selected (N)' buttons (bulk-remove selected files in one action).
- **Select-all/none for the reviewer list.** Each reviewer chip gained a checkbox; 'Select all' / 'Select none' / 'Remove selected (N)' buttons let a user bulk-remove multiple reviewers at once (active-reviewer handle is cleared if it was among those removed).
- All three select-all/none features share ONE generic pure-function pair — `buildSelectAllMap(keys)` and `buildSelectNoneMap()` — rather than three near-duplicate implementations, per this project's established 'generalize immediately' pattern (see WISDOM.md).
- New Red/Green self-tests: `findCrossDeckDuplicates` (finds an unaligned near-identical pair; excludes an already-aligned pair), `buildSelectAllMap`/`buildSelectNoneMap` (exact key-set behavior).

## 16. Added this session (bulk-reviewer-removal confirmation, select-all/none for diff list/comments/history) — Red/Green TDD
- **Confirmation for bulk reviewer removal.** Clicking 'Remove selected (N)' in the reviewer bar no longer removes immediately — it opens a confirm modal ('Remove N reviewer(s)?' / Cancel / Remove) via `requestRemoveSelectedReviewers` → `confirmRemoveSelectedReviewersYes`/`cancelRemoveSelectedReviewers`. Single-reviewer removal (the lone ✕ on a chip) remains immediate/unconfirmed, matching the existing direct-manipulation style — only the bulk/destructive path is gated.
- **Select-all/none for the diff list.** The 'Differences (N)' panel header gained Select all / Select none / Approve selected (N) / Reject selected (N) — bulk-applies the SAME per-diff decision keying (`curKey + '::' + d.key`) the individual ✓/✕ buttons already used, via `bulkSetDiffDecision(val)`.
- **Select-all/none for comments.** The Comments panel gained Select all / Select none / Delete selected (N) — the first DELETE capability for comments in this app (previously add/reply only); `deleteSelectedComments(pairKeyStr)` removes just the checked comments.
- **Select-all/none for history rows.** The Approval history panel gained Select all / Select none / Clear selected (N). History entries have no stable index (the array can be filtered), so selection keys off a content signature (`historySig(h)` — same shape used for de-dup in `mergeReportPatch`) rather than array position.
- All four reuse the shared `buildSelectAllMap`/`buildSelectNoneMap` helpers from the prior session — no new select-all/none implementation was written.
- New Red/Green self-tests: bulk-reviewer-removal confirmation gate (request → still present → confirm → actually removed), `bulkSetDiffDecision`, `deleteSelectedComments`, `clearSelectedHistory` (signature-keyed, not index-keyed).

## 17. Added this session (single-comment delete, confirmation for bulk comment delete + bulk history clear) — Red/Green TDD
- **Single-comment delete.** Each comment row now has its own ✕ delete button (`deleteComment(pairKeyStr, idx)`) — immediate, no confirmation, matching the app's existing single-item delete style (single reviewer, single batch file).
- **Confirmation for bulk comment delete.** 'Delete selected (N)' in the Comments panel now opens a confirm modal ('Delete N comment(s)?' / Cancel / Delete) via `requestDeleteSelectedComments(pairKeyStr)` → `confirmDeleteSelectedCommentsYes`/`cancelDeleteSelectedComments`, mirroring the bulk-reviewer-removal pattern from the prior session.
- **Confirmation for bulk history clear.** 'Clear selected (N)' in the Approval history panel now opens a confirm modal the same way, via `requestClearSelectedHistory()` → `confirmClearSelectedHistoryYes`/`cancelClearSelectedHistory`.
- This closes the asymmetry flagged in the prior session's GAP_ANALYSIS.md — ALL THREE bulk-select destructive actions (reviewers, comments, history) are now confirmation-gated; single-item deletes everywhere remain immediate by design.
- New Red/Green self-tests: `deleteComment` (immediate single delete), bulk-comment-delete confirm-gate round-trip (request → still present → confirm → actually deleted), bulk-history-clear confirm-gate round-trip (request → still present → confirm → actually cleared).

## 18. Added this session (reply delete, confirmation for single-comment delete/batch-file removal/clear-all-decisions) — Red/Green TDD
- **Reply delete.** Each reply within a comment thread now has its own ✕ (`deleteReply(pairKeyStr, commentIdx, replyIdx)`) — immediate, no confirmation (a reply is a smaller unit than a whole comment; only 'larger' deletes are confirmed in this app).
- **Confirmation for single-comment delete.** Reversed last session's explicit 'stays immediate' decision — the single-comment ✕ now opens a confirm modal ('Delete this comment?') via `requestDeleteComment`/`confirmDeleteSingleCommentYes`/`cancelDeleteSingleComment`.
- **Confirmation for batch-file removal.** The single-file ✕ in the Batch upload lists now opens a confirm modal ('Remove this file?') via `requestRemoveBatchFile`/`confirmRemoveBatchFileYes`/`cancelRemoveBatchFile`.
- **Confirmation for clearing all decisions.** New 'Clear all decisions' button in the header toolbar (only shown when `st.decisions` is non-empty) wipes every slide-level Approve/Reject vote across the whole comparison — gated behind a confirm modal ('Clear ALL decisions?') via `requestClearAllDecisions`/`confirmClearAllDecisionsYes`/`cancelClearAllDecisions`. Scoped to `decisions` only — does not touch `diffDecisions`, comments, or history.
- All three confirmation additions reuse the established request/cancel/confirmYes triad (see WISDOM.md) — this is now used for FIVE destructive actions total: bulk reviewer removal, bulk comment delete, bulk history clear, single-comment delete, batch-file removal, and clear-all-decisions.
- New Red/Green self-tests: `deleteReply` (removes exactly the targeted reply), single-comment-delete confirm-gate round-trip, batch-file-removal confirm-gate round-trip, clear-all-decisions confirm-gate round-trip.

## 19. Added this session (shared confirmation-modal component, scoped 'clear decisions') — Red/Green TDD
- **Shared confirmation-modal component.** Collapsed the 6 near-identical confirm-modal blocks (reviewers, comments-bulk, history-bulk, single-comment, batch-file, decisions) into ONE generic modal driven by a single `pendingConfirm` state object (`{title, body, confirmLabel, onConfirm}`). `openConfirm(config, onConfirmFn)`/`closeConfirm()`/`confirmPendingYes()` are the only three generic methods now; every `request*` method builds its config via a pure `buildConfirmConfig(kind, params)` (kinds: reviewers/comments/history/singleComment/batchFile/decisions) and calls `openConfirm`. This is the DC-appropriate way to build a 'shared component' — one data-driven template block, not a child DC (this app is intentionally single-DC per its authoring conventions).
- **Scoped 'Clear decisions'.** Replaced the flat 'Clear all decisions' button with a 'Clear decisions ▾' dropdown offering four scopes: **All** (everyone, every slide — previous behavior), **Only my votes** (clears just the active reviewer's votes, keeps others' on the same slides), **Specific reviewer** (pick a handle, clears just theirs), **Specific slide range** (row-position range as shown in the All-pairs view — clears every reviewer's votes but only for slides in that range). Pure decision logic lives in `computeDecisionsToClear(decisions, scope, opts)`, fully independent of state/DOM.
- New Red/Green self-tests: `buildConfirmConfig` for representative kinds (count-bearing, fixed-copy, scope-label-bearing), `computeDecisionsToClear` for all four scopes (all/mine/reviewer/range) confirming per-reviewer and per-slide-range isolation, and an integration-level test that `requestClearAllDecisions` routes through the shared modal. All 6 prior request*/confirm*Yes/cancel* self-tests were REWRITTEN (not just left in place) to assert against the new generic `pendingConfirm`/`confirmPendingYes` API instead of the retired per-action booleans — this was necessary, not optional, since the retired fields no longer exist.

## 20. Added this session (reviewer-handle autocomplete, invalid-range feedback, extended cross-deck duplicates) — Red/Green TDD
- **Reviewer-handle autocomplete**: the 'Specific reviewer' clear-decisions scope's handle input now has an HTML `<datalist>` populated from the current reviewer list.
- **Invalid slide-range feedback**: the clear-decisions range inputs turn red (border) and show an inline warning ('will be treated as a single row (N)') when From > To, matching `computeDecisionsToClear`'s actual clamp behavior.
- **Cross-deck duplicates, extended six ways**:
  1. *Performance at scale*: `findCrossDeckDuplicates` gained a `maxPairs` cap (default 6000 comparisons) — past it, returns `{skipped:true, totalComparisons}` instead of scanning, with a 'Run anyway' override in the UI.
  2. *Ignoring near-matches*: a Sensitivity slider (0.70–0.99, threshold parameter) lets the user raise the bar for what counts as 'near', plus a per-note 'Ignore' button that permanently dismisses one specific pair (`ignoredCrossDupKeys`).
  3. *Section headers*: each note now names the section (if any) each side's slide belongs to, via `sectionForSlideIndex(sections, idx)`.
  4. *Batch mode*: `runBatch` now also runs cross-deck duplicate detection per pair and appends a '· N cross-deck duplicate(s)' note to that row's summary.
  5. *Merge preview*: a 'Skip Before-only slides that closely resemble an After slide elsewhere' checkbox — when on, a dropped Before-only slide with an (unignored) cross-deck duplicate shows 'Skipped — duplicate of After slide N' instead of 'Dropped', and IS excluded from the merged .pptx export.
  6. *Duplicate slide merging*: the actual export behavior above — `exportMergedPptx` skips a Before-only slide's redundant copy when `mergeDuplicateSlides` is on, rather than including both the original and its near-duplicate cousin in the merged output (the pre-existing behavior always included Before-only slides via the `(pb || pa)` fallback, which is unaffected when the toggle is off).
- New Red/Green self-tests: threshold sensitivity (loose vs. strict), performance cap (skip vs. force), and `sectionForSlideIndex`.

## 21. npm CLI packaging (added this session)
- `pptxdiff` is now `npm`-installable as a CLI. `bin/cli.js` (stdlib-only: `node:http`/`node:fs`/`node:child_process`) serves `src/pptxdiff/{index.html,support.js,sample-pptx.js}` from a local server on an OS-assigned free port (`server.listen(0)`, no `--port` flag needed) and opens the default browser to it (`open`/`start`/`xdg-open` by platform; failure is swallowed — e.g. headless/no-GUI environments — since the URL is printed to stdout regardless).
- This is NOT a native desktop app (no Electron/Tauri) — deliberate scope choice, see GAP_CONTEXT.md. It's still fundamentally the same client-only app (see WISDOM.md's "No backend" constraint); the local server is a static file server, not application logic.
- Still requires internet access at runtime — React/ReactDOM/Babel-standalone (unpkg), `pptx-renderer` (esm.sh), JSZip (cdnjs), and fonts (Google Fonts) are all loaded from CDNs, unchanged from the browser-only usage. Not vendored/bundled for offline use — deliberate scope choice, see GAP_CONTEXT.md.
- `package.json` (root): `bin: {pptxdiff: "./bin/cli.js"}`, `files: ["bin", "src/pptxdiff"]`, no runtime `dependencies`.

## 22. Static sample-pptx test fixtures (added this session)
- `docs/assets/sample_before.pptx` / `docs/assets/sample_after.pptx` — the full built-in Red/Green sample deck (§8), pre-built as real `.pptx` files checked into the repo, generated by `src/pptxdiff/gen-sample-pptx.mjs`. Lets someone test the diff engine by uploading two real files directly (no need to click "Reset to sample" first) — useful for the CLI/static-file usage path (README Option C) and for manual QA.
- Regenerate after any change to `buildSample()` in `index.html`: `node src/pptxdiff/gen-sample-pptx.mjs` (requires `jszip` as a local devDependency — generation-time only, not a runtime dependency of the shipped app).

