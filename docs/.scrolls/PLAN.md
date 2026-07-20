# PLAN.md — Implementation Plan / Issue Board

Ticketed backlog, ordered by priority. Status: `[x]` done, `[ ]` open. Update as work happens — this is the single source of truth for "what's next," read alongside GAP_ANALYSIS.md (the "what's missing") and GAP_CONTEXT.md (the "why").

## Done (shipped, verified)
- [x] P0 — Core DC scaffold, Anthropic-style editorial chrome, sample deck, upload bar
- [x] P0 — Real `.pptx` parsing (JSZip) + shape/text extraction
- [x] P0 — Diff engine v1: text/font/size/color/align/position + word-level diff
- [x] P0 — Side-by-side previews with click-to-highlight
- [x] P1 — Swap in `@aiden0z/pptx-renderer` for pixel-accurate rendering (with schematic fallback)
- [x] P1 — Multi-slide-pair support ("All pairs" view)
- [x] P1 — Diffing: images, charts, tables, backgrounds, animations
- [x] P1 — Diffing: speaker notes, transitions, SmartArt, master/layout inheritance, hyperlinks, embedded fonts, headers/footers/slide numbers, video/audio media, table cell formatting (bg/border), text wrap, shape border/line-width
- [x] P1 — Red/Green TDD sample deck covering all diff categories
- [x] P1 — PDF / HTML / JSON report export, Decisions → CSV/JSON export
- [x] P2 — Per-slide Approve/Reject workflow
- [x] P2 — Full-deck comparison via content-similarity alignment (handles insert/delete, not just 1:1 pairs)
- [x] P2 — Multi-reviewer identity (handle/email + optional name), per-slide comments, approval history log
- [x] P2 — Speaker notes FORMATTING diff (not just text)
- [x] P2 — Slide master/layout thumbnails (schematic)
- [x] P2 — Dark/light mode (full palette threaded through all panels, incl. a follow-up polish pass)
- [x] P3 — Threaded comment replies
- [x] P3 — Batch upload for multiple deck pairs (diff-only fast pass + "Open" into full view)
- [x] P3 — Transition preview (simplified crossfade + real type/speed label)
- [x] P3 — Export as Slack message (clipboard) / Email summary (mailto) / Shareable link (data URL)
- [x] P3 — Per-individual-diff Approve/Reject (in addition to per-slide)
- [x] P3 — Three-way merge **planning** (Keep Before/After/Custom per diff → exportable plan)
- [x] P3 — Slide-level scenario detection: added / removed / **moved** / modified (not just modified)
- [x] P4 — Bugfixes: image-label crash, layout-panel blank fallback + parser try/catch hardening, JS syntax-error-from-edit incident, embedded-fonts first-mount race

## Open — prioritized next
0. **P0 — Fix the open "nothing visible in Slide Diff" hang bug.** See HANDOFF.md and GAP_CONTEXT.md for the investigation trail — top priority for next session, blocks everything else.
1. **[DONE] P1 — Approve/reject rollup UI.** Show, per slide, whether it's "fully approved," "approved with N individually-rejected diffs," etc. — currently slide-level and diff-level decisions are tracked independently with no combined view. (See GAP_ANALYSIS.md → Reviewer workflow.)
2. **[DONE, needs real-deck validation] P1 — Tune/validate deck-alignment thresholds.** Match threshold raised 0.12→0.18; reordered-section move detection added via a second order-preserving LCS pass over leftovers. Still not validated against a real large deck. Current similarity thresholds (0.12 match, 0.55 move) were only validated against the small sample fixture. Get a real multi-slide-pair deck (ideally one with near-duplicate template slides) and check alignment quality; consider exposing the thresholds as advanced tweaks if real decks need different values.
3. **[DONE, partial] P2 — Fuller theme-color (schemeClr) resolution.** Table cell fill/border (lnL only) and background gradient/pattern first-stop colors now resolve via the shared theme+colorMap resolver. Thread the real `clrMap`/`clrMapOvr` + theme `clrScheme` through shape color resolution instead of the current partial hardcoded map (tx1/dk1/tx2/dk2/bg1/lt1/accent1 only).
4. **P2 — Shape-level (not just text-run) hyperlink diffing**, covering `a:hlinkClick` on `cNvPr` for whole-shape and image link-throughs.
5. **[DONE] P3 — Batch mode polish**: filename-similarity pairing (bigram Dice), progress bar, batch report CSV/JSON export.
6. **[DONE] P3 — Table-cell-diff cap** raised 6→20 (still hardcoded, not user-configurable).
7. **[DONE, partial] P3 — Accessibility pass**: aria-labels added to highest-value icon-only buttons + toast aria-live. Keyboard nav audit and focus rings still open.
8. **P4 — Section header (`p:sectionLst`) diffing.**
9. **[DONE] P4 — Duplicate-slide detection** (>92% similarity within one deck) surfaces as a note panel.
10. **[DONE, scoped] P4 — Real OOXML round-trip merge writer.** "Merged .pptx (beta)" export ships — majority-vote per-slide winner, text/tables/background/notes/transitions only (no images/charts/SmartArt/media). Would enable applying a merge plan back into an actual `.pptx` file, and/or exporting an annotated copy of the After deck with diff highlights baked in as real shapes. This is a substantial, standalone effort (essentially a from-scratch OOXML writer for arbitrary uploaded files) — do not start without an explicit, scoped user ask; read GAP_CONTEXT.md → "Reviewer workflow" and "Exports" first.
11. **[DONE, scoped] P4 — Automated regression test suite.** In-browser runSelfTests() button covers core algorithms + a merge-export round trip. Not CI-integrated. No test harness currently exists; all verification has been manual/visual. Would need its own tooling decision (this is a template-holes DC, not a plain JS app) — discuss approach before starting.

When picking up a new ticket: update this file's status, and add a short note to HANDOFF.md's "Recent bugs fixed" / current-state section if the work reveals a new trap worth recording in WISDOM.md.


## New tickets opened this session
1. **P0 — Fix "nothing visible" hang.** See PLAN item 0 above and HANDOFF.md.
2. **P2 — Reviewer notifications shipped** (in-app @mention only) — future: real delivery (email/Slack) would need a backend, still out of scope.
3. **P3 — Validate/tune filenameSim threshold (0.3)** against real-world batch filename patterns.
4. **P3 — Merge-winner transparency**: show which side (before/after) will win per slide in the merge UI before export, and allow a per-slide override independent of per-diff picks.
5. **P4 — Resolve scheme colors on lnR/lnT/lnB** table cell borders (currently only lnL).

## Done this session (additions to the completed list)
- [x] Collapsible Approval history / Regression self-tests panels.
- [x] All-pairs checkbox selection + per-card collapse + global collapse-all + 'Selected' filter.
- [x] Corrected slide-status tag system (IDENTICAL/CHANGED + ADDED/DELETED/MOVED), replacing the old Identical/Moved badges, with a global LIS-based MOVED detector (two rounds to get the tie-break right -- see HANDOFF.md).
- [x] Keyboard shortcuts: A/R approve/reject, ←/→ prev/next, V toggle view, D dark mode, C focus comments, N jump to next changed slide.
- [x] Batch upload drag-to-reorder (native HTML5 DnD, no touch/keyboard alt yet -- see GAP_ANALYSIS.md).
- [x] Merge-winner preview panel before export (read-only -- see GAP_ANALYSIS.md for override gap).
- [x] New regression tests: markMovedByLIS tie-break unit test, merge-preview/pickMergeWinner consistency test.

## New tickets opened this session
1. **P2 -- Merge-preview per-slide override.** Let a user flip a slide's overall merge winner directly from the preview panel instead of having to go re-pick every individual diff.
2. **P3 -- Full keyboard shortcuts help modal** (press ? to show all bindings), plus persist allPairsCollapsed / collapsedPairs across reload similarly to reviewer state.
3. **P3 -- Touch/keyboard-accessible reorder for batch file lists** (native HTML5 drag-and-drop has no mobile or keyboard fallback).
4. **P4 -- Confirm root cause (or close out) the earlier "nothing visible" hang report** if it recurs -- see HANDOFF.md's carried-forward note; not reproduced in any verification round this session.

## Done this session (additions to the completed list)
- [x] Merge-winner override (Before/After, per slide, in the merge preview panel).
- [x] Full keyboard shortcuts help modal (press ? or click the toolbar button).
- [x] Touch drag-to-reorder for batch upload file lists.
- [x] Persist collapsedPairs / selectedPairs / mergeWinnerOverrides to localStorage, and include them as a uiState block in the JSON report export.
- [x] Markdown summary, Notion (Markdown import), and Confluence (wiki markup) export formats.

## New tickets opened this session
1. **P3 -- Touch drag-preview/ghost element** for the manual touch-reorder implementation (parity with native desktop DnD).
2. **P4 -- Report-JSON round-trip import**: let a re-uploaded slide-diff-report.json restore uiState (collapsedPairs/selectedPairs/mergeWinnerOverrides) instead of export-only.
3. **P4 (large, out-of-scope unless requested) -- Real live push to Notion/Confluence/Slack APIs.** Needs a backend/OAuth proxy; current exports are the honest client-side maximum (file + import instructions).

## Done this session (additions to the completed list)
- [x] Fixed Export dropdown off-screen-left positioning bug (verifier-caught).
- [x] Touch drag-preview ghost for batch file reorder.
- [x] Report-JSON round-trip import (key-based, tolerant of older exports missing `key`).
- [x] Live push to Slack (webhook), Notion (blocks API), Confluence (REST API) — real fetch attempts with graceful CORS-failure fallback messaging; credentials kept out of localStorage by design.
- [x] Red/Green self-tests for all of the above (touch ghost lifecycle, import round-trip + older-export tolerance, and the three pure payload/block/body builder functions).

## New tickets opened this session
3. **P4 (out-of-scope unless requested) — Backend proxy for Notion/Confluence live push** to work around CORS for real; would need a server component, which this project's single-file client-side model doesn't have.
4. **P4 — Slack push delivery confirmation** (currently silent/optimistic due to `no-cors` opaque response).

## Done this session (additions to the completed list)
- [x] Report-JSON import: merge vs. overwrite choice modal, with current-session-wins conflict resolution.
- [x] Confluence push: replace vs. append toggle (default Append).
- [x] Slack push delivery confirmation via hidden form/iframe POST (real network-level signal, not a true HTTP-status confirmation).
- [x] Live-push credential persistence: opt-in checkbox, separate localStorage key, immediate clear on opt-out.
- [x] Red/Green self-tests for all four (mergeReportPatch, buildConfluenceNewBody, interpretSlackDeliveryOutcome, buildCredsPayload).

## New tickets opened this session
1. **P4 -- Per-field credential persistence control** instead of one all-or-nothing opt-in checkbox.
2. **P4 (needs backend, out of scope unless requested) -- True Slack HTTP-status delivery confirmation.**
3. **P4 -- Configurable merge conflict-winner** (currently always "current session wins"; Overwrite is the escape hatch when the import should fully win).

## Done this session (additions to the completed list)
- [x] Per-field credential persistence (7 individual 'Remember' checkboxes replacing the single all-or-nothing toggle).
- [x] Configurable merge-conflict winner for report-JSON import (Current session wins / Imported file wins, chosen at import time).
- [x] Duplicate-slide 4th alignment state: DUPLICATE tag (same-deck near-identical slides), stackable with MOVED via a new `extraTags` array replacing the old single `secondaryTag`.
- [x] Red/Green self-tests for all three (`mergeReportPatch` imported-wins direction, `buildCredsPayload` field-filtering, `computeExtraTags` all four tag combinations).

## New tickets opened this session
2. **P4 — 'Select all/none' shortcut for per-field credential persistence checkboxes.**

## Done this session (additions to the completed list)
- [x] Cross-deck duplicate detection (`findCrossDeckDuplicates`), surfaced as a new note panel.
- [x] Select-all/none for credential checkboxes ('Remember all' / 'Forget all').
- [x] Select-all/none + bulk remove for batch file selection (both sides).
- [x] Select-all/none + bulk remove for the reviewer list.
- [x] Red/Green self-tests for `findCrossDeckDuplicates` and the shared `buildSelectAllMap`/`buildSelectNoneMap` helpers.

## New tickets opened this session
2. **P4 — Confirmation step for bulk reviewer removal** (currently immediate/irreversible, matching existing single-remove behavior).

## Done this session (additions to the completed list)
- [x] Confirmation modal for bulk reviewer removal (single-reviewer removal stays immediate).
- [x] Select-all/none + bulk Approve/Reject for the diff list.
- [x] Select-all/none + bulk Delete for comments (first-ever comment deletion capability).
- [x] Select-all/none + bulk Clear for history rows (signature-keyed selection).
- [x] Red/Green self-tests for all four (confirm-gate round-trip, bulk diff decision, bulk comment delete, signature-keyed bulk history clear).

## New tickets opened this session
3. **P4 — Clear stale selection state** (selectedDiffs/selectedComments) on slide-pair navigation, for tidiness (not a correctness bug — keys are namespaced).

## Done this session (additions to the completed list)
- [x] Single-comment delete button (immediate, matching existing single-item delete style).
- [x] Confirmation modal for bulk comment delete.
- [x] Confirmation modal for bulk history clear.
- [x] Red/Green self-tests for all three (single delete, bulk-comment confirm-gate round-trip, bulk-history confirm-gate round-trip).

## New tickets opened this session
1. **P4 — Reply delete capability** (single and/or bulk) — replies currently cannot be deleted at all, unlike top-level comments.
2. **P4 — Reconsider single-comment-delete confirmation** if real usage shows accidental single-deletes are a problem (currently intentionally immediate, matching the app's broader convention).

## Done this session (additions to the completed list)
- [x] Reply delete (single, immediate).
- [x] Confirmation modal for single-comment delete (reverses prior session's immediate-by-design call).
- [x] Confirmation modal for batch-file removal.
- [x] New 'Clear all decisions' action + confirmation modal.
- [x] Red/Green self-tests for all four (reply delete, and three confirm-gate round-trips).

## New tickets opened this session
1. **P4 — Bulk select-all/none/delete for replies** within a comment thread (currently single-only).
3. **P4 — Shared confirmation-modal template/component** to reduce the now-6x repeated modal markup, if a 7th confirmation is ever added.

## Done this session (additions to the completed list)
- [x] Shared confirmation-modal component (`pendingConfirm` + `openConfirm`/`closeConfirm`/`confirmPendingYes` + `buildConfirmConfig`), replacing 6 separate modal blocks and 12 separate cancel/confirmYes methods.
- [x] Scoped 'Clear decisions': All / Only my votes / Specific reviewer / Specific slide range, via `computeDecisionsToClear`.
- [x] Red/Green self-tests rewritten against the new generic API (all 6 prior confirm-flow tests) plus new tests for `buildConfirmConfig`, `computeDecisionsToClear` (all 4 scopes), and the `requestClearAllDecisions` integration path.

## New tickets opened this session
1. **P4 — Reviewer-handle autocomplete** for the 'Specific reviewer' clear-decisions scope (currently a free-text input, silently matches nothing on a typo).
2. **P4 — Visual feedback for an invalid/clamped slide range** (from > to) in the clear-decisions range inputs.

## Done this session (additions to the completed list)
- [x] Reviewer-handle autocomplete (`<datalist>`) for the clear-decisions 'Specific reviewer' scope.
- [x] Visual feedback (red border + inline warning) for an invalid (From > To) slide range.
- [x] Cross-deck duplicates extended: performance cap + force-override, adjustable sensitivity threshold, per-pair Ignore, section-header labeling, batch-mode duplicate counts, merge-preview duplicate-aware labeling, and an opt-in 'skip duplicate Before-only slides' merge-export behavior.
- [x] Red/Green self-tests for threshold sensitivity, the performance cap (skip vs. force), and `sectionForSlideIndex`.

## New tickets opened this session
1. **P4 — Per-context sensitivity/ignore-list** for cross-deck duplicates (currently one shared global setting across all three call sites).
2. **P4 — Symmetric duplicate handling for After-only (added) slides.**
3. **P4 — Batch mode cross-dup drill-down** (currently a count only, no per-slide detail without opening the pair).
