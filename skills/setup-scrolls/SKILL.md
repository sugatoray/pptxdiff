---
name: setup-scrolls
description: "Sets up a minimal docs/.scrolls/ working-memory system for a project — a small set of cross-session memory files (STARTER.md, SPEC.md, HANDOFF.md, GAP_ANALYSIS.md, GAP_CONTEXT.md, PLAN.md, WISDOM.md) plus a CLAUDE.md pointer that tells future sessions to read STARTER.md first. Use this whenever the user runs /setup-scrolls, or asks to set up 'scrolls', a project-memory system, session handoff notes, a docs/.scrolls folder, or a CLAUDE.md that points new sessions at persistent project docs. Trigger even if the project has no docs/ folder or no CLAUDE.md yet — creating them is part of the job. Files are created relative to the current working directory, not this skill's own location."
---

# Setting up docs/.scrolls/

`docs/.scrolls/` is a small set of markdown files that act as a project's working memory across sessions: what it does, what state it's in, what's known-missing and why, what's next, and what traps to avoid. A `CLAUDE.md` pointer sends every future session to `docs/.scrolls/STARTER.md` first, so state gets picked up instead of re-discovered from scratch each time. This skill scaffolds that system for a project that doesn't have it yet.

**Everything is created relative to the current working directory** (the project root the user is in when they invoke this), not relative to this skill's own install location. This skill's `assets/templates/` directory holds the source templates — copy from there, never edit those files in place.

## Steps

### 1. Confirm the target and don't clobber existing work

Target root = current working directory. If `docs/.scrolls/` already exists there with files in it, stop and ask the user whether they want you to fill in only the missing files or leave it alone — never overwrite an existing scroll file silently, since `HANDOFF.md`/`PLAN.md`/etc. may hold real accumulated state. The same caution applies to `CLAUDE.md`: never blow away existing content.

### 2. Gather just enough project context

Don't interview the user at length — a minimal setup should be fast. Infer what you can in a few seconds:

- **Project name**: from `package.json`'s `name`, `pyproject.toml`'s `[project].name`, `Cargo.toml`, or failing that the directory's basename.
- **One-line tagline**: from the same manifest's `description` field, or the first line of an existing `README.md`, or omit it — it's optional flavor text, not load-bearing.
- **Quick orientation**: one short paragraph on the project's actual shape — main entry point(s), the one or two files/directories that matter most, and the primary language/stack. Get this by a quick look at the repo root and manifest files, not a deep audit. If the project is genuinely empty (brand new, no code yet), say so plainly rather than inventing structure.

If any of this is ambiguous (e.g. a monorepo with several `package.json`s), a single clarifying question is fine — but default to acting rather than blocking on questions the repo already answers.

### 3. Create the seven files

Copy each file from `assets/templates/` into `docs/.scrolls/` at the target root, substituting the `{{PROJECT_NAME}}`, `{{PROJECT_TAGLINE}}`, and `{{QUICK_ORIENTATION}}` placeholders with what you gathered in step 2:

| Template | → | Purpose |
|---|---|---|
| `STARTER.md` | `docs/.scrolls/STARTER.md` | Reading order + when-to-update table. The entry point every session reads first. |
| `SPEC.md` | `docs/.scrolls/SPEC.md` | Feature list, filled in as features ship. |
| `HANDOFF.md` | `docs/.scrolls/HANDOFF.md` | Snapshot of current state — overwritten each session, not appended. |
| `GAP_ANALYSIS.md` | `docs/.scrolls/GAP_ANALYSIS.md` | What's known-missing or partial. |
| `GAP_CONTEXT.md` | `docs/.scrolls/GAP_CONTEXT.md` | Why each gap exists (deliberate cut vs. oversight vs. blocker). |
| `PLAN.md` | `docs/.scrolls/PLAN.md` | Prioritized, ticketed backlog. |
| `WISDOM.md` | `docs/.scrolls/WISDOM.md` | Constraints / Traps / Ditches / Wisdom sections. |

This is the **minimal** set — exactly the six files `STARTER.md` walks through, plus `STARTER.md` itself. Don't invent extra scroll files (security reviews, architecture-decision records, subsystem deep-dives) up front; those get added later, organically, by whoever's doing that specific work, following the pattern `STARTER.md`'s own last section describes. Leave `{{PROJECT_TAGLINE}}` blank (drop the placeholder entirely, don't leave literal `{{...}}` text) if you found nothing worth using — it reads fine as `You're picking up work on **Foo**.` with no tagline clause.

Templates are intentionally close to empty (placeholder bullets like "(none tracked yet)") — resist the urge to pre-populate `SPEC.md` with a guessed feature list or `PLAN.md` with invented tickets. A minimal scaffold's job is to hold the *shape*; the content accumulates from real sessions. The one exception is `STARTER.md`'s "Quick orientation" section, which is worth getting right since it's the one piece of static context every session leans on immediately.

### 4. Point CLAUDE.md at STARTER.md

Read `assets/templates/CLAUDE_MD_BLOCK.md` — it's the block to install.

- **No `CLAUDE.md` at the target root**: create one containing exactly that block.
- **`CLAUDE.md` exists but has no `docs/.scrolls` reference**: insert the block near the top of the file (before other instructions, since "read this first" only works if it's read first), separated by blank lines from surrounding content. If the file already opens with its own top-level heading, add the block's heading as a subsection instead of a second top-level `# Project instructions` — match the existing file's heading structure rather than fighting it.
- **`CLAUDE.md` already references `docs/.scrolls/STARTER.md`**: leave it alone; note this to the user instead of duplicating the block.

### 5. Report back

Summarize what was created vs. what already existed and was left untouched, and name the two or three things most worth the user's attention next: filling in `STARTER.md`'s quick-orientation paragraph if you had to guess at it, and writing the first real `SPEC.md` entry once something ships.
