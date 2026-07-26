---
title: PptxDiff
description: A single-file, client-side diff tool for comparing PowerPoint decks.
---

# PptxDiff — a diff tool for slides

![PptxDiff banner](assets/img/pptxdiff_banner.png)

!!! warning "Early stage"
    This project is developed rapidly. Features may break or you may find bugs — it's in an early stage of development.

**PptxDiff** compares two PowerPoint decks (or many pairs at once), renders them with real fidelity, and diffs text, formatting, images, tables, charts, animations, transitions, and speaker notes — with a full reviewer workflow (approvals, comments, history) built in.

It's a **single self-contained HTML file**. No server, no build step, no cloud upload — everything runs in your browser, locally.

<div class="grid cards" markdown>

-   :material-download:{ .lg .middle } **No install required**

    ---

    Open `index.html` directly, or run it with `npx pptxdiff`.

    [:octicons-arrow-right-24: Getting started](getting-started.md)

-   :material-image-multiple:{ .lg .middle } **Real slide rendering**

    ---

    Pixel-accurate previews via `@aiden0z/pptx-renderer`, with a schematic fallback.

    [:octicons-arrow-right-24: Rendering fidelity](features/rendering.md)

-   :material-file-compare:{ .lg .middle } **Deep diffing**

    ---

    Text, fonts, color, position, tables, charts, notes, transitions, and more.

    [:octicons-arrow-right-24: Diff engine](features/diff-engine.md)

-   :material-account-check:{ .lg .middle } **Reviewer workflow**

    ---

    Multiple reviewers, per-diff approve/reject, threaded comments, history.

    [:octicons-arrow-right-24: Reviewer workflow](features/reviewer-workflow.md)

</div>

## See it in action

![All-pairs comparison view](assets/img/pptxdiff_demo_1_allpairs.png)

*The **All-pairs** view: every aligned slide pair at once, with ADDED / DELETED / MOVED / CHANGED / IDENTICAL status tags — content-similarity alignment handles inserted, removed, and reordered slides automatically.*

## Feature highlights

- **High-fidelity rendering** — real `.pptx` (OOXML) parsing plus pixel-accurate slide previews, with a schematic fallback if a part can't be rendered.
- **Deep diffing** — text (word-level highlighting), fonts, color, alignment, position, borders, hyperlinks, images/charts, tables, backgrounds, animations, transitions, speaker notes, embedded fonts, master/layout inheritance, section headers.
- **Deck-level comparison** — not just 1:1 pairs: content-similarity alignment handles inserted/removed/reordered slides.
- **Duplicate detection** — same-deck near-duplicates and cross-deck duplicates, with an adjustable sensitivity threshold.
- **Reviewer workflow** — multiple reviewers, per-slide and per-diff approve/reject, threaded comments, an approval history log, and scoped "clear decisions."
- **Batch mode** — compare many deck pairs at once, order- or filename-matched.
- **Three-way merge** — per-diff Keep-Before/Keep-After/Custom picks, plus a real (beta) merged `.pptx` export.
- **Exports** — PDF, standalone HTML report, JSON, CSV, Markdown, Notion-flavored Markdown, Confluence wiki markup, and live push attempts to Slack/Notion/Confluence.
- **Keyboard shortcuts**, dark mode, and touch-friendly batch reordering.
- **Self-tests** — an in-browser Red/Green regression suite covering the diff engine, alignment, duplicate detection, and merge logic.

See the full [feature walkthrough](features/index.md) for a guided tour of each area, or jump straight to [Getting Started](getting-started.md).

## Install

=== "npx (no install)"

    ```bash
    npx pptxdiff
    ```

=== "npm (global)"

    ```bash
    npm install -g pptxdiff
    pptxdiff
    ```

=== "just the file"

    ```bash
    git clone https://github.com/sugatoray/pptxdiff.git
    cd pptxdiff
    open src/pptxdiff/index.html
    ```

!!! note "Internet access is still required"
    The app loads React, Babel, `@aiden0z/pptx-renderer`, and fonts from CDNs at runtime, regardless of which install option you use above — but your `.pptx` files never leave your machine.

## Links

- [GitHub repository](https://github.com/sugatoray/pptxdiff)
- [npm package](https://www.npmjs.com/package/pptxdiff)
- [VS Code extension](https://marketplace.visualstudio.com/items?itemName=sugatoray.pptxdiff-vscode)
- [Changelog](changelog.md)
