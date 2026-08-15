# Scrolls skills

Custom slash commands for managing `docs/.scrolls/` (or `docs/scrolls/`), a
small set of markdown files that act as a project's working memory across
sessions — what it does, what state it's in, what's known-missing and why,
what's next, and what traps to avoid. `STARTER.md` inside that folder is the
entry point; a `CLAUDE.md` pointer tells new sessions to read it first.

All five commands work the same way on macOS, Linux, and Windows — each
bundled script ships as both a bash (`.sh`) and a PowerShell (`.ps1`,
PowerShell 7+) version.

Run `/scrolls-help` for the full example-driven reference (add `-e`/`--online`
to view it as a styled local web page instead of chat text).

## Commands

| Command | Purpose |
| --- | --- |
| [`/scrolls-setup`](scrolls-setup/) | Creates `docs/.scrolls/` for a project that doesn't have it yet: `STARTER.md`, `SPEC.md`, `HANDOFF.md`, `GAP_ANALYSIS.md`, `GAP_CONTEXT.md`, `PLAN.md`, `WISDOM.md`, plus a `CLAUDE.md` pointer. |
| [`/scrolls-update`](scrolls-update/) | Updates an existing `docs/.scrolls/` to reflect what happened in the current session, following each file's own update rule. The counterpart to `/scrolls-setup` — use this one for every session afterward. |
| [`/scrolls-hide`](scrolls-hide/) | Renames an already-set-up `docs/scrolls/` to dotfile-hidden `docs/.scrolls/`, rewriting path references so nothing breaks. Retrofit path for a project set up visible. |
| [`/scrolls-unhide`](scrolls-unhide/) | The opposite of `/scrolls-hide`: renames `docs/.scrolls/` to visible `docs/scrolls/`, rewriting path references so nothing breaks. |
| [`/scrolls-help`](scrolls-help/) | Crisp, example-driven reference for the whole family — what each command does, their shared flags, and common usage examples. Supports `-e`/`--online` to serve it as a styled local page (light/dark and colorize/plain toggles) instead of chat text. |

## Shared flags

`/scrolls-setup`, `/scrolls-update`, `/scrolls-hide`, and `/scrolls-unhide`
share a common set of flags for targeting *where* the scrolls folder lives,
so the same mental model applies across all four:

| Flag | Meaning |
| --- | --- |
| `-p`, `--path` | Custom docs location. Repeatable on `/scrolls-hide`/`/scrolls-unhide` to target multiple locations in one run. |
| `-t`, `--reporoot` | Pin to the git repository's top level, regardless of which subdirectory you're in. |
| `-l`, `--local` | Pin explicitly to the current directory. |
| `-r`, `--recurse` | Scan/sweep recursively instead of checking one exact location (e.g. every package in a monorepo in one run). |
| `-u`, `--unhide` | `/scrolls-setup` only — create the folder visible (`scrolls`) instead of dotfile-hidden (`.scrolls`). |

Default (no `-p`/`-t`/`-l`): the current directory, with a warning first if
that differs from the repo root, so a subdirectory invocation doesn't
silently create or miss a disconnected scrolls system. `/scrolls-hide` and
`/scrolls-unhide` also honor a `DEFAULT_SCROLLS_RELPATH` environment
variable to change that default location.

## Layout

Each command lives in its own directory with a `SKILL.md` plus supporting
`scripts/` (bash + PowerShell), `tests/` (bash + PowerShell, Red/Green TDD),
and, for `/scrolls-setup`, `assets/templates/` for the scaffolded markdown
files.

`tests/` is development-only — it's for maintaining the bundled scripts, not
part of using the skills. No `SKILL.md` references it, so it's never loaded
while a `/scrolls-*` command is actually running.
