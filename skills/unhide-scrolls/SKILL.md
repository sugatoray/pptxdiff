---
name: unhide-scrolls
description: "Converts an already-set-up docs/.scrolls/ working-memory folder from dotfile-hidden (.scrolls) to visible (scrolls), renaming the folder and rewriting the path references inside it and in CLAUDE.md so nothing breaks. Works across one or many locations in a single run (e.g. every package in a monorepo). Use this whenever the user runs /unhide-scrolls, or asks to unhide, un-dot, or show the scrolls folder, stop hiding project memory / docs/.scrolls, or rename .scrolls to scrolls. This is the retrofit path for a project that was set up hidden and now wants it visible — for a brand-new project, /setup-scrolls's own -u/--unhide flag does this in one step and this skill isn't needed. Supports repeatable -p/--path to target specific locations, and the DEFAULT_SCROLLS_RELPATH environment variable to change the default search root. The opposite of /hide-scrolls."
---

# Unhiding docs/.scrolls/

`/setup-scrolls` defaults to a dotfile-hidden `.scrolls` folder. Some projects would rather have it visible in a normal directory listing — this skill renames `.scrolls` → `scrolls` on an existing setup and fixes every reference to the old path that it can find with confidence, without guessing at edits to files outside its scope. It's the mirror image of `/hide-scrolls`.

**Everything operates relative to the current working directory** — the project root, not this skill's own location.

## Options

Read the invocation text for zero or more **`-p <path>` / `--path=<path>` / `--path <path>`** — each one is a *root to search within* for scrolls folders, not necessarily the exact parent directory. `-p`/`--path` can be given multiple times to target several locations in one run (e.g. `-p packages/api -p packages/web` in a monorepo, or `-p docs/.scrolls` to target one exact folder). If none are given, the bundled script defaults to the `DEFAULT_SCROLLS_RELPATH` environment variable if the user has it set, otherwise the current directory — so a bare `/unhide-scrolls` with no arguments searches the whole project from wherever it's invoked.

## Steps

### 1. Run the bundled script

```
bash <skill-dir>/scripts/unhide.sh [-p ROOT ...]
```

Pass through whatever `-p`/`--path` values the user gave, in the same forms (`-p X`, `--path=X`, `--path X`), repeated once per root. Omit them entirely to use the default. The script:

1. Under each root, searches a bounded number of levels deep for directories literally named `.scrolls` that contain a `STARTER.md` — that guard is what makes a broad default root (even the whole repo) safe to search: coincidentally-named directories without a `STARTER.md` are ignored, and common heavy/vendor directories (`node_modules`, `.git`, `vendor`, `dist`, `build`, `.venv`, `venv`, `__pycache__`, `target`, `.next`, `.cache`) are pruned rather than descended into. A root that *is* itself a scrolls folder also matches directly.
2. For each match: skips it (reporting why) if a `scrolls` folder already sits alongside it; otherwise renames it with `git mv` when the repo and file are git-tracked (preserving history), falling back to a plain `mv` otherwise.
3. Rewrites the literal old path inside the *moved folder's own files* (this catches `STARTER.md`, which references its own path throughout) and inside any `CLAUDE.md` it finds referencing the old path.
4. Prints any other files elsewhere in the repo that still mention the old path — these are **reported, not edited**. The script deliberately doesn't touch files outside the scrolls folder and `CLAUDE.md`, since rewriting arbitrary prose (READMEs, CI configs, other docs) without reading it first risks corrupting unrelated content.

Exits with an error if a given root has no matching folder anywhere under it — that's the signal to check the path or point the user at `/setup-scrolls` instead.

### 2. Handle the leftover references it reports

For each file the script lists under "Other references... left for manual review" — read it and update the reference yourself if it's a genuine stale path (a README, a CONTRIBUTING doc, a CI script), using normal editing judgment rather than blind find-and-replace. Skip anything that isn't actually about this project's scrolls folder (e.g. a coincidental string match).

### 3. Report back

List each folder that was unhidden (old path → new path), what was auto-fixed for each (its own files, `CLAUDE.md`), any that were skipped and why (target already existed), and what you fixed manually in step 2, if anything.
