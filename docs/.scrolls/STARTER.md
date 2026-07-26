# STARTER.md — Read Me First

You're picking up work on **Slide Diff**, a PowerPoint slide-comparison Design Component. Before touching `Slide Diff.dc.html` (or `sample-pptx.js`), read the following files **in this exact order**:

1. **`docs/SPEC.md`** — What the tool does, feature by feature. Read this first so you understand the full surface area before you read anything else. Update this when you SHIP a new feature (not when you start one).
2. **`docs/HANDOFF.md`** — The "change of guard" note: current state, what just happened, recent bugs and their root causes. This is short-lived/tactical — read it to know what the *previous* session left you with. Update this at the **end of every session** (overwrite stale entries, don't let it grow forever — it's a snapshot, not a changelog).
3. **`docs/GAP_ANALYSIS.md`** — Concrete list of what is NOT implemented yet or is a known partial/simplified implementation. Read this to avoid re-discovering already-known gaps, and to recognize when a user request is actually asking you to close one of these.
4. **`docs/GAP_CONTEXT.md`** — The *why* behind every entry in GAP_ANALYSIS.md (deliberate scope cut vs. genuine oversight vs. technical blocker). Read this before deciding to "just fix" a gap — some are intentional, and the reasoning tells you whether a user's new request changes the calculus.
5. **`docs/PLAN.md`** — The prioritized backlog / issue board (ordered, ticketed, with status). Read this to see what's already planned as "next" before inventing your own priority order. Update ticket status as you complete work, and re-prioritize if the user's new ask changes priorities.
6. **`docs/WISDOM.md`** — Constraints, traps, bad patterns, and best practices learned the hard way on this project. Read this LAST, right before you start editing, so it's freshest in mind. It has four sections: **Constraints** (things you must respect/conform to), **Traps** (specific bugs that have bitten this project before — avoid repeating them), **Ditches** (bad patterns/decisions to never take), and **Wisdom** (best practices, including the Red/Green TDD fixture pattern this project uses). Update this whenever you discover a new trap, ditch, or piece of wisdom worth preserving — especially right after fixing a nasty bug.
7. **`docs/.scrolls/DOCS.md`** — The documentation SITE's own decision record and maintenance notes (tooling choice/rationale, file layout, cross-page mechanisms like the documentation-coverage tracker) for `src/pptxdiff/docs-site/`. Read this before any change to the docs site beyond a routine single-page content edit — it explains what's already been decided and why, so you don't re-litigate a settled choice (e.g. mkdocs-material vs. alternatives) or reintroduce a risk that was deliberately closed (e.g. the macros-plugin Jinja-scoping decision).

## When to update each file
- **SPEC.md**: after shipping a feature (describe what it does, not how you built it).
- **HANDOFF.md**: at the end of every session, always — overwrite/prune, keep it current and short.
- **GAP_ANALYSIS.md**: whenever you ship something that closes a gap (remove the line) or discover a new gap (add a line).
- **GAP_CONTEXT.md**: whenever you add/remove a GAP_ANALYSIS.md line — explain the why.
- **PLAN.md**: whenever ticket status changes, or priorities shift based on new user requests.
- **WISDOM.md**: whenever you hit a new trap/bug, make a mistake worth not repeating, or land on a pattern worth reusing.
- **DOCS.md**: whenever any documentation-related update is necessary or implemented — a new page, a new cross-page mechanism (like the coverage tracker), a tooling/dependency change under `docs-site/`, or a decision about how the docs site itself should work. Check it first (it may already cover the question), then update it to reflect what changed. Routine content edits to an existing page (fixing a claim, adding a paragraph, updating a code sample) don't need a DOCS.md entry on their own — but if that edit is *part of* a broader app feature landing, keeping `SPEC.md`'s feature-page mapping current (per the SPEC.md rule above) is normally enough; reach for DOCS.md when the change is about the site's own structure/tooling/mechanisms, not just its content.

## Quick orientation
- The whole tool is ONE Design Component: `Slide Diff.dc.html` (template + logic class). Edit it with `dc_html_str_replace`/`dc_js_str_replace`, not `write_file`.
- `sample-pptx.js` is a plain ES module that generates the built-in sample/test-fixture `.pptx` files — read SPEC.md §8 and WISDOM.md's Red/Green TDD note before touching it.
- Full feature list: SPEC.md. Known gaps + reasoning: GAP_ANALYSIS.md + GAP_CONTEXT.md. Next priorities: PLAN.md. Hard-won lessons: WISDOM.md.
