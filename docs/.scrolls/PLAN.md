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

## Done this session (additions to the completed list)
- [x] `src/pptxdiff/gen-sample-pptx.mjs` — Node script producing `docs/assets/sample_before.pptx` / `sample_after.pptx`, real on-disk copies of the built-in Red/Green sample deck, for testing the diff engine without a running browser session. Reuses `sample-pptx.js`'s `buildPptx()` directly (via a `JSZip`/`atob` global shim — see WISDOM.md) rather than a separate reimplementation. `jszip` added as a devDependency (generation-time only, Node-side tooling; unrelated to the shipped app's own `vendor/jszip.min.js` copy — see §24 below).

## New tickets opened this session
1. **P4 — Fixture drift-check.** `gen-sample-pptx.mjs`'s shape spec is a manually-synced copy of `buildSample()` in `index.html` (see GAP_ANALYSIS.md/GAP_CONTEXT.md). A small CI/self-test step diffing the two, or regenerating the `.pptx` files and checking they're unchanged, would catch drift automatically — not built, since no test runner exists yet for this project (see the pre-existing "no automated regression suite" gap).

## Done this session (additions to the completed list)
- [x] **P0 — Diagnosed and fixed real-PowerPoint corruption in `docs/assets/sample_*.pptx` (two rounds).** Round 1: found `sample-pptx.js`'s SmartArt output is placeholder XML, not real OOXML (invented root element, missing Content-Types Override, all four required diagram relationship attributes aliasing one relationship) via `python-pptx`'s low-level `OpcPackage.iter_parts()` content-type audit; omitted `smartArt` from the JSZip-based export. User confirmed this alone was NOT sufficient — file still failed to open. Round 2: replaced the whole hand-rolled generator with `pptxgenjs` (real, proven OOXML writer). See WISDOM.md/GAP_CONTEXT.md for the full reasoning on why patch-one-defect-at-a-time was abandoned in favor of a library swap.

## Done this session (additions to the completed list)
- [x] **P2 — Consolidated the ad-hoc python-pptx checks into `src/pptxdiff/test_gen-sample-pptx.py`.** A self-contained `uv run`-able script (PEP 723 inline deps) asserting: content-types clean (no generic `application/xml` fallback — caught the SmartArt bug), every shape/chart/table/notes object walks without exception, no shape exceeds the slide bounds (caught the off-slide-elements bug), and slide counts match (6 before / 5 after). Run via `uv run src/pptxdiff/test_gen-sample-pptx.py` after any regeneration.
- [x] **P1 — Headless visual/functional validation of `sample_*.pptx` via the app's own pptx-renderer.** Drove `index.html` headlessly with Puppeteer (local static server + real file upload into the Before/After inputs): both decks render with the real "RENDERED" badge (not "Schematic"), all 6 slide pairs show correct diff/alignment states (17+12 category-spanning diffs, GREEN control IDENTICAL, moved slide detected, deleted slide detected), nothing renders outside slide bounds. See HANDOFF.md for full detail.
- [x] **P0 — Fixed off-slide element placement bug in `gen-sample-pptx.mjs`.** `pptx.layout = 'LAYOUT_16x9'` (pptxgenjs's built-in preset) is actually 10x5.625in, not the 13.333x7.5in every coordinate assumed — switched to an explicit `defineLayout` matching 13.333x7.5in, added a `checkBounds` guard at every placement call site, and verified zero out-of-bounds shapes across both files via `python-pptx` geometry checks (shape left/top/width/height vs. slide_width/slide_height).

## Done this session (additions to the completed list)
- [x] **P1 — Full offline/air-gapped capability.** Vendored React 18.3.1, ReactDOM 18.3.1, `@babel/standalone` 7.26.4, JSZip 3.10.1, `@aiden0z/pptx-renderer` 1.1.0 (esbuild-bundled with its `jszip` dependency into one self-contained ES module), and a latin-subset Spectral font under `src/pptxdiff/vendor/`, replacing every CDN reference in `index.html`/`support.js`. Closes the "npm CLI still requires internet access" gap from a prior session (see GAP_CONTEXT.md for why that earlier "keep CDN-based" decision was reversed). Verified via a new Red/Green Node check (`test_offline_capable.mjs`, RED with 5 failures before vendoring → GREEN 22/22 after) plus a one-off Playwright smoke test with all external network requests blocked (zero external requests, zero console errors, 88/88 in-app self-tests pass, real fixture upload renders with genuine fidelity, not schematic fallback).

## New tickets opened this session
1. **P4 — Vendor-freshness/version-bump tooling.** There is no automated check (yet) that the vendored `vendor/*.min.js` files stay in sync with `package.json`'s devDependency version pins, or a one-command "re-vendor everything" script — right now it's the manual esbuild/curl steps documented in WISDOM.md. Worth a small `scripts/vendor.mjs` if upstream versions get bumped more than rarely.
2. **P4 — `pdfjs-dist` embedded-PDF-object rendering remains unvendored/non-functional**, offline or online (pre-existing, not a regression — see GAP_ANALYSIS.md/GAP_CONTEXT.md "Offline capability").

## Done this session (additions to the completed list)
- [x] **P0 — Rebased the offline-capability branch onto `master`** after `master` merged an independently-developed documentation website (`src/pptxdiff/docs-site/`, MkDocs + Material — see the DOCS.md-referencing HANDOFF.md entry). Two doc-scroll ordering conflicts (HANDOFF.md, SPEC.md — both sessions appended near the same spot) resolved by keeping both sessions' entries and renumbering the offline-capability SPEC.md section from the now-taken §23 to §24; zero code conflicts (the two sessions touched disjoint files).
- [x] **P1 — Corrected 7 now-stale CDN/internet-access claims across the docs-site** (`architecture.md`, `limitations.md`, `getting-started.md`, `index.md`, `faq.md`, `cli.md`, `features/rendering.md`) written before the offline-vendoring work existed. Re-verified with `mkdocs build --strict` (clean).
- [x] **P1 — Re-verified offline capability post-rebase**: `test_offline_capable.mjs` still 22/22 GREEN, and a fresh Playwright smoke test (network blocked) confirms zero external requests, zero console errors, 88/88 in-app self-tests, and real "Rendered" fidelity badges on the on-disk fixtures — no regressions from the rebase.

## New tickets opened this session
1. **P2 — LibreOffice-headless visual rendering check for `sample_*.pptx`.** Not started; deferred in favor of the pptx-renderer/Puppeteer approach (see below) for now. `soffice --headless --convert-to png/pdf` gives a genuinely independent, real OOXML-rendering engine (different codebase from both PowerPoint and this app's own parser) that rasterizes actual slide images — the strongest available "does this look right" signal short of opening real PowerPoint itself. Not yet installed in this environment (`brew install --cask libreoffice`, ~300-600MB — a real, somewhat heavy install, worth deciding on deliberately rather than as a side effect of a fixture check). Trade-off vs. pptx-renderer/Puppeteer: LibreOffice's renderer can still differ from PowerPoint's in edge cases (it's strong-but-not-perfect evidence, not a substitute for a real PowerPoint open), but it validates the FILE independent of this app's own rendering code — pptx-renderer/Puppeteer instead answers "does this app render it correctly," which is a related but different question (a bug in pptx-renderer itself, or in how this app drives it, wouldn't be caught that way).
1. **P1 — Confirm the pptxgenjs-based fix by actually opening `sample_*.pptx` in the real Microsoft PowerPoint app.** Not done this session (GUI automation of the installed app was explicitly declined in favor of `python-pptx`-based validation both times) — the python-pptx/content-type audit is strong evidence and the generator is now a proven library rather than hand-rolled XML, but this is still not a substitute for an actual real-PowerPoint open. Top priority to close out before treating this fixture as done.
2. **P4 (large, not started, lower priority now) — SmartArt/transitions/embedded-fonts/real-media in the on-disk fixture.** `pptxgenjs` has no API for any of these; adding them would mean either a from-scratch spec-compliant writer for each (same risk class this session moved away from) or post-processing pptxgenjs's output by hand (same risk, worse: mixing a proven writer with hand-rolled patches). Not attempted; the in-browser sample deck still covers all four for its own purpose.

## Done this session (additions to the completed list)
- [x] **P1 — `PPTXDIFF_LITE_MODE` opt-in CDN sourcing.** An explicit escape hatch back to pre-vendoring CDN sourcing for all 5 swap points (React, ReactDOM, Babel, JSZip, pptx-renderer, Spectral font), off by default. `bin/cli.js` reads the env var (`1`/`y`/`yes`/`true`, case-insensitive) and opens the browser at `?lite=1`; `support.js`/`index.html` read that query param at runtime. See SPEC.md §25 for the full writeup.
- [x] **P1 — `test_lite_mode_cli.mjs`** (new): spawns the real CLI across 10 env-var cases, RED (6 failures) before implementation, GREEN (10/10) after.
- [x] **P1 — `test_offline_capable.mjs` rewritten** for the new dual-sourcing invariant (vendor default + gated CDN fallback per swap point, not "CDN absent") since the old invariant became intentionally false by design.
- [x] **P1 — End-to-end Playwright verification of both modes**: default mode still zero external requests/88 self-tests (no regression); `?lite=1` mode confirmed targeting the real CDN hosts via captured request URLs (sandbox network policy blocks the actual fetches here, unrelated to the code — see WISDOM.md).

## New tickets opened this session
1. **[DONE] P4 — No in-app UI indicator for lite mode** (console-log-only signal) — see below.
2. **P4 — Lite mode is all-5-or-nothing**, no per-dependency mixing — deliberate, not requested; see GAP_CONTEXT.md.
3. **P4 — `?lite=1` has no equivalent for the VS Code extension or a generic static-file-server usage path** beyond manually typing the query param — the env var itself only reaches `bin/cli.js`'s own auto-opened tab.

## Done this session (additions to the completed list)
- [x] **P2 — In-app "Offline Mode" corner toggle.** Closes the previous session's "no UI indicator" gap, per explicit follow-up ask. Mockup built and approved (real color/type tokens, not a generic placeholder) before any app code was written — see HANDOFF.md/GAP_CONTEXT.md for the process note. Pure `computeLiteModeToggleUrl()` + 4 new self-tests (92 total, up from 88); default-mode direction fully E2E-verified via Playwright (correct switch state, correct click→URL navigation, no regressions).

## New tickets opened this session
1. **P4 — Confirm the "Offline Mode" toggle's OFF/CDN visual state on a machine with real internet access** — this dev sandbox's outbound-proxy blocking prevented a full live-boot confirmation of that specific state; the ON/default state and the underlying logic are fully verified. See GAP_ANALYSIS.md.

## Done this session (additions to the completed list)
- [x] **P1 — Documentation coverage tracking system.** `scripts/coverage_registry.yml` (canonical checklist, 33 items), per-page `doc_coverage:` front matter, `scripts/sync_doc_coverage.py --write`/`--check`, and a Jinja-rendered `documentation-coverage.md` (via `mkdocs-macros-plugin`, scoped with `render_by_default: false` so no other page is affected). Red/Green verified for real: RED before the coverage page existed, GREEN after `--write`; three deliberate breaks (bad id/anchor/duplicate) each caught and each fixed back to GREEN. First honest baseline: 25/33 complete (21/21 features, 4/12 limitation categories).

## Done this session (additions to the completed list)
- [x] **P2 — Closed all 8 documentation-coverage gaps.** Added 8 real rows to `limitations.md` (diff-engine/deck-comparison/batch/testing-fixtures/accessibility/packaging/offline-capability/lite-mode limitations, sourced from `GAP_ANALYSIS.md`, not invented), added matching `doc_coverage:` entries, re-ran `--write`. Coverage is now 33/33 complete.
- [x] **P4 — Screenshots/GIFs of the app in use.** 9 real Playwright-captured screenshots (single-pair view, diff list, all-pairs status tags, reviewer workflow, export menu, merge preview, self-tests, batch results) + 1 GIF (dark mode toggle), wired into 8 feature pages + getting-started.md. The planned second GIF (offline-mode toggle click) was dropped — this sandbox's dev server navigates almost instantly on click, leaving no time for the switch's CSS transition to render before the page unloads, so it would only show "click → blank page"; used the existing static screenshot there instead. `mkdocs build --strict` clean; verified images actually resolve (non-zero naturalWidth) and render correctly via a Playwright screenshot of the built site.

## New tickets opened this session
1. **P4 — `features/duplicate-detection.md` has no screenshot** — the built-in sample deck's default 3 slide pairs didn't obviously trigger a cross-deck-duplicate note within this session's time budget; not forced. Would need either the right fixture content or deliberately similar slides.

## Done this session (additions to the completed list)
- [x] **P3 — `capture_screenshots.mjs` + `webm_to_gif.py`: turned the above's one-off hand capture into a committed, reusable tool.** Explicit follow-up ask ("do you have a module/script for this?"). 9 named scenarios covering every current screenshot + the dark-mode GIF; `--list`/`--only`/`--out-dir` flags; re-running it against the real `docs-site/docs/assets/img/` reproduced the existing assets (pixel-equivalent, minor encoder-timestamp deltas only) plus a smaller, better-cropped dark-mode GIF (841KB vs the original 963KB hand-cropped one, down from a first full-viewport attempt at 2.6MB). See DOCS.md §10 for the technical writeup (blank-leading-frame heuristic, per-scenario viewport override, why Node+`createRequire` instead of Python for this one script).

## New tickets opened this session
1. **P4 — `features/duplicate-detection.md`'s missing screenshot (ticket above) is now much cheaper to close** — add one scenario to `capture_screenshots.mjs` once the right fixture/slide content exists, rather than a fully manual capture. Still needs the underlying fixture-content problem solved first; not attempted this session.

## Done this session (additions to the completed list)
- [x] **P2 — Staging + pixel-level compare-and-promote workflow for `capture_screenshots.mjs`, with a real test suite.** Explicit ask: captures land in a staging dir, get pixel-compared (`compare_images.py`, Pillow) against the committed target, and only overwrite it on a genuine mismatch — plus Red/Green TDD (verified RED, then GREEN, then a deliberate-break-and-catch rigor pass on all three new test files: `test_compare_images.py`, `test_scenario_manifest.mjs`, `test_sync_staging_to_target.mjs`). `capture_screenshots.mjs` refactored so `main()` only runs as the entrypoint, making its internals importable/testable. See DOCS.md §11.

## New tickets opened this session
1. **P4 — GIF scenarios aren't pixel-deterministic across reruns** (lossy `.webm` encoding + timing jitter in transition frames), so `dark-mode-toggle` will report `updated` on every rerun even with zero real change — a known, documented limitation (DOCS.md §11/WISDOM.md), not attempted to fix this session since the natural fix (fuzzy/tolerance frame matching) wasn't asked for and would blur real-regression detection. Revisit if a second GIF scenario is ever added and the noisy-diff churn becomes annoying in practice.

## Done this session (v0.5.0 security-hardening housekeeping)
- [x] **P1 — Root `CHANGELOG.md` entry for the four security-hardening commits** (loopback binding, `execFile()`, `path.relative()` containment, response headers/`SECURITY.md`/vendor provenance) that had landed without one despite the `package.json` version bump to `0.5.0`.
- [x] **P1 — Docs-site content sync**: `cli.md`'s stale security note and `architecture.md`'s vendoring section updated to match the hardened `bin/cli.js` and new provenance docs; `docs-site/CHANGELOG.md` entry added.
- [x] **P1 — Ported the CLI's security hardening to the VS Code extension's own static server** (`extension.js` had the same unbound-`listen(0)` and raw-`startsWith(ROOT)` weaknesses, independently discovered this session). Bumped `pptxdiff-vscode` to `0.1.9`.

## New tickets opened this session
1. **P2 — Drift-check or shared module for `bin/cli.js` / `pptxdiff-vscode/extension.js`'s duplicated static-server code.** No automated check keeps the two in sync; see WISDOM.md's new trap and GAP_ANALYSIS.md's new "Security hardening" section.

## Done this session (screenshot export: zip + self-contained HTML viewer)
- [x] **P2 — "Screenshots → ZIP" export.** Captures the All-pairs tab collapsed, All-pairs expanded, and every aligned slide pair's single-view comparison (full page, diffs included) as SVG, bundled into a downloadable `pptxdiff-screenshots.zip` via the already-vendored JSZip. No new dependency.
- [x] **P2 — "Screenshots → HTML viewer" export.** Same captures, bundled into one self-contained `pptxdiff-screenshots.html` with a left-nav tab per screenshot (inline vanilla-JS tab switcher).
- [x] Real technical discovery mid-session: the obvious PNG-rasterization step (SVG-`foreignObject` → `<canvas>` → `toDataURL()`) is unconditionally blocked by a Chromium canvas-taint restriction, confirmed via an isolated repro rather than assumed. Pivoted to shipping SVG directly rather than vendoring `html2canvas` — see WISDOM.md's new trap and GAP_CONTEXT.md's new "Why screenshot exports ship SVG, not PNG" entry.
- [x] New shared pure helpers (`pairLabelFor`, `buildCollapsedMap`, `sanitizeFilename`) refactored into existing code (`buildReportRows`, `toggleAllPairsCollapsed`) instead of duplicated, each with new self-tests (103 total, up from 100/89 depending which prior session's count).
- [x] Verified end-to-end with Playwright against the real CLI (not just self-tests): both exports download correctly, the zip's `.svg` files each open rendering the correct captured view, and the HTML viewer's tabs correctly switch between all 8 screenshots for the sample deck.

## New tickets opened this session
2. **P4 — Screenshot captures are `.svg`, not `.png`.** Would need vendoring `html2canvas` (or an equivalent) to produce real raster bytes, given the canvas-taint wall — not attempted without an explicit ask; see GAP_ANALYSIS.md.
3. **P4 — Custom `@font-face` text (Spectral headings) may not carry its font into captured screenshots** — the foreignObject sandbox preserves inline `style` but not a separate `@font-face` declaration. Would need inlining the font as a data URI into the captured SVG's own `<style>`; not attempted.

## Done this session (Export-menu follow-ups: "Diff Screenshots" submenu, shareable-link diff status)
- [x] **P3 — Grouped the two screenshot exports under one "Diff Screenshots ▾" nested submenu** in the Export menu (explicit follow-up ask), replacing the two flat top-level buttons — a `<details>` nested inside the Export `<details>`, same technique as "Clear decisions ▾". No behavior change to either export; relabeled "Download as ZIP" / "Download as HTML viewer" since the submenu heading now supplies the context. Verified in the real running app: 107/107 self-tests, submenu opens/closes independently, both downloads still work.
- [x] **P2 — "Copy shareable link" now carries the diff status.** Explicit ask: embed the same JSON report `exportJsonReport()` produces into the shared page, so another machine can restore decisions/comments/history/uiState via the app's EXISTING Import report JSON… path — no new restore mechanism built. New shared `buildJsonReport()` helper (dedupes what used to be inline-only in `exportJsonReport()`). Found and fixed a real injection-safety gap (JSON.stringify never escapes `<`, so a literal script-closing tag in report data could break out of the embedded `<script>`) with a genuine RED->GREEN demonstration, not just an assertion. Verified end-to-end with Playwright: approved a slide, copied the link, opened it as a real page, confirmed the embedded JSON, downloaded report.json from that page, imported it into a fresh tab, confirmed the decision was restored. Self-test count now 119. See SPEC.md §28, GAP_CONTEXT.md's new "Why the shareable link embeds JSON..." entry, and WISDOM.md's new `</script`-in-source-text trap (hit twice — once in the feature, once in this test's own hostile-input fixture).

## New tickets opened this session
4. **P4 — Shareable link URL length grows further** now that it embeds the full JSON report on top of the HTML report — same pre-existing "no size-limit handling/warning" gap (GAP_ANALYSIS.md), more likely to matter, not newly introduced.

## Done this session (parser-independent content checksum in every diff export)
- [x] **P2 — SHA-256 content checksum, in every diff export (PDF/HTML/JSON/Markdown/Notion/Confluence/Slack/Email/shareable link) plus a new always-visible "Content checksums" panel.** Explicit ask, refined mid-conversation: user first asked for "checksum of the content, not just file hashes (timestamp info)"; agreed a raw file hash was wrong given `.pptx`'s zip/`docProps` timestamp churn, proposed hashing this app's own parsed slide structure instead — user explicitly redirected to a parser-independent approach and asked whether OpenSSL could be used. Implemented `computeContentChecksum()`: reads the raw zip directly (JSZip, no new dependency), SHA-256s every part except `docProps/core.xml`/`app.xml`/`thumbnail.*` (pure metadata), sorts by path, SHA-256s the resulting manifest — reproducible outside the app with real `openssl`/`sha256sum` since SHA-256 is a standardized algorithm (OpenSSL itself can't run inside this client-side-only app — see GAP_CONTEXT.md's new "Why OpenSSL itself isn't invoked" entry for why that's a hard architectural constraint, not an oversight).
- [x] Wired into `ingest()` (computed once per side on load, cached in state); new pure `isExcludedFromContentChecksum()` predicate with 7 self-tests; `computeContentChecksum()` itself tested against synthetic JSZip fixtures proving timestamp-independence and content-sensitivity, plus the graceful-null fallback when `crypto.subtle` is unavailable. Self-test count now 130.
- [x] Demonstrated genuine RED→GREEN: temporarily made the exclusion predicate always return `false`, confirmed exactly 5 dependent assertions failed (125/130), restored it, confirmed 130/130.
- [x] Verified live against the real running app with a REAL (not just synthetic) proof of timestamp-independence: clicking "Reset to sample" regenerates the `.pptx` files from scratch via `buildPptx()` (a fresh timestamp each time) yet produces the exact same checksum before and after. All 7 export formats confirmed showing the identical, correctly-computed hashes.

## New tickets opened this session
5. **P4 — Content checksum shows "unavailable" under the `file://` open path** (no secure context for `crypto.subtle`) — handled honestly, not worked around; see GAP_ANALYSIS.md.
6. **P4 — Excluded-parts list for the content checksum is a fixed, hardcoded set** — would need a code change, not a setting, if a new non-content save-time-varying part type is ever observed in the wild.

## Headless CLI + Web API — Phase 1 `diff`/`checksum` shipped this session
Full reasoning, architecture, and decisions: `docs/.scrolls/CLI_API_DESIGN.md` (see also
`docs/.scrolls/CLI_and_API.md`). **Decided 2026-07-31** (design doc §10): four-package split;
Phase 1 (Playwright-driven) built first; CLI and Web API built together on one shared automation
shim, not sequentially — that plan is what shipped below.
1. **[DONE] P1 — Playwright-driven automation shim** (`pptxdiff-cli`'s `lib/automation.js`).
   Headless Chromium (via `playwright-core`) loads the real `index.html`, uploads files through the
   real file inputs, waits for the real diff engine, clicks the real "Export → JSON report" button
   — not `page.evaluate()` reaching into internals, but driving the actual UI a human would use,
   which is what guarantees the CLI/API can never disagree with the GUI. Two real races/bugs found
   and fixed via genuine RED failures — see WISDOM.md's two new Trap entries this session (the
   default-sample-load race, and the `getAttribute('style')`-returns-null discovery). This is the
   shared foundation tickets 2 and 3 below are built on. See design doc §6.
2. **[DONE, partial] P1 — `pptxdiff-cli`: headless CLI subcommands.** `diff` and `checksum` ship,
   with `--json` + `diff`-style exit codes (0 = no differences, 1 = differences found, 2 = tool
   error) and `--out`/`--quiet`/`--timeout` flags. `batch`/`report`/`merge` are designed (design doc
   §5) but NOT built — see ticket 7 below.
3. **[DONE, partial] P1 — `@pptxdiff/server`: stateless Web API.** `POST /v1/diff`, `POST
   /v1/checksum`, `GET /v1/health`, `GET /openapi.json`, and `GET /docs` ship (base64-in-JSON file upload, not multipart — see ticket 8).
   Binds to `127.0.0.1` by default, matching the existing CLI security hardening's precedent — but
   **the design doc's API-key-for-non-loopback requirement is NOT implemented yet** (see ticket 9);
   don't bind this server to a non-loopback host in practice until that ships. `batch`/`report`/
   `merge` endpoints and the stateful review-session endpoints are designed (design doc §8) but not
   built — see tickets 7 and 10.
4. **[DONE] P2 — git integration: `pptxdiff-cli textconv`/`pptxdiff-cli difftool` +
   `pptxdiff-cli install-git-integration [--global]`.** Ships this session — the headline
   motivating use case for the whole effort. `.gitattributes`/`.git/config` local by default;
   `--global` (the flag itself is the consent, no separate prompt — a scriptable tool) writes
   `~/.gitconfig`. See design doc §7, SPEC.md §31, and WISDOM.md's new `--global`-ordering trap
   (found via a real RED test failure, not caught by the pure unit test alone).
5. **P2 — `@pptxdiff/core`: extract the parse/align/diff/checksum/report-building engine** out of
   `index.html`'s Component class into a standalone Node+browser dual-target module (Phase 2 —
   deferred until Phase 1's surface is validated against real usage, per this session's explicit
   decision — see GAP_CONTEXT.md's new "Why the headless CLI/API drive the real browser app
   instead of extracting a native engine first" entry). Once landed, `pptxdiff-cli`/`@pptxdiff/server`
   move `diff`/`checksum`/`batch`/`report`(non-pdf/screenshot)/`merge` onto it; `pdf`/`screenshot`
   stay on the Playwright shim permanently. This is the fix for ticket 1's real, currently-accepted
   cost (a headless-Chromium boot per invocation) — see GAP_ANALYSIS.md. See design doc §3/§4/§6.
6. **P3 — `pptxdiff mcp`: MCP server** wrapping the same operations as typed tools, for direct
   AI-agent tool-calling (no shell/HTTP boilerplate). See design doc §9.
7. **P2 — `batch`/`report`/`merge` CLI subcommands and API endpoints.** Designed (design doc §5/§8)
   but not built this session — `diff`/`checksum` were the priority slice. `report`'s `pdf`/
   `screenshot` formats will always need a real browser (ticket 1's shim), regardless of whether
   ticket 5 ever lands; the other report formats (html/md/json/csv/notion/confluence) can move to
   `@pptxdiff/core` once ticket 5 exists.
8. **P2 — `@pptxdiff/server`: real `multipart/form-data` file upload**, replacing/supplementing the
   current base64-in-JSON-body wire format (chosen for Phase 1 specifically because it needs zero
   new dependency — see GAP_CONTEXT.md's new entry). Matters most once large-deck upload efficiency
   is a real concern, not before.
9. **P1 — `@pptxdiff/server`: API-key authentication for a non-loopback bind.** Real, named,
   currently-open gap — see GAP_ANALYSIS.md and GAP_CONTEXT.md's new "Why @pptxdiff/server ships
   with no authentication..." entry. The loopback-by-default bind is a real (if partial) mitigation
   in the meantime, not a substitute for actually building this.
10. **P3 — `@pptxdiff/server`: stateful review-session endpoints** (`POST /v1/sessions`, `PATCH
    /v1/sessions/{id}/decisions|comments|merge-choices`, `GET /v1/sessions/{id}/report`), mirroring
    the GUI's `slideDiffReviewerState_v1` shape so a human on the GUI and an agent on the API can
    collaborate on the same review. This is the design doc's most distinctive value beyond "diff as
    a service" (§8) — not started.

## Packaging tickets (this session)
- [x] **P2 — Homebrew formula for `pptxdiff`.** `src/packages/pptxdiff-brew/Formula/pptxdiff.rb`,
  pinned to the published `pptxdiff@0.7.0` npm tarball (verified sha256), `depends_on "node"`, no
  `resource` blocks needed. See SPEC.md §32, GAP_CONTEXT.md's two new "Why the Homebrew formula..."
  entries.
- [x] **P2 — Red/Green TDD for the Homebrew formula, given real `brew` genuinely can't run here.**
  Attempted real `brew` twice (as root: refused outright; as a fresh unprivileged user: hit a `403`
  from the outbound proxy on `ghcr.io`, needed for Homebrew's portable-ruby) — both attempts real,
  documented, and cleaned up afterward. `src/packages/pptxdiff-brew/test_formula.mjs` (`npm test`)
  replays the formula's `install` method's exact command against the real downloaded, sha256-verified
  tarball, then runs the real resulting `pptxdiff` binary and curls it. Demonstrated genuine RED
  before GREEN: corrupted `sha256` + deleted `depends_on "node"`, confirmed exactly 2/18 assertions
  failed, restored, confirmed 18/18. See SPEC.md §32, GAP_CONTEXT.md's new "Why the Homebrew
  formula's tests replay `install`'s exact mechanics instead of running real `brew`" entry.
- [x] **P2 — Sync tooling + CI workflow for a future tap repo.** Direct follow-up to a user question
  comparing symlink/submodule/subtree approaches for syncing the formula into a separate
  `sugatoray/homebrew-pptxdiff` tap repo — all three rejected on their mechanics (see
  GAP_CONTEXT.md's new "Why the tap gets synced by a CI job..." entry). Built instead:
  `src/packages/pptxdiff-brew/lib.mjs` (shared pure/network helpers, including new
  `updateFormulaPin`), `sync-tap.mjs` (bumps a formula file's url/sha256 to a target npm version,
  idempotent, verified for real against the live npm registry), `test_sync_tap.mjs` (network-free
  Red/Green tests, genuine RED→GREEN demonstrated), and
  `.github/workflows/sync-homebrew-tap.yml` (3 jobs: bump this repo's own formula + open a PR, real
  `brew audit`/`brew install`/`brew test` on a macOS runner, then sync to the tap repo). See SPEC.md
  §33.
- [x] **P2 — `LICENSE` inside `pptxdiff-brew/`, and README/CHANGELOG/LICENSE all synced to the tap.**
  Direct follow-up: `src/packages/pptxdiff-brew/LICENSE` (real copy of root `LICENSE`, matching
  `pptxdiff-vscode/LICENSE`'s precedent) now exists, and `sync-homebrew-tap.yml` stages + pushes it
  alongside `README.md`/`CHANGELOG.md`/`Formula/pptxdiff.rb` in one PR against the tap repo. Added a
  `should_sync` job output so a manual `workflow_dispatch` always pushes the current combined state
  even without a version-pin change (a docs-only edit), while a scheduled run still only does real
  work on an actual version change. See SPEC.md §33, GAP_CONTEXT.md's two new "why" entries.
- [ ] **P3 — Create the real `sugatoray/homebrew-pptxdiff` repo + add a `HOMEBREW_TAP_TOKEN` secret
  to this repo.** The only two things left before `sync-homebrew-tap.yml`'s `sync-tap-repo` job (and
  therefore `brew tap sugatoray/pptxdiff && brew install pptxdiff`) actually works — deliberately
  left as manual/human steps, not automated by an agent (see GAP_CONTEXT.md). Not started.
- [ ] **P2 — Confirm `.github/workflows/sync-homebrew-tap.yml` actually runs green** the first time
  it fires (`workflow_dispatch` or its weekly `schedule`) — written and YAML-syntax-checked in this
  sandbox, but never executed by a real GitHub Actions runner yet. The `brew-audit` job in particular
  is the first genuine real-`brew` verification of this formula anywhere — check its logs the first
  time it runs. See GAP_ANALYSIS.md.
- [ ] **P4 — Homebrew formula for `pptxdiff-cli`**, once that package is published to npm (currently
  monorepo-local only — see its own README's `file:` dependency note).

## Done this session (Chocolatey package for pptxdiff)
- [x] **P3 — New Chocolatey package** (`src/packages/pptxdiff-chocolatey/`): `pptxdiff.nuspec`, `tools/chocolateyinstall.ps1`/`chocolateyuninstall.ps1` (thin wrapper around `npm install --global pptxdiff` / `npm uninstall --global pptxdiff`, depending on the community `nodejs` package), `tools/VERIFICATION.txt`, package-local `README.md`/`CHANGELOG.md`. See SPEC.md §34, GAP_ANALYSIS.md/GAP_CONTEXT.md's new "Chocolatey package" entries.

## New tickets opened this session
1. **P2 — Submit the Chocolatey package to the Chocolatey Community Repository** (`choco push`) once a maintainer has a Chocolatey API key and has smoke-tested `choco pack`/`choco install`/`choco uninstall` on a real Windows machine — not done this session (Linux dev/CI environment, no `choco`/`pwsh` available to execute against).
2. **P4 — Automate `pptxdiff.nuspec`'s `<version>` (and the install script's fallback pin) staying in sync with the root `package.json` version** on release, instead of a manual bump — same class of gap as `pptxdiff-vscode`'s existing manual version-bump process.

## Done this session (Red/Green regression test for the Chocolatey package)
- [x] **P2 — `test_chocolatey_package.mjs`**: pure-Node static-analysis regression test for `src/packages/pptxdiff-chocolatey/` (no `choco`/`pwsh` needed). 21 assertions covering version-sync across `pptxdiff.nuspec`/root `package.json`/the install script's fallback pin, the nuspec's `nodejs` dependency version, both `.ps1` scripts' npm commands, the cmdlet-argument-mode `+`-concatenation bug staying absent, `tools/LICENSE.txt` staying byte-identical to root `LICENSE`, and required companion files existing. Genuinely demonstrated RED (18/21, 3 real failures) before GREEN (21/21) by temporarily reintroducing a version mismatch and the PowerShell bug, then restoring both.
- [x] Ticket 2 above ("Automate version sync") is now PARTIALLY addressed: still a manual bump, but drift is caught automatically by the new test instead of shipping silently — see GAP_ANALYSIS.md's updated entry.
## Done this session (standalone native binaries for Windows/macOS/Linux) — mechanism superseded later this same session, see "switched to @yao-pkg/pkg" below
- [x] **P2 — `src/packages/binaries/`: standalone native `pptxdiff` executables via Node SEA.**
  Explicit ask, with an explicit up-front choice (asked directly): standalone binaries vs. real
  signed OS installers — user picked standalone binaries, consistent with the prior explicit
  Electron/Tauri-vs-CLI+browser decision (see GAP_CONTEXT.md). `build.mjs` bundles a small SEA entry
  point (reusing `bin/cli.js`'s `startServer()`/`buildBrowserOpenCommand()` — `startServer()` gained
  a backward-compatible optional `root` param for this) via esbuild, generates the Node SEA blob,
  injects it into a copy of the current `node` binary via `postject`, and copies the static app
  files into an `assets/` folder next to it. Output lands in
  `src/packages/binaries/pptxdiff-{win,mac,linux}/` (gitignored — build artifacts, one tracked
  `README.md` each) as a `pptxdiff-<os>-<version>.zip`. `.github/workflows/binaries.yml` runs the
  build on a 3-OS CI matrix (SEA has no cross-compile mode — each OS's binary can only be built ON
  that OS) and uploads each as a workflow artifact. `make pkg.binaries.build` / `npm run
  build:binary` build for the current host only. Verified for real on Linux (this sandbox): built,
  ran the actual packaged binary (not just `bin/cli.js`), confirmed it serves `index.html`/
  `support.js`/`vendor/*` correctly via real HTTP requests. macOS/Windows are structurally identical
  but unverified until CI runs them (no non-Linux host in this sandbox) — see GAP_ANALYSIS.md.
- [x] **P2 — Red/Green TDD for the binaries build (explicit follow-up ask), plus CHANGELOG.md per OS
  folder.** `build.mjs` refactored with an entrypoint guard (same pattern as `capture_screenshots.mjs`)
  exporting `PLATFORM_MAP`/`ASSET_ENTRIES`/`resolveTarget`/`buildBinary` for testability.
  `test_build_config.mjs` (fast/pure, `npm test`): 17 assertions including a static-source regression
  guard on `bin/cli.js`'s `startServer(root = ROOT)` signature — demonstrated genuine RED→GREEN by
  temporarily reverting that exact signature, confirming the one dependent assertion failed (16/17),
  restoring it, confirming 17/17. `test_build_e2e.mjs` (slow/real, `npm run test:e2e`, current-platform
  only): actually builds and RUNS the real packaged binary, 11/11 assertions against real HTTP
  responses (including a path-traversal check against this feature's different `root` value). Caught
  and fixed a real bug while writing the e2e test: `build.mjs`'s (and the test's own) "clean the
  output dir" step was a blind `rm -rf` that would have deleted the tracked `README.md`/`CHANGELOG.md`
  living in the same per-OS folder on every build — fixed with a `cleanGeneratedOutDir()` that removes
  only the specific generated entries; verified by running the real build twice in a row and
  confirming both docs files survive. `src/packages/binaries/pptxdiff-{win,mac,linux}/CHANGELOG.md`
  added (Keep a Changelog format, tracks the bundled `pptxdiff` app version). Root `CHANGELOG.md`
  `[Unreleased]` section filled in for this whole feature (previously an empty placeholder). See
  SPEC.md §32, WISDOM.md's new "clean the output dir" trap entry.

## New tickets opened this session
1. **P2 — Attach the built binaries to GitHub Releases**, not just CI workflow artifacts. Needs a
   `release: types: [published]`-triggered job (or similar) that re-runs the build and uploads the
   binaries to the release — not built this session, current CI only produces downloadable workflow
   artifacts on push/dispatch.
2. **P3 — Code signing for the Windows `.exe` and a real Apple Developer ID for macOS.** Needs a
   purchased/managed certificate (real ongoing cost, not a code change) — until then, both binaries
   trigger their OS's "unidentified/unsigned" security warning on first run. Documented per-OS in
   each `pptxdiff-<os>/README.md`.
3. ~~**P4 — True single-file binaries via Node SEA's embedded-asset store.**~~ **[DONE, by switching
   mechanism entirely]** — see the `@yao-pkg/pkg` switch below. `pkg`'s built-in asset embedding gave
   a genuine single file with zero `bin/cli.js` changes, superseding this ticket rather than closing
   it as originally scoped.
4. ~~**P4 — `test_build_e2e.mjs` only exercises the CURRENT host's platform branch.**~~ Still true
   under `pkg` (same reason: only the current host's binary can actually be RUN and verified over
   HTTP locally) — carried forward, not re-opened as new.

## Done this session (switched `@pptxdiff/binaries` from Node SEA to `@yao-pkg/pkg`)
- [x] **P2 — Switched the native-binary build mechanism after an explicit follow-up question** ("why
  aren't you using yao-pkg/pkg?"). Investigated hands-on rather than reasoning abstractly: built real
  test binaries in this sandbox confirming `pkg` genuinely cross-compiles (a real Linux-built `.exe`
  confirmed via `file` as `PE32+ executable ... for MS Windows`, a real Linux-built mac binary
  confirmed as `Mach-O 64-bit x86_64 executable`) and that its snapshot filesystem lets `bin/cli.js`
  serve its static assets with ZERO code changes (reverted the SEA-era `root` parameter entirely —
  `bin/cli.js` is now byte-identical to before this whole feature, confirmed via `git show` diff).
  `build.mjs` rewritten around `pkg`'s `exec()` API (`buildOne(osKey, target)`/`buildAll(osKeys)`),
  `sea-entry.cjs` deleted (no longer needed — `pkg` points directly at the real `bin/cli.js`).
  Output is now a true single file per OS (no more `assets/` folder, no more zip wrapper).
- [x] **Found and fixed a real, silently-failing gotcha mid-switch**: `pkg`'s `"assets"` glob paths
  resolve relative to wherever the CONFIG FILE ITSELF lives, not cwd or the entry file's directory —
  confirmed via a controlled A/B test (moving the config file between directories with the identical
  glob, watching assets silently stop embedding with zero error). Fixed by having `buildOne()` write
  its temp pkg config directly at `REPO_ROOT` (removed in a `finally`); new WISDOM.md trap entry with
  the full reproduction, since this fails completely silently at build time.
- [x] **`.github/workflows/binaries.yml` restructured to 2 jobs** (from the original 3-OS matrix):
  `build-linux-win` on `ubuntu-latest` builds both those targets in one job (genuine cross-compile);
  `build-mac` stays on its own `macos-latest` runner — NOT collapsed into the Linux job, because
  `codesign` only exists on macOS and a completely unsigned binary may not even launch on Apple
  Silicon (AMFI requires at least an ad-hoc signature) — see GAP_CONTEXT.md's new entry for the full
  reasoning on why this one target intentionally isn't cross-compiled despite `pkg` technically being
  able to.
- [x] **Both test files (`test_build_config.mjs`/`test_build_e2e.mjs`) rewritten for the new shape**
  and re-verified with genuine RED→GREEN on the sharpest new guard (the config-colocation regression
  check) — moved the temp-config write location, confirmed the test caught it (17/18), restored,
  confirmed 18/18. `test_build_e2e.mjs` re-run for real against the new mechanism: 10/10, a real
  binary built via `pkg` and run, serving the real app over real HTTP, with an explicit assertion
  that no separate `assets/` folder exists anymore.
- [x] Per-OS `README.md`/`CHANGELOG.md` (both still-unreleased, so amended in place rather than
  given a second changelog entry) updated to describe the single-file artifact and, for macOS
  specifically, the "must be built on a real Mac" constraint.
- [x] Root `CHANGELOG.md`'s `[Unreleased]` section updated to match (mentions `@yao-pkg/pkg`, the
  2-job CI split, and the Red/Green test suite — no longer mentions Node SEA or `startServer`'s
  `root` param, since that was fully reverted).

## Done this session (native Apple Silicon build: `pptxdiff-mac-arm64`)
- [x] **P3 — Added `pptxdiff-mac-arm64`, a native Apple Silicon binary**, after an explicit follow-up
  question ("does the mac binary work for Apple Silicon MacBooks?"). Before this, Apple Silicon Macs
  could only run the Intel `pptxdiff-mac` binary via Rosetta 2 translation. `TARGET_MAP` gained an
  `outDirKey` field (separate from the map key) so `mac`/`mac-arm64` share `pptxdiff-mac/` as their
  output folder while keeping distinct `binName`s — `buildOne()` computes `outDir` from
  `target.outDirKey`, not the `osKey` it's called with. `.github/workflows/binaries.yml`'s `build-mac`
  job now builds both mac targets (`npm run build -- mac mac-arm64`) and uploads both as separate
  artifacts; `test_build_e2e.mjs` picks `mac` vs `mac-arm64` based on the host's actual `os.arch()`,
  so GitHub's Apple-Silicon `macos-latest` runners genuinely exercise the native build. Verified for
  real in this sandbox (Linux): built the `node22-macos-arm64` target directly, confirmed via `file`
  it's a genuine `Mach-O 64-bit arm64 executable`, confirmed it landed in the shared `pptxdiff-mac/`
  folder without disturbing the tracked `README.md`/`CHANGELOG.md`, and confirmed `pkg`'s own error
  output independently prints the same Apple-Silicon-signing warning this project's reasoning already
  relied on. Windows/Linux stay x64-only — not asked about, and arm64 desktops are a much smaller
  fraction of that audience than Apple Silicon is of the Mac audience (see GAP_CONTEXT.md).
- [x] **Genuine RED→GREEN demonstrated on the new `outDirKey` guard**: temporarily reverted
  `buildOne()`'s `outDir` computation to use the `osKey` argument instead of `target.outDirKey`,
  confirmed the dedicated regression test caught it (22/23), restored it, confirmed 23/23.
- [x] Per-OS mac `README.md`/`CHANGELOG.md`, the top-level `src/packages/binaries/README.md`, root
  `CHANGELOG.md`, `SPEC.md` §32, `GAP_ANALYSIS.md`, and `GAP_CONTEXT.md` all updated to describe both
  mac targets.

## New tickets opened this session
1. **P4 — Native Windows/Linux arm64 builds**, if ever asked for — `pkg` supports
   `node22-win-arm64`/`node22-linux-arm64` equally well; not attempted since neither was asked about
   and arm64 desktop/laptop usage is comparatively rare for those two OSes among this app's likely
   users (see GAP_CONTEXT.md).
2. **P4 — Investigate `ldid` for Linux-side ad-hoc signing of macOS binaries**, which `pkg`'s own
   error output suggests as an alternative to a real macOS CI runner — would let `build-mac` fold
   into the cross-compiled `build-linux-win` job (one CI job instead of two). Not pursued; a real
   `macos-latest` runner using Apple's own `codesign` was judged more trustworthy for a first pass —
   revisit if CI job count/time ever becomes a real constraint.
