---
doc_coverage:
  - id: self-tests
    quality: complete
---

# Self-tests

PptxDiff carries its own in-browser regression suite — no separate test runner, no build step, no CI required to exercise it.

## Running them

Click **Run self-tests** in the app. `runSelfTests()` is `async` and reports pass/fail results in a panel once it completes.

## What's covered

- Word-level diff correctness
- Slide similarity scoring
- Deck alignment (add / remove / move scenarios, including the exact same-position-vs-moved tie-break case)
- Duplicate detection (same-deck and cross-deck)
- Scheme-color resolution
- Key-namespacing (the `pairKey`/`pairKey::diffKey` conventions used throughout decisions/comments/merge)
- Diff rollups ("X of Y reviewed")
- Filename similarity (used by batch mode's filename-pairing mode)
- A real merge-export round-trip: builds a 2-slide `.pptx` via `buildPptx`, re-parses it with the app's own reader, and asserts slide count and text survived
- Every pure decision/builder function added alongside a feature — `mergeReportPatch`, `buildConfluenceNewBody`, `interpretSlackDeliveryOutcome`, `buildCredsPayload`, `computeDecisionsToClear`, `buildConfirmConfig`, `computeLiteModeToggleUrl` (the [Offline Mode toggle](ui-shortcuts.md#offline-mode)'s URL logic), and others — each with a dedicated Red/Green test

## A standing regression guard

`checkStaleMethodRefs()` is the **first** self-test that runs. It walks the full rendered-template output tree and statically scans every function's source for dead `this.xxx()` calls — references to methods that no longer exist. This exists because a refactor once caused a full blank-page incident from exactly that kind of stale reference; the guard catches a repeat before it ships.

## Why this matters for a single-file app

Because the whole application is one HTML file with no build step, there's no separate `npm test` to run in CI before a change ships. The self-test suite is how correctness gets checked *in the same environment the app actually runs in* — a real browser, against the app's own real parsing/rendering/diffing code, not a mocked unit-test harness. New features in this codebase are built pure-function-first (extract a pure decision/builder function, write a Red/Green test against it, then wire the impure DOM/network/`localStorage` shell around it) specifically so this pattern stays fast and reliable as the app grows.
