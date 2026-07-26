# DOCS.md — Documentation Site: Analysis & Implementation Notes

Written 2026-07-26. Covers the decision behind, and implementation of, the documentation website at `src/pptxdiff/docs-site/`.

**Updated later the same session** (§7-§8 added): a separate branch/PR added offline-capability + `PPTXDIFF_LITE_MODE` content across most pages, and built a documentation-coverage tracking system (registry + front matter + sync script + Jinja-rendered coverage page). Per the standing rule now in `STARTER.md`, this file is the place any future documentation-related change gets checked against/recorded in — read §7-§8 before touching anything under `docs-site/`, not just §1-§6.

## 1. The ask

Build a visually appealing documentation website for `pptxdiff` (the npm library/app in `src/pptxdiff/`), living inside `src/pptxdiff/`, with a walkthrough of every feature. Evaluate **GreatDocs**, **Zensical**, **mkdocs-material**, and **Sphinx** first, and pick one — factoring maintainability, features, bugs, vulnerabilities, funding, and developer track record. Stated preference: **author docs in plain Markdown**.

## 2. What `pptxdiff` actually is (this drove the decision more than anything)

`pptxdiff` is **not a Python package** and is barely a conventional JS package either — there's no `export`ed API to introspect. It's:

- One self-contained HTML file (`src/pptxdiff/index.html`) — template + UI + diff engine, authored as a single-file Design Component.
- A zero-dependency Node CLI (`bin/cli.js`) that only serves that file locally.
- A VS Code extension that only opens that same served page.

There is no Python surface at all beyond incidental dev tooling (`gen-sample-pptx.mjs`'s companion test script, `test_gen-sample-pptx.py`, used to validate generated `.pptx` fixtures — not part of the shipped product). This matters because it **rules out the entire category of "introspect the code, auto-generate API reference" tools** for the primary content. What's needed instead is a **hand-written, narrative feature walkthrough** — which is exactly the user's stated preference (plain Markdown) anyway.

## 3. Option-by-option analysis

### GreatDocs (`posit-dev/great-docs`) — ruled out

- **What it is**: a documentation-site generator from Posit, PBC (the RStudio company), released 2026. `great-docs init` + `great-docs build` auto-discovers a **Python package's** public API (via `__all__`/`dir()`/static analysis), detects the docstring format, and generates full reference pages — plus a Click-CLI reference, user guide, changelog, and landing page. Under the hood it generates Quarto `.qmd` files and renders them via Quarto; it does accept plain Markdown for hand-written prose pages (e.g. a `user_guide/` folder), so the "write in Markdown" preference is *partially* satisfiable, but the tool's entire value proposition — and its `init` command's main output — is Python API-introspection.
- **Maintainability/funding/track record**: strong. MIT-licensed, backed by Posit (a real company with a long, credible open-source track record — Shiny, `renv`, `reticulate`, etc.), actively developed in 2026, and unusually well-tested for a young project (a "gauntlet" of 300+ synthetic packages, 15,600+ tests per the project's own docs).
- **Why it's the wrong fit here**: its core mechanism — Python docstring/API introspection — has **nothing to introspect** in this repo. Using it would mean either (a) fighting the tool to suppress the API-reference machinery entirely and using it as a generic Quarto wrapper, which throws away its main advantage, or (b) inventing a fake Python surface just to have something for it to scan. Neither is a sound reason to adopt a new templating pipeline (Quarto) on top of Markdown. **Verdict: excellent tool, wrong problem.**

### Sphinx — ruled out (for this project)

- **Maintainability/track record**: the most battle-tested option by a wide margin — powers Python's own documentation, NumPy, Django, and most of the Python ecosystem; decades of continuous maintenance, a large plugin ecosystem, no realistic abandonment risk.
- **Markdown support**: native format is reStructuredText; Markdown is supported via the `myst-parser` extension (MyST — "Markedly Structured Text"), which is itself mature and widely used (e.g. Jupyter Book). So the "write in Markdown" preference is achievable, just not the zero-config default.
- **Why not chosen**: Sphinx's strengths — cross-referencing a large API surface, `autodoc`, intersphinx, versioned multi-project docs — are aimed squarely at large, API-heavy Python codebases. This project has no such API surface (see §2). Adopting Sphinx here would mean carrying its heavier conceptual model (domains, roles, the `toctree` directive, RST-first theme ecosystem) for a purely narrative, feature-walkthrough site that doesn't need any of that power. It's not a bad choice in absolute terms, just more machine than this job needs.

### Zensical — ruled out for now, but noted as the future migration target

- **What it is**: a from-scratch, Rust-core successor to Material for MkDocs, built by the *same team* (Martin Donath / squidfunk) specifically to fix scaling and architectural limits they hit after a decade on MkDocs. MIT-licensed, designed for drop-in compatibility with existing `mkdocs.yml`-based Material projects, and reported to build 4–5× faster on incremental/served builds.
- **Funding/track record**: as credible as it gets for this space — the same person/team responsible for Material for MkDocs, which is one of the most widely deployed documentation themes in the world (tens of thousands of production sites, a paid Insiders program funding the work). This is a team with a long, proven record of shipping and maintaining developer tooling at scale.
- **Why not chosen yet**: checked its PyPI listing directly (`pip index`/PyPI metadata) as of **2026-07-26** — latest release is `zensical 0.0.51` (2026-07-17), **Development Status :: 3 - Alpha**. Not marked stable, not positioned by its own authors as production-ready yet. Building the primary site on alpha software today is an avoidable risk for no real benefit — the compatibility promise means migrating later is expected to be low-effort.
- **Verdict**: this is very likely where the site ends up in 12–18 months. It is *not* where it should start today.

### mkdocs-material — **chosen**

- **What it is**: the Material theme for MkDocs — the dominant Markdown-native documentation generator/theme combination in the Python and broader OSS ecosystem (used by e.g. FastAPI, Pydantic, Kubernetes-adjacent projects, and thousands of others).
- **Markdown support**: this is the primary reason it wins here — content is plain Markdown, full stop, with a rich but optional extension set (admonitions, tabbed content, collapsible details, code-copy buttons, task lists, footnotes) via the well-maintained `pymdown-extensions` package. Exactly matches the user's stated preference.
- **Maintainability/funding**: extremely mature (MkDocs itself: 10+ years; Material theme: since 2016), huge plugin ecosystem, funded via squidfunk's Insiders sponsorship program (the same funding model backing Zensical's development). **However**, as of this writing the project's own build output surfaces a direct warning from the maintainers:

  > MkDocs 2.0 [...] will introduce backward-incompatible changes [...] All plugins will stop working [...] No migration path exists [...] Currently unlicensed – unsuitable for production use.
  >
  > — printed by `mkdocs build`/`mkdocs serve` themselves, linking to <https://squidfunk.github.io/mkdocs-material/blog/2026/02/18/mkdocs-2.0/>

  Read together with the project's second official post (<https://squidfunk.github.io/mkdocs-material/blog/2025/11/05/zensical/>): Material for MkDocs (the *theme*, what this site actually uses) is in **maintenance mode** — the last feature release was `9.7.0` (2025-11-11), and it reaches **end-of-life on 2026-11-05**, after which only the team's *separate* "MkDocs 2.0" fork/experiment (not the same thing as today's stable `mkdocs` + `mkdocs-material` combination) continues under a currently-unlicensed, closed-contribution model. Today's `pip install mkdocs-material` (9.7.7 at time of writing) is unaffected by any of this — it's the same actively-supported 1.x-era MkDocs + Material stack that has been standard for years, just now confirmed to be on a clock for *new features* (critical bug fixes/security patches continue through the EOL date).
- **Why chosen anyway**: for a project this size, "in maintenance mode until Nov 2026, then superseded by a compatible successor" is a perfectly reasonable position to build on *today* — not a reason to avoid it. Zensical's explicit design goal is to build existing Material projects with minimal changes, so this site is a low-friction migration candidate once Zensical leaves alpha. Meanwhile mkdocs-material is: markdown-native (matches the ask), immediately production-ready (not alpha), has the plugin/extension maturity to look genuinely polished with almost no custom CSS, and has zero fit-mismatch with what's being documented (a narrative feature walkthrough, not an API reference).

### Decision matrix

| | GreatDocs | Sphinx | Zensical | **mkdocs-material** |
|---|---|---|---|---|
| Markdown-native authoring | Partial (Quarto `.qmd` primary) | Via MyST plugin | Yes | **Yes** |
| Fits pptxdiff's shape (no Python API to introspect) | No — built around Python API introspection | Overkill — built for large API-heavy docs | Yes | **Yes** |
| Production-ready today | Yes | Yes | **No — alpha (0.0.51)** | **Yes** |
| Maintenance status | Active | Active, extremely stable | Active, pre-1.0 | Active but feature-frozen; EOL 2026-11-05 |
| Funding / track record | Posit, PBC (RStudio) | Decades, ecosystem-wide | squidfunk/Insiders (same as Material) | squidfunk/Insiders |
| Visual polish out of the box | High | Theme-dependent (needs e.g. Furo) | High (inherits Material's design) | **High** |
| Future migration path | N/A | N/A | Is the successor | **→ Zensical, by design, when stable** |

**Chosen: mkdocs-material**, with the explicit intent to re-evaluate a Zensical migration once it leaves alpha (tracked informally here — no need for a separate backlog ticket unless/until Zensical ships a stable 1.0).

## 4. What was built

```
src/pptxdiff/docs-site/
  mkdocs.yml               # site config: nav, Material theme, markdown extensions, snippets, macros plugin
  main.py                  # mkdocs-macros-plugin hook (module_name: main) — see §8
  README.md                # how to preview/build this site
  scripts/
    coverage_registry.yml   # canonical feature/limitation checklist — see §8
    sync_doc_coverage.py    # --write/--check the documentation-coverage page — see §8
  docs/
    index.md               # home page — feature grid, screenshots, install tabs
    getting-started.md      # npx/npm/file install options, dev workflow, project structure
    features/
      index.md              # walkthrough table of contents
      rendering.md           # rendered vs. schematic, change-highlight overlays
      diff-engine.md         # everything diffed per slide pair
      deck-comparison.md     # alignment, ADDED/DELETED/MOVED/CHANGED, All-pairs/Batch views
      duplicate-detection.md # same-deck + cross-deck duplicates
      reviewer-workflow.md   # reviewers, approvals, comments, history, clear-decisions scopes
      batch-mode.md          # multi-pair upload, pairing modes, drag reorder
      merge.md                # per-diff picks, merge-winner preview, beta .pptx export
      exports.md              # PDF/HTML/JSON/CSV/Markdown/Notion/Confluence + live push
      ui-shortcuts.md         # dark mode, keyboard shortcuts, touch, accessibility, Offline Mode toggle
      self-tests.md           # the in-browser Red/Green regression suite
    cli.md                  # bin/cli.js reference, incl. PPTXDIFF_LITE_MODE
    vscode-extension.md      # the VS Code extension
    architecture.md          # why one file, no backend, vendored runtime deps, testing philosophy
    limitations.md           # known/accepted trade-offs table
    faq.md
    changelog.md             # transcludes the real root CHANGELOG.md via pymdownx.snippets
    documentation-coverage.md # Jinja-rendered coverage report — see §8
    assets/img/               # copies of docs/assets/*.png used on the site
```

Content was sourced directly from `docs/.scrolls/SPEC.md` (the authoritative feature spec), `README.md`, and `CHANGELOG.md` — not invented. Every feature page maps to a section of `SPEC.md`.

### Key implementation choices

- **Site lives under `src/pptxdiff/` per the request**, as `docs-site/` (a sibling to `index.html`), rather than reusing the repo-root `docs/` directory — which already means something else in this repo (project working-memory scrolls + static image/`.pptx` assets), not a documentation website. Keeping them separate avoids overloading `docs/`'s existing meaning.
- **`docs/changelog.md` transcludes the real `CHANGELOG.md`** (via `pymdownx.snippets` with `base_path: ["."]`, included with `--8<-- "CHANGELOG.md"`) instead of duplicating it — one source of truth, can't drift.
- **Python tooling wired into the existing `uv`/`pyproject.toml` setup**: added a `[dependency-groups] docs = ["mkdocs>=1.6.1", "mkdocs-material>=9.7.7", "mkdocs-macros-plugin>=1.3.7"]` group, so `uv run --group docs mkdocs ...` works without polluting the app's runtime dependency list (which stays JS-only, no runtime deps — see `package.json`). `mkdocs-macros-plugin` was added later, in the same session that built the documentation-coverage tracker — see §8.
- **`.gitignore`** gained `src/pptxdiff/docs-site/site/` (the root already ignored `/site` and `docs/_build/`, but that pattern is anchored to the repo root and wouldn't have caught this site's own build output one level down).
- **Mermaid support is configured but unused**: `mkdocs.yml` includes the standard `pymdownx.superfences` custom-fence wiring for Mermaid diagrams (in case a future page wants one), but no page currently uses it — a test diagram in `architecture.md` was replaced with a plain-text box diagram after confirming Mermaid's dynamic CDN-loaded JS doesn't render reliably in this sandboxed build/preview environment. Nothing about this choice affects the shipped site (there was no shipped Mermaid content).
- **Social icon fix**: `extra.social` originally referenced `simple/visualstudiocode`, which isn't bundled in this Material version's icon set — swapped for the bundled `material/microsoft-visual-studio-code`.

### Verification performed

- `mkdocs build --strict` — clean, zero warnings/errors (only Material's own informational MkDocs-2.0 notice prints; it isn't a build warning and doesn't fail `--strict`).
- Served the built `site/` locally and screenshotted the home page, a feature page, the architecture page, and the changelog page with Playwright/Chromium — confirmed: grid cards, tabbed install instructions, admonitions, data tables, dark/light toggle, sidebar nav + table-of-contents, and the transcluded changelog all render correctly and look polished with zero custom CSS.

## 5. How to build/preview

```bash
# from the repo root
uv run --group docs mkdocs serve -f src/pptxdiff/docs-site/mkdocs.yml   # live preview, http://127.0.0.1:8000
uv run --group docs mkdocs build -f src/pptxdiff/docs-site/mkdocs.yml --strict   # production build → docs-site/site/
```

Not wired into CI/deployment (e.g. GitHub Pages) in this session — no publishing target was specified. `site_url` in `mkdocs.yml` is set to `https://sugatoray.github.io/pptxdiff/` as a placeholder for a future GitHub Pages deploy; update it if the real publish target differs.

**Later-session addendum**: `uv run --group docs ...` also resolves and installs the ROOT `[project]` dependencies (`headroom-ai[all]`, which pulls in `torch`/CUDA packages — hundreds of MB, and in a network-restricted sandbox this can time out entirely). Prefer `uv run --only-group docs ...` for anything docs-site-only (building, serving, running `sync_doc_coverage.py`) — it installs just the `docs` group's own packages and is dramatically faster/more reliable. Only use `--group docs` (not `--only-group`) if you specifically also need the root project's dependencies available in the same invocation.

## 6. Maintenance notes for future sessions

- **Keep `docs-site/docs/features/*.md` in sync with `docs/.scrolls/SPEC.md`** when shipping a new feature — `SPEC.md` is the source of truth for *what* the app does; the doc site is the reader-facing explanation of the same features. They should never contradict each other.
- **`changelog.md` needs no manual updates** — it transcludes the real file.
- **Revisit Zensical** once it ships a stable (non-alpha) release — check `pip index versions zensical` or its PyPI page; migration is expected to be low-effort given the team's explicit compatibility goal with existing Material `mkdocs.yml` projects.
- **When you add or change a page's `doc_coverage:` front matter (see §8), re-run `sync_doc_coverage.py --write` and commit the regenerated `documentation-coverage.md` in the same change** — don't leave it stale for someone else to notice. `--check` will catch a forgotten regeneration (see §8), but don't rely on that as the first line of defense; it's a safety net, not a substitute for actually running `--write`.
- **This file (DOCS.md) is the standing reference for anything about the docs SITE itself** — tooling, layout, cross-page mechanisms like the coverage tracker. Per `STARTER.md`, read it before any docs-site change beyond routine single-page content edits, and update it (not just SPEC.md/HANDOFF.md) whenever such a change happens. Routine content edits to an EXISTING page (fixing a typo, adding a paragraph to an existing feature page) don't need a DOCS.md update — see the `STARTER.md` note for exactly where that line sits.

## 7. Content updates: offline capability, `PPTXDIFF_LITE_MODE`, "Offline Mode" toggle (added later this session)

A separate line of work in the same session made pptxdiff fully offline-capable by default (vendoring React/ReactDOM/Babel/JSZip/`pptx-renderer`/fonts — see `SPEC.md` §24) and added an opt-in `PPTXDIFF_LITE_MODE` escape hatch back to CDN sourcing, in three forms: an env var, a `?lite=1` query param, and an in-app corner toggle (see `SPEC.md` §25). This is an APP feature, documented per this file's own §6 rule (SPEC.md is the source of truth for what the app does; the doc site explains it):

- **7 pages corrected**, not just extended: `architecture.md`, `limitations.md`, `getting-started.md`, `index.md`, `faq.md`, `cli.md`, `features/rendering.md` were all originally written (§1-§6 above) against a CDN-dependent app — genuinely accurate when written, since this docs-site session and the offline-vendoring session forked from the same commit and were developed independently. Rebasing one onto the other surfaced the contradiction; every stale "requires internet"/"loaded from a CDN" claim was corrected to match the vendored reality rather than left to rot.
- **New content added**: `cli.md` gained a full "Lite mode (CDN sourcing)" section; `features/ui-shortcuts.md` gained an "Offline Mode" section (the natural home, next to the dark-mode toggle it's styled to complement) covering the in-app corner toggle; `architecture.md`'s "Runtime dependencies" section got a pointer to the opt-out.
- **Lesson for future doc-site work**: when an app-level change lands on a DIFFERENT branch than the one currently touching the docs site, expect exactly this kind of staleness on rebase/merge — grep the docs site for the specific claim being invalidated (here: `CDN`/`internet`/`unpkg`/`esm.sh`/`cdnjs`/`fonts.googleapis`) rather than assuming a page untouched by your own branch is still accurate.

## 8. Documentation coverage tracking (added later this session)

A programmatic tracker for whether every known pptxdiff feature and limitation actually has real documentation on this site — not a vibe check. Built in response to an explicit ask, using MkDocs Material's YAML front matter + `mkdocs-macros-plugin` for real Jinja-in-Markdown rendering (Material alone only Jinja-templates the *theme*, never page bodies — this needed an explicit added dependency). Full technical writeup lives in `SPEC.md` §26 (it's as much an app-adjacent feature as a docs-site one); this section covers the docs-SITE-specific implementation choices.

- **`scripts/coverage_registry.yml`** — the canonical checklist (21 feature ids + 12 limitation ids), curated from `SPEC.md`/`GAP_ANALYSIS.md` rather than inventing a parallel taxonomy. NOT under `docs/`, not built by mkdocs.
- **Per-page `doc_coverage:` front matter** (`id`/`quality`/`anchor?`) — added to all 17 content pages that document something. Human-readable titles live ONLY in the registry (pages reference by `id`); this was a direct response to a design-review question ("does front matter `title:` reflect what you want shown?") that flagged the risk of duplicating/mismatching title strings across many files before any code existed.
- **`scripts/sync_doc_coverage.py --write`/`--check`** — PEP 723 standalone (matches `test_gen-sample-pptx.py`'s existing convention), `uv run`-able, `pyyaml` as its only dependency. `--check` is the actual Red/Green test: fails on dangling ids, broken anchors, duplicate registry entries, or staleness (NOT on incomplete coverage — `partial`/`missing` are legitimate, non-failing states). Verified for real, not just described: RED before the coverage page existed, GREEN after `--write`; then three deliberate breaks (bad id, bad anchor, duplicate registry id) each caught with a specific message, each fixed back to GREEN.
- **`documentation-coverage.md` + `main.py`** — the page's body is two Jinja macro calls (`render_coverage_summary()`, `render_coverage_table(kind=...)`) reading that page's OWN `coverage_summary` front matter straight off disk inside `main.py` (not via the plugin's live "current page" API — simpler, and doesn't depend on plugin-internals staying stable across versions).
- **The one real technical risk, and how it was closed**: `mkdocs-macros-plugin`, left at its default config, would try to Jinja-evaluate ANY literal `{{ }}` appearing anywhere in the docs — and this app's OWN template syntax (`index.html`) literally IS `{{ theme.border }}`-style. Set `render_by_default: false` in `mkdocs.yml` so Jinja rendering is opt-in per page (`render_macros: true` in front matter), not opt-out. Checked the current docs tree first (`grep -rn '{{' docs-site/docs/` — zero real hits) but the scoping decision is what keeps this closed permanently, including against a FUTURE page that quotes the app's template syntax.
- **First honest baseline, deliberately not padded**: 25/33 items complete (21/21 features, 4/12 limitation categories) as of when this was built. The 8 missing are real, pre-existing gaps already in `GAP_ANALYSIS.md` that were simply never carried into the public `limitations.md` or any feature page — left `missing` in the same session the tracker shipped rather than quickly patched, so the tool's first-ever report is a true baseline. See `GAP_CONTEXT.md`'s entry on this for the reasoning against padding a tool's own first measurement.
- **Maintenance**: see §6's new bullet above — run `--write` and commit the regenerated page in the SAME change as any `doc_coverage:` edit.

## 9. Real screenshots/GIF, and the 8 coverage gaps closed (added later this session)
Two follow-ups, done together per explicit user ask: closed all 8 `documentation-coverage.md` gaps from §8 with real content added to `limitations.md` (sourced from `GAP_ANALYSIS.md`, not invented — coverage is now 33/33), and added 9 real screenshots + 1 GIF captured by driving the actual served app with Playwright (not mockups or hand-drawn recreations) into `getting-started.md` and 8 `features/*.md` pages, under `docs/assets/img/`. Full capture-technique lessons (fragile ancestor-locator crops, the DC runtime stripping the `multiple` attribute, why the planned second GIF was dropped, this sandbox's ffmpeg build having no GIF encoder) are in `WISDOM.md`'s "capturing real screenshots/GIFs" addendum, not repeated here since they're app/tooling lessons more than docs-site-structure ones. `features/duplicate-detection.md` still has no screenshot — the default sample deck didn't obviously trigger a cross-deck-duplicate note; open as a `PLAN.md` ticket.
