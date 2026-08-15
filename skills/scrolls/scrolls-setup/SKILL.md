---
name: scrolls-setup
description: "Sets up a minimal docs/.scrolls/ working-memory system for a project — a small set of cross-session memory files (STARTER.md, SPEC.md, HANDOFF.md, GAP_ANALYSIS.md, GAP_CONTEXT.md, PLAN.md, WISDOM.md) plus a CLAUDE.md pointer that tells future sessions to read STARTER.md first. Use this whenever the user runs /scrolls-setup, or asks to set up 'scrolls', a project-memory system, session handoff notes, a docs/.scrolls folder, or a CLAUDE.md that points new sessions at persistent project docs. Trigger even if the project has no docs/ folder or no CLAUDE.md yet — creating them is part of the job. Supports -p/--path for a custom docs location, -t/--reporoot to pin everything to the git repository's top level regardless of which subdirectory you're in, -l/--local to pin it explicitly to the current directory, -r/--recurse to scan recursively for an existing scrolls folder before creating a new one (avoiding accidental duplicates), and -u/--unhide to name the folder scrolls instead of .scrolls. Defaults to the current directory, but warns first if that differs from the repo root so a subdirectory invocation doesn't silently create a second, disconnected scrolls system. Works on macOS, Linux, and Windows (bash or PowerShell)."
---

# Setting up docs/.scrolls/

`docs/.scrolls/` is a small set of markdown files that act as a project's working memory across sessions: what it does, what state it's in, what's known-missing and why, what's next, and what traps to avoid. A `CLAUDE.md` pointer sends every future session to `docs/.scrolls/STARTER.md` first, so state gets picked up instead of re-discovered from scratch each time. This skill scaffolds that system for a project that doesn't have it yet.

This skill's own `assets/templates/` directory holds the source templates — copy from there, never edit those files in place.

## Cross-platform

Unlike the other four scrolls skills, this one has no bundled `.sh`/`.ps1` script to choose between — nothing here needed porting. File creation happens through your own Read/Write/Edit tools (not raw shell commands), and the one external command this skill relies on (`git rev-parse --show-toplevel`) behaves identically whether invoked from bash or PowerShell — both support the same `$(...)` command-substitution syntax used throughout this file. Works the same on macOS, Linux, and Windows without any environment-specific branching.

## Options

The user may pass these after `/scrolls-setup` as plain text, in any order — there's no real argv parser here, so read the invocation text yourself and pull out:

- **`-p <path>` / `--path=<path>` / `--path <path>`** — a custom docs folder, relative to the current working directory unless given as an absolute path (starts with `/`). Use this for monorepos or non-standard layouts, e.g. `--path=packages/api/docs` puts the scrolls at `packages/api/docs/.scrolls`. This is the one option where you're naming the docs folder directly rather than picking a base directory — see the CLAUDE.md placement note in step 4 for the tradeoff that comes with going deep.
- **`-t` / `--reporoot`** — pin everything to the git repository's top level (`$(git rev-parse --show-toplevel)`), regardless of which subdirectory you actually invoked this from. Fails with a clear message if the current directory isn't inside a git repository — there's no repo root to find.
- **`-l` / `--local`** — pin everything to the current working directory explicitly. This is what happens by default anyway when none of `-p`/`-t`/`-l` are given — the flag exists so you (or the user) can say so on purpose, e.g. to skip the mismatch check in step 1.
- **`-r` / `--recurse`** — before creating anything, scan recursively under `BASE_DIR` for a scrolls folder that already exists somewhere nearby (same bounded, pruned, `STARTER.md`-guarded search `/scrolls-hide`/`/scrolls-unhide` use), so a duplicate isn't created by accident. Doesn't change *where* the new scrolls folder goes if you proceed — see step 1.
- **`-u` / `--unhide`** — name the scrolls folder `scrolls` instead of the default `.scrolls`, so it isn't dotfile-hidden. Omit for the default (hidden).

`-p`, `-t`, and `-l` are three different ways to answer the same question ("where does the `docs` folder go?") — pass at most one. If more than one is given, stop and ask which was meant. `-r` is independent and combines freely with any of them (or with none).

## Steps

### 1. Resolve BASE_DIR and don't clobber existing work

Compute `BASE_DIR` — the directory that will contain both the `docs` folder and `CLAUDE.md`:

- **`-t`/`--reporoot` given**: `BASE_DIR = $(git rev-parse --show-toplevel)`. If that command fails (not inside a git repository), stop and tell the user — there's no repo root to pin to here; suggest `--path` instead.
- **`-l`/`--local` given**, or **`-p`/`--path` given**: skip straight to computing `DOCS_BASE` below — `-l` uses `BASE_DIR = $(pwd)` and `-p` bypasses `BASE_DIR` entirely (see the note under `DOCS_BASE`).
- **Nothing given** (the common case): `BASE_DIR = $(pwd)`. But first, if the current directory is inside a git repository, run `git rev-parse --show-toplevel` and compare it to `$(pwd)`. If they're the same, or this isn't a git repo, there's nothing to flag. If they differ, tell the user plainly: running from here will create the scrolls at `$(pwd)/docs/.scrolls`, separate from anything that might already exist at the repository root (`<repo-root>`), and ask whether that's what they want — the current directory (the default; proceed with it if there's no strong preference either way) or the repo root instead (equivalent to re-running with `-t`). Don't block indefinitely on this — cwd wins if it's a toss-up, since that's this skill's documented default.

If `-r`/`--recurse` was given, do this scan next, before touching the filesystem: search recursively under `BASE_DIR` (skip this if `-p` was given — a custom `--path` is an explicit, deliberate location, not something to second-guess) for any directory named `.scrolls` or `scrolls` containing a `STARTER.md`, pruning the same heavy/vendor directories `/scrolls-hide`/`/scrolls-unhide` prune (`node_modules`, `.git`, `vendor`, `dist`, `build`, `.venv`, `venv`, `__pycache__`, `target`, `.next`, `.cache`), bounded to a reasonable depth (8 is what the other scrolls skills use). If this finds an existing scrolls folder anywhere under `BASE_DIR` other than the exact `SCROLLS_PATH` you're about to create, surface it and ask whether the user meant to run `/scrolls-update` against that one instead of creating a new, separate one here — proceed with creation only if they confirm that's what they want (e.g. a deliberately separate scrolls system for a sub-project).

Then:

```
DOCS_BASE    = the --path value if -p was given, else "${BASE_DIR}/docs"
SCROLLS_DIR  = "scrolls" if --unhide/-u was passed, else ".scrolls"
SCROLLS_PATH = "${DOCS_BASE}/${SCROLLS_DIR}"
```

`SCROLLS_PATH` replaces every `docs/.scrolls` you'll see referenced below and in the templates — the rest of this skill talks about "the scrolls path" generically. If the user already has a hidden `.scrolls` set up and wants it converted to visible later, that's a separate, dedicated operation — point them at `/scrolls-unhide` rather than re-running this skill.

If `SCROLLS_PATH` already exists with files in it, stop and ask the user whether they want you to fill in only the missing files or leave it alone — never overwrite an existing scroll file silently, since `HANDOFF.md`/`PLAN.md`/etc. may hold real accumulated state. The same caution applies to `CLAUDE.md`: never blow away existing content. If `--unhide` was passed but a `.scrolls` folder already exists there (or vice versa), don't create a second, parallel scrolls folder — tell the user and point at `/scrolls-unhide` instead.

### 2. Gather just enough project context

Don't interview the user at length — a minimal setup should be fast. Infer what you can in a few seconds:

- **Project name**: from `package.json`'s `name`, `pyproject.toml`'s `[project].name`, `Cargo.toml`, or failing that the directory's basename.
- **One-line tagline**: from the same manifest's `description` field, or the first line of an existing `README.md`, or omit it — it's optional flavor text, not load-bearing.
- **Quick orientation**: one short paragraph on the project's actual shape — main entry point(s), the one or two files/directories that matter most, and the primary language/stack. Get this by a quick look at the repo root and manifest files, not a deep audit. If the project is genuinely empty (brand new, no code yet), say so plainly rather than inventing structure.

If any of this is ambiguous (e.g. a monorepo with several `package.json`s), a single clarifying question is fine — but default to acting rather than blocking on questions the repo already answers.

### 3. Create the seven files

Copy each file from `assets/templates/` into `SCROLLS_PATH` on disk, substituting the `{{PROJECT_NAME}}`, `{{PROJECT_TAGLINE}}`, `{{QUICK_ORIENTATION}}`, and `{{SCROLLS_PATH}}` placeholders with what you gathered in step 2 and computed above. `SCROLLS_PATH` is an absolute filesystem path when it came from `-t`/`-l`/the default (all resolve through `BASE_DIR`, which is always absolute) — that's fine for the actual file writes, but **the text you substitute for `{{SCROLLS_PATH}}` inside the templates is not the same string**:

- **`-t`/`-l`/default (`BASE_DIR`-derived)**: substitute the *short* form, `docs/${SCROLLS_DIR}` (e.g. `docs/.scrolls`) — never the absolute `SCROLLS_PATH`. This is what keeps the files portable: `CLAUDE.md` always ends up living at `BASE_DIR` too (step 4), so a reference relative to `BASE_DIR` is correct regardless of whether `BASE_DIR` was `$(pwd)` or the git root, and regardless of which machine or clone reads it later. Baking in an absolute path here would break the moment the repo is cloned somewhere else.
- **`-p`/`--path`**: substitute the full `DOCS_BASE`-based `SCROLLS_PATH` as given, unchanged from before (e.g. `packages/api/docs/.scrolls`) — this path is already relative, and where `CLAUDE.md` ends up for this case is judgment-dependent (see step 4), so keep the existing behavior rather than guessing at a shorter form.

| Template | → | Purpose |
|---|---|---|
| `STARTER.md` | `SCROLLS_PATH/STARTER.md` | Reading order + when-to-update table. The entry point every session reads first. |
| `SPEC.md` | `SCROLLS_PATH/SPEC.md` | Feature list, filled in as features ship. |
| `HANDOFF.md` | `SCROLLS_PATH/HANDOFF.md` | Snapshot of current state — overwritten each session, not appended. |
| `GAP_ANALYSIS.md` | `SCROLLS_PATH/GAP_ANALYSIS.md` | What's known-missing or partial. |
| `GAP_CONTEXT.md` | `SCROLLS_PATH/GAP_CONTEXT.md` | Why each gap exists (deliberate cut vs. oversight vs. blocker). |
| `PLAN.md` | `SCROLLS_PATH/PLAN.md` | Prioritized, ticketed backlog. |
| `WISDOM.md` | `SCROLLS_PATH/WISDOM.md` | Constraints / Traps / Ditches / Wisdom sections. |

This is the **minimal** set — exactly the six files `STARTER.md` walks through, plus `STARTER.md` itself. Don't invent extra scroll files (security reviews, architecture-decision records, subsystem deep-dives) up front; those get added later, organically, by whoever's doing that specific work, following the pattern `STARTER.md`'s own last section describes. Leave `{{PROJECT_TAGLINE}}` blank (drop the placeholder entirely, don't leave literal `{{...}}` text) if you found nothing worth using — it reads fine as `You're picking up work on **Foo**.` with no tagline clause.

`STARTER.md` and `CLAUDE_MD_BLOCK.md` are the only templates containing `{{SCROLLS_PATH}}` — substitute it per the rule above (short form for `-t`/`-l`/default, full `SCROLLS_PATH` for `-p`), not a placeholder string, and use the *same* substitution in both files.

Templates are intentionally close to empty (placeholder bullets like "(none tracked yet)") — resist the urge to pre-populate `SPEC.md` with a guessed feature list or `PLAN.md` with invented tickets. A minimal scaffold's job is to hold the *shape*; the content accumulates from real sessions. The one exception is `STARTER.md`'s "Quick orientation" section, which is worth getting right since it's the one piece of static context every session leans on immediately.

### 4. Point CLAUDE.md at STARTER.md

Read `assets/templates/CLAUDE_MD_BLOCK.md` and substitute `{{SCROLLS_PATH}}` in it the same way as `STARTER.md` — that's the block to install.

- **`-t`/`-l`/default (`BASE_DIR`-derived)**: `CLAUDE.md` goes at `BASE_DIR` — the same directory that now contains `docs`. This is fixed and unambiguous: `BASE_DIR` is exactly what `-t`/`-l`/the mismatch check in step 1 resolved, so there's no separate "project root" judgment call to make here anymore.
- **`-p`/`--path`**: where `CLAUDE.md` belongs is genuinely judgment-dependent, since a custom `--path` might point at an independent monorepo package (its own `CLAUDE.md`, short local references — closer to what `-l` would produce if you'd `cd`ed into that package first) or be one piece of a larger repo meant to stay under a single root `CLAUDE.md` referencing the full path. Use whatever `CLAUDE.md` location the project's other tooling already expects; if genuinely unclear, ask rather than guessing — this is the one case where a wrong guess is expensive (a broken reference baked into checked-in docs).

Once you know where `CLAUDE.md` goes:

- **No `CLAUDE.md` there yet**: create one containing exactly that block.
- **`CLAUDE.md` exists but has no scrolls-path reference**: insert the block near the top of the file (before other instructions, since "read this first" only works if it's read first), separated by blank lines from surrounding content. If the file already opens with its own top-level heading, add the block's heading as a subsection instead of a second top-level `# Project instructions` — match the existing file's heading structure rather than fighting it.
- **`CLAUDE.md` already references `SCROLLS_PATH/STARTER.md`** (or the short form, if that's what applies here): leave it alone; note this to the user instead of duplicating the block.

### 5. Report back

Summarize what was created vs. what already existed and was left untouched, and name the two or three things most worth the user's attention next: filling in `STARTER.md`'s quick-orientation paragraph if you had to guess at it, and writing the first real `SPEC.md` entry once something ships.
