# Changelog — Documentation Site

All notable changes to the **documentation framework** itself — the MkDocs
site's tooling, structure, build/content-generation mechanisms, and
maintenance scripts under `src/pptxdiff/docs-site/` — are documented here.

This is **not** the app's changelog. For pptxdiff feature/bugfix history see
the root [`CHANGELOG.md`](https://github.com/sugatoray/pptxdiff/blob/master/CHANGELOG.md)
(also published on the site itself, unmodified, at `docs/changelog.md`). This
file only covers changes to how the docs site is built and maintained —
adding a plugin, restructuring the toolchain, changing how content gets
generated or verified. Routine content edits to an existing page (fixing a
typo, expanding a paragraph) don't need an entry here; see
`docs/.scrolls/STARTER.md` for exactly where that line sits.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Since the docs site doesn't ship its own version number (it's built and
deployed alongside the app, not released independently), entries are dated
instead of versioned. Full technical detail behind every entry below lives in
`docs/.scrolls/DOCS.md` (linked per entry) — this file is the scannable
summary, that one is the record of *why*.

## [Unreleased]

No changes yet.

## 2026-07-26 — Staging + pixel-level compare-and-promote for generated screenshots

### Added

- `scripts/compare_images.py` — pixel-level (decoded, not byte/hash) image comparison, PNG and animated GIF, importable or CLI.
- `capture_screenshots.mjs`: `--staging-dir` / `--target-dir` / `--check` flags. Every capture now lands in a staging directory first and is only promoted into the committed `docs/assets/img/` when it's genuinely new or pixel-different from what's already there.
- `scripts/scenario-manifest.json` — a committed baseline locking each capture scenario's viewport, crop mode, and frame rate, so a routine rerun can't silently change what "unchanged" means.
- Three new test files (`test_compare_images.py`, `test_scenario_manifest.mjs`, `test_sync_staging_to_target.mjs`), each verified Red before Green, plus a deliberate-break-and-catch rigor pass on all three.
- `.gitignore` entry for the new staging directory.

### Changed

- `capture_screenshots.mjs`'s `main()` is now guarded behind an entrypoint check so its scenarios and promotion logic are importable by tests without a live browser/server run.

See [DOCS.md §11](../../../docs/.scrolls/DOCS.md#11-staging--pixel-level-compare-and-promote-and-a-real-test-suite-for-both-added-later-this-session) for the full writeup, including a documented (not hidden) limitation: the one GIF scenario isn't pixel-deterministic across reruns and will report "updated" every time, unlike the PNG scenarios.

## 2026-07-26 — Reusable Playwright screenshot/GIF capture tool

### Added

- `scripts/capture_screenshots.mjs` — drives the real `bin/cli.js` server through 9 named scenarios (Playwright), producing every current docs-site screenshot plus the dark-mode-toggle GIF. `--list` / `--only` / `--out-dir` / `--headed` / `--keep-gif-frames` flags.
- `scripts/webm_to_gif.py` — Pillow-based GIF assembly from an extracted PNG frame sequence, with a brightness-based heuristic to drop Playwright video's blank leading frames.
- Per-scenario viewport override support, so a GIF documenting a small interaction can use a tight crop instead of the full page.

Turns what had been a one-off, by-hand capture process into a committed, rerunnable tool. See [DOCS.md §10](../../../docs/.scrolls/DOCS.md#10-capture_screenshotsmjs--the-screenshotsgif-capture-tool-is-now-a-committed-reusable-script-added-later-this-session).

## 2026-07-26 — Real screenshots/GIF; closed all documentation-coverage gaps

### Added

- 9 real screenshots + 1 GIF, captured by driving the actual served app (not mockups), wired into `getting-started.md` and 8 `features/*.md` pages.
- 8 new rows in `limitations.md` (diff-engine, deck-comparison, batch, testing-fixtures, accessibility, packaging, offline-capability, lite-mode), sourced from `GAP_ANALYSIS.md`, closing every gap the coverage tracker's first run had found.

### Changed

- Re-ran `sync_doc_coverage.py --write`: documentation coverage went from 25/33 to 33/33.

See [DOCS.md §9](../../../docs/.scrolls/DOCS.md#9-real-screenshotsgif-and-the-8-coverage-gaps-closed-added-later-this-session).

## 2026-07-26 — Documentation coverage tracking system

### Added

- `scripts/coverage_registry.yml` — canonical checklist of 21 features + 12 limitations, curated from `SPEC.md`/`GAP_ANALYSIS.md`.
- `doc_coverage:` YAML front matter (`id`/`quality`/`anchor`) on all 17 content pages that document something.
- `scripts/sync_doc_coverage.py` (`--write`/`--check`) — the Red/Green regression test for coverage-page structural integrity (dangling ids, broken anchors, duplicate registry entries, staleness).
- `documentation-coverage.md` — a Jinja-rendered coverage report page (`render_coverage_summary()`/`render_coverage_table()`), and `main.py` defining those macros.
- `mkdocs-macros-plugin` dependency, added to `pyproject.toml`'s `docs` dependency group, scoped with `render_by_default: false` so Jinja rendering stays opt-in per page (protects this app's own `{{ }}`-style template syntax from being misinterpreted as Jinja anywhere else in the docs).

First honest baseline: 25/33 items complete, deliberately left un-padded in this same change. See [DOCS.md §8](../../../docs/.scrolls/DOCS.md#8-documentation-coverage-tracking-added-later-this-session).

## 2026-07-26 — Offline-capability content corrections

### Fixed

- Corrected 7 pages (`architecture.md`, `limitations.md`, `getting-started.md`, `index.md`, `faq.md`, `cli.md`, `features/rendering.md`) that described the app as CDN-dependent/requiring internet access — stale after the app became fully offline-capable by default on a separate branch, surfaced when that branch was rebased onto this docs site.

### Added

- `cli.md`: a "Lite mode (CDN sourcing)" section documenting `PPTXDIFF_LITE_MODE`.
- `features/ui-shortcuts.md`: an "Offline Mode" section documenting the in-app corner toggle.

See [DOCS.md §7](../../../docs/.scrolls/DOCS.md#7-content-updates-offline-capability-pptxdiff_lite_mode-offline-mode-toggle-added-later-this-session).

## 2026-07-26 — Initial site scaffold

### Added

- Documentation site built with **mkdocs-material**, chosen over GreatDocs, Sphinx, and Zensical (evaluated on maintainability, Markdown-native authoring, and fit for a project with no Python API to introspect — see the decision matrix in `DOCS.md` §3). Zensical noted as the intended future migration target once it leaves alpha.
- Full page set under `docs/`: home, getting started, 10 feature pages, CLI reference, VS Code extension, architecture, limitations, FAQ, and a changelog page that transcludes the root `CHANGELOG.md` via `pymdownx.snippets` (one source of truth, can't drift).
- `[dependency-groups] docs` in `pyproject.toml` (`mkdocs`, `mkdocs-material`), wired into the existing `uv` setup without touching the app's own zero-runtime-dependency posture.
- `.gitignore` entry for this site's own `site/` build output.

See [DOCS.md §1-§6](../../../docs/.scrolls/DOCS.md#1-the-ask) for the full tool evaluation and build notes.
