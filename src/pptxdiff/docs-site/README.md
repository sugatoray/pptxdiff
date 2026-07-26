# pptxdiff docs site

Source for https://sugatoray.github.io/pptxdiff/ — built with [MkDocs](https://www.mkdocs.org/) + [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/). All content is plain Markdown under `docs/`.

See `docs/.scrolls/DOCS.md` (repo root) for the tooling decision and rationale.

## Preview locally

```bash
# from the repo root
uv run --group docs mkdocs serve -f src/pptxdiff/docs-site/mkdocs.yml
```

Then open http://127.0.0.1:8000/.

## Build

```bash
uv run --group docs mkdocs build -f src/pptxdiff/docs-site/mkdocs.yml --strict
```

Output goes to `src/pptxdiff/docs-site/site/` (git-ignored, not published from this repo).

## Layout

```
docs-site/
  mkdocs.yml       # site config (nav, theme, markdown extensions)
  docs/
    index.md              # home page
    getting-started.md
    features/             # one page per feature area, mirrors docs/.scrolls/SPEC.md
    cli.md
    vscode-extension.md
    architecture.md
    limitations.md
    faq.md
    changelog.md
    assets/img/           # copies of docs/assets/*.png used on the site
```

Keep this content in sync with `README.md` and `docs/.scrolls/SPEC.md` (repo root) when the app's feature set changes — `SPEC.md` is the source of truth for *what* the app does; this site is the reader-facing walkthrough of the same features.
