---
name: scrolls-update
description: "Updates an existing docs/.scrolls/ project-memory system (STARTER.md, SPEC.md, HANDOFF.md, GAP_ANALYSIS.md, GAP_CONTEXT.md, PLAN.md, WISDOM.md, and any project-specific scrolls beyond that core set) to reflect what actually happened in the current session, following each file's own update rule instead of appending blindly. Use this whenever the user runs /scrolls-update, or asks to update the scrolls, refresh HANDOFF.md, write session handoff notes, record what was just done, close out or wrap up a session, log a new gap or trap, or update project memory / STARTER.md's docs. This is the counterpart to /scrolls-setup (which creates the system once) — use this one for every session afterward. Supports -p/--path for a custom docs location, -t/--reporoot to look under the git repository's top level regardless of which subdirectory you're in, -l/--local to look explicitly in the current directory, and -r/--recurse to search recursively for the scrolls folder if it isn't at the obvious exact location. Defaults to the current directory, but warns first if that differs from the repo root so a subdirectory invocation doesn't silently miss the real scrolls. Works on macOS, Linux, and Windows (bash or PowerShell). If no scrolls folder is found, say so and point at /scrolls-setup instead of inventing files here."
---

# Updating docs/.scrolls/

`docs/.scrolls/` only stays useful if it reflects reality. This skill applies the update rules `STARTER.md` already defines for each file — it does not invent new conventions. The point isn't to touch every file every time; it's to touch exactly the files that something actually happened to, using the update discipline that file's own convention calls for (overwrite vs. append vs. add/remove in lockstep).

## Cross-platform

The one bundled script (step 3) ships in two forms: `session_diff.sh` (bash — macOS, Linux, or Windows with Git Bash/WSL) and `session_diff.ps1` (PowerShell 7+ — Windows, or macOS/Linux with `pwsh` installed). Everything else in this skill — the flags, `BASE_DIR` resolution, locating the scrolls folder — is plain prose you follow directly; it only ever invokes `git`, which behaves identically regardless of which shell is running it, so none of that needs a shell-specific variant. Pick the script by what's actually available: try `bash --version`; if that succeeds, use the `.sh` script; otherwise use the `.ps1` script via `pwsh` (preferred — install from https://aka.ms/powershell if missing) or, only if `pwsh` genuinely isn't available, the built-in Windows PowerShell `powershell.exe` (untested against that older version; `pwsh` is what this was written and verified against).

## Options

Read the invocation text for these, in any order — there's no real argv parser here, so pull them out of the plain text yourself:

- **`-p <path>` / `--path=<path>` / `--path <path>`** — a custom docs folder to look in, relative to the current working directory unless given as an absolute path.
- **`-t` / `--reporoot`** — look under the git repository's top level (`$(git rev-parse --show-toplevel)`) regardless of which subdirectory you actually invoked this from. Fails with a clear message if the current directory isn't inside a git repository.
- **`-l` / `--local`** — look explicitly in the current working directory. This is what happens by default anyway when none of `-p`/`-t`/`-l` are given — the flag exists to say so on purpose, e.g. to skip the mismatch check below.
- **`-r` / `--recurse`** — if the scrolls folder isn't at the obvious exact location (`BASE_DIR/docs/.scrolls` or `BASE_DIR/docs/scrolls`), search recursively under `BASE_DIR` for one instead of giving up. Off by default — matches the usual meaning of `-r` on tools like `grep`/`cp`/`rm`.

There's no `-u`/`--unhide` option here — this skill locates whichever scrolls folder already exists rather than choosing between them (see step 1). `-p`, `-t`, and `-l` are three different ways to answer the same question ("where's the docs folder?") — pass at most one; if more than one is given, ask which was meant. `-r` is independent and combines freely with any of them (or with none).

## Steps

### 1. Resolve BASE_DIR, then locate the scrolls, trying both names

Compute `BASE_DIR`:

- **`-t`/`--reporoot` given**: `BASE_DIR = $(git rev-parse --show-toplevel)`. If that fails (not inside a git repository), stop and tell the user — suggest `--path` instead.
- **`-l`/`--local` given**: `BASE_DIR = $(pwd)`.
- **Nothing given** (the common case): `BASE_DIR = $(pwd)`. But first, if the current directory is inside a git repository, run `git rev-parse --show-toplevel` and compare it to `$(pwd)`. If they're the same, or this isn't a git repo, proceed with cwd as usual. If they differ, mention it before searching — running from here will only look under `$(pwd)/docs`, and a scrolls folder that lives at the repository root (`<repo-root>`) instead would be missed entirely (not just skipped — it'll look like the project was never set up). Ask if that's intended, defaulting to proceeding with cwd (this skill's documented default) if there's no strong preference.

Then let `DOCS_BASE` be the `--path` value if `-p` was given, else `${BASE_DIR}/docs`. The scrolls folder under it may be named either `.scrolls` (hidden, the default from `/scrolls-setup`) or `scrolls` (after `/scrolls-unhide`, or `--unhide` at setup time) — check for `DOCS_BASE/.scrolls` first, then `DOCS_BASE/scrolls`. Whichever exists is `SCROLLS_PATH` for the rest of this skill.

If neither exists at that exact spot:

- **`-r`/`--recurse` was given**: search recursively under `BASE_DIR` instead — a bounded number of levels deep, pruning the same heavy/vendor directories `/scrolls-hide`/`/scrolls-unhide` prune (`node_modules`, `.git`, `vendor`, `dist`, `build`, `.venv`, `venv`, `__pycache__`, `target`, `.next`, `.cache`), for a directory named `.scrolls` or `scrolls` containing a `STARTER.md`. If exactly one turns up, that's `SCROLLS_PATH`. If more than one turns up (a monorepo with several independent scrolls setups under this `BASE_DIR`), list them and ask the user which one this session's update is actually about — don't guess, and don't update more than one, since a session's narrative belongs to a specific project, not every project it happens to be nested near.
- **`-r` wasn't given, or the recursive search above also found nothing**: don't create one here. Tell the user this project (or this path) hasn't been set up yet and point them at `/scrolls-setup` — and if you resolved `BASE_DIR` to cwd (by default or `-l`) rather than the repo root, mention `-t`/`--reporoot` as something to try, and mention `-r`/`--recurse` if you haven't already used it, in case the scrolls live somewhere other than the exact expected spot.

If somehow *both* `.scrolls` and `scrolls` exist at the exact `DOCS_BASE`, stop and ask the user which one is current — that's an inconsistent state this skill shouldn't silently paper over.

### 2. Read STARTER.md as the authoritative map

Don't assume the minimal six-file set from `/scrolls-setup` is still the whole story — `STARTER.md` says explicitly that projects grow additional scrolls over time (architecture decisions, security reviews, subsystem deep-dives), each listed with its own read/update rule. Read the current `STARTER.md` in full and use *its* numbered list and "When to update" section as the source of truth for what files exist and how each one wants to be updated. If a file's update convention differs from the generic rules below (e.g. an append-only dated log that must never be edited in place, like this repo's own `SECURITY_ANALYSIS.md`), follow that file's specific convention over the generic one.

### 3. Establish what actually happened this session

Conversation context is the primary source — you were there. But don't rely on it alone, especially if context has been compacted, the session was resumed, or you're being asked to update scrolls for work that happened before this conversation started. Run the bundled script to cross-check against git — pick whichever of the two ships in `<skill-dir>/scripts/` matches the current environment (see "Cross-platform" below):

```
bash <skill-dir>/scripts/session_diff.sh SCROLLS_PATH
pwsh <skill-dir>/scripts/session_diff.ps1 -ScrollsDir SCROLLS_PATH
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

## Development

`tests/` holds this script's Red/Green regression suite (bash + PowerShell), for maintaining `scripts/session_diff.sh`/`scripts/session_diff.ps1` themselves — it plays no part in carrying out a user's `/scrolls-update` request. Don't read or run it while executing this skill.
