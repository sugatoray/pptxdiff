---
name: unhide-scrolls
description: "Converts an already-set-up docs/.scrolls/ working-memory folder from dotfile-hidden (.scrolls) to visible (scrolls), renaming the folder and rewriting the path references inside it and in CLAUDE.md so nothing breaks. Use this whenever the user runs /unhide-scrolls, or asks to unhide, un-dot, or show the scrolls folder, stop hiding project memory / docs/.scrolls, or rename .scrolls to scrolls. This is the retrofit path for a project that was set up hidden and now wants it visible — for a brand-new project, /setup-scrolls's own -u/--unhide flag does this in one step and this skill isn't needed. Supports -p/--path when the scrolls live somewhere other than ./docs."
---

# Unhiding docs/.scrolls/

`/setup-scrolls` defaults to a dotfile-hidden `.scrolls` folder. Some projects would rather have it visible in a normal directory listing — this skill renames `.scrolls` → `scrolls` on an existing setup and fixes every reference to the old path that it can find with confidence, without guessing at edits to files outside its scope.

**Everything operates relative to the current working directory** — the project root, not this skill's own location.

## Options

Read the invocation text for an optional **`-p <path>` / `--path=<path>` / `--path <path>`** — the docs folder containing the scrolls folder, relative to the current working directory unless given as an absolute path. Defaults to `docs`, matching `/setup-scrolls`'s default.

## Steps

### 1. Run the bundled script

```
bash <skill-dir>/scripts/unhide.sh [DOCS_BASE]
```

`DOCS_BASE` is the `--path` value if one was given, otherwise omit it (the script defaults to `docs`). The script:

1. Confirms `DOCS_BASE/.scrolls` exists (and `DOCS_BASE/scrolls` doesn't) before touching anything — it refuses to run if there's nothing to unhide, or if the target name is already taken, and it's a no-op (not an error) if the folder is already unhidden.
2. Renames it with `git mv` when the repo and file are git-tracked (preserving history), falling back to a plain `mv` otherwise.
3. Rewrites the literal old path inside the *moved folder's own files* (this catches `STARTER.md`, which references its own path throughout) and inside any `CLAUDE.md` it finds referencing the old path.
4. Prints any other files elsewhere in the repo that still mention the old path — these are **reported, not edited**. The script deliberately doesn't touch files outside the scrolls folder and `CLAUDE.md`, since rewriting arbitrary prose (READMEs, CI configs, other docs) without reading it first risks corrupting unrelated content.

### 2. Handle the leftover references it reports

For each file the script lists in "Other files still referencing" — read it and update the reference yourself if it's a genuine stale path (a README, a CONTRIBUTING doc, a CI script), using normal editing judgment rather than blind find-and-replace. Skip anything that isn't actually about this project's scrolls folder (e.g. a coincidental string match).

### 3. Report back

Confirm the new path (`DOCS_BASE/scrolls`), name what was auto-fixed (the folder's own files, `CLAUDE.md`), and list what you fixed manually in step 2, if anything.
