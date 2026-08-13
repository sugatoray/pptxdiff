---
name: update-scrolls
description: "Updates an existing docs/.scrolls/ project-memory system (STARTER.md, SPEC.md, HANDOFF.md, GAP_ANALYSIS.md, GAP_CONTEXT.md, PLAN.md, WISDOM.md, and any project-specific scrolls beyond that core set) to reflect what actually happened in the current session, following each file's own update rule instead of appending blindly. Use this whenever the user runs /update-scrolls, or asks to update the scrolls, refresh HANDOFF.md, write session handoff notes, record what was just done, close out or wrap up a session, log a new gap or trap, or update project memory / STARTER.md's docs. This is the counterpart to /setup-scrolls (which creates the system once) — use this one for every session afterward. Supports -p/--path when the scrolls live somewhere other than ./docs (e.g. a monorepo package). If no scrolls folder is found, say so and point at /setup-scrolls instead of inventing files here."
---

# Updating docs/.scrolls/

`docs/.scrolls/` only stays useful if it reflects reality. This skill applies the update rules `STARTER.md` already defines for each file — it does not invent new conventions. The point isn't to touch every file every time; it's to touch exactly the files that something actually happened to, using the update discipline that file's own convention calls for (overwrite vs. append vs. add/remove in lockstep).

**Files are updated relative to the current working directory** — the project root, not this skill's own location.

## Options

Read the invocation text for an optional **`-p <path>` / `--path=<path>` / `--path <path>`** — the docs folder to look in, relative to the current working directory unless given as an absolute path. Defaults to `docs`. There's no `-u`/`--unhide` option here — this skill locates whichever scrolls folder already exists rather than choosing between them (see step 1).

## Steps

### 1. Locate the scrolls, trying both names

Let `DOCS_BASE` be the `--path` value, or `docs` if not given. The scrolls folder under it may be named either `.scrolls` (hidden, the default from `/setup-scrolls`) or `scrolls` (after `/unhide-scrolls`, or `--unhide` at setup time) — check for `DOCS_BASE/.scrolls` first, then `DOCS_BASE/scrolls`. Whichever exists is `SCROLLS_PATH` for the rest of this skill. If neither exists, don't create one here — tell the user this project (or this path) hasn't been set up yet and point them at `/setup-scrolls`. If somehow *both* exist, stop and ask the user which one is current — that's an inconsistent state this skill shouldn't silently paper over.

### 2. Read STARTER.md as the authoritative map

Don't assume the minimal six-file set from `/setup-scrolls` is still the whole story — `STARTER.md` says explicitly that projects grow additional scrolls over time (architecture decisions, security reviews, subsystem deep-dives), each listed with its own read/update rule. Read the current `STARTER.md` in full and use *its* numbered list and "When to update" section as the source of truth for what files exist and how each one wants to be updated. If a file's update convention differs from the generic rules below (e.g. an append-only dated log that must never be edited in place, like this repo's own `SECURITY_ANALYSIS.md`), follow that file's specific convention over the generic one.

### 3. Establish what actually happened this session

Conversation context is the primary source — you were there. But don't rely on it alone, especially if context has been compacted, the session was resumed, or you're being asked to update scrolls for work that happened before this conversation started. Run the bundled script to cross-check against git:

```
bash <skill-dir>/scripts/session_diff.sh SCROLLS_PATH
```

It shows uncommitted changes, commits since `docs/.scrolls/` was last touched, and a stat summary of what files changed — enough to catch things conversation memory missed, without dumping full diffs into context. Pull specific `git diff`/`git log -p` slices yourself if you need more detail on a particular change.

### 4. Update each file that needs it, following its own rule

The core six's generic rules (from `STARTER.md`):

- **`HANDOFF.md`** — **overwrite**, don't append. It's a snapshot: current state, what just happened, known issues/open threads. If nothing meaningfully changed this session, it's fine to leave it as-is rather than padding it with a no-op entry.
- **`SPEC.md`** — append a section only for features that actually **shipped** (working, not just started). Describe what it does for a user, not how it's implemented.
- **`GAP_ANALYSIS.md` + `GAP_CONTEXT.md`** — keep these two in lockstep. Closed a gap → delete its `GAP_ANALYSIS.md` line (don't mark it done, remove it) and its `GAP_CONTEXT.md` entry. Found a new gap → add a terse line to `GAP_ANALYSIS.md` and the reasoning (deliberate cut / oversight / blocker) to `GAP_CONTEXT.md`.
- **`PLAN.md`** — flip `[ ]`→`[x]` for completed tickets, re-prioritize if new requests changed the order, add new tickets for newly surfaced work.
- **`WISDOM.md`** — add an entry under the right section (**Constraints** / **Traps** / **Ditches** / **Wisdom**) only when something genuinely new was learned — a bug that bit you, a pattern worth reusing, a hard constraint discovered. Don't force an entry if the session didn't teach anything new.

For any project-specific scrolls beyond this core set, use the convention `STARTER.md` documents for that specific file — don't default to the generic rules above for a file that says it works differently.

### 5. Don't fabricate or over-claim

If it's unclear whether something shipped versus just started, treat it as unshipped — note it in `HANDOFF.md`'s "known issues / open threads" or `PLAN.md`, not as a finished `SPEC.md` entry. When genuinely ambiguous (e.g. whether a gap was actually closed or just worked around), ask rather than guessing — these files are load-bearing for every future session.

### 6. Report what changed

List which scrolls files were touched and a one-line reason for each. If a file was deliberately left alone despite session activity (e.g. nothing shipped, so `SPEC.md` didn't need a new entry), it's fine to just not mention it — no need to enumerate every file that wasn't touched.
