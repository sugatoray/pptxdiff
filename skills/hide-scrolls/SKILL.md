---
name: hide-scrolls
description: "Converts an already-set-up docs/scrolls/ working-memory folder from visible (scrolls) to dotfile-hidden (.scrolls), renaming the folder and rewriting the path references inside it and in CLAUDE.md so nothing breaks. Works across one or many locations in a single run (e.g. every package in a monorepo). Use this whenever the user runs /hide-scrolls, or asks to hide, dot, or re-hide the scrolls folder, go back to hiding project memory / docs/.scrolls, or rename scrolls to .scrolls. This is the retrofit path for a project that was set up visible and now wants it hidden — for a brand-new project, /setup-scrolls's default (no -u/--unhide flag) already creates it hidden and this skill isn't needed. Supports repeatable -p/--path to target specific locations, -r/--reporoot to target the git repository's top level regardless of which subdirectory you're in, -l/--local to target the current directory explicitly, and the DEFAULT_SCROLLS_RELPATH environment variable to change the default search root. Defaults to the current directory, but notes when that differs from the repo root so scrolls elsewhere in the repo aren't silently missed. The opposite of /unhide-scrolls."
---

# Hiding docs/scrolls/

Some projects run their scrolls folder visible (`scrolls`, e.g. via `/setup-scrolls --unhide` or a prior `/unhide-scrolls`) and later want it back to the dotfile-hidden default. This skill renames `scrolls` → `.scrolls` and fixes every reference to the old path that it can find with confidence, without guessing at edits to files outside its scope. It's the mirror image of `/unhide-scrolls` — same mechanics, opposite direction.

**Everything operates relative to the current working directory** unless `-r`/`--reporoot` says otherwise — not relative to this skill's own location.

## Options

Read the invocation text for these, in any order — there's no real argv parser here, so pull them out of the plain text yourself:

- **`-p <path>` / `--path=<path>` / `--path <path>`** — a *root to search within* for scrolls folders, not necessarily the exact parent directory. Repeatable, to target several locations in one run (e.g. `-p packages/api -p packages/web` in a monorepo, or `-p docs/scrolls` to target one exact folder).
- **`-r` / `--reporoot`** — search `$(git rev-parse --show-toplevel)/docs` specifically, regardless of which subdirectory you actually invoked this from. Fails with a clear message if the current directory isn't inside a git repository.
- **`-l` / `--local`** — search `<cwd>/docs` explicitly. This is close to the default behavior, but narrower: the plain default sweeps the whole current directory tree, while `-l` pins specifically to its `docs` subfolder.

`-p`, `-r`, and `-l` are three different ways to pick a location — `-r` and `-l` each resolve to a single root and can't be combined with `-p` or with each other; pass `-p` (repeatably) for anything more specific. If none of these are given, the bundled script defaults to the `DEFAULT_SCROLLS_RELPATH` environment variable if the user has it set, otherwise the current directory — and if that default differs from the repo's top level (in a git repo), the script prints a note pointing at `-r` as an alternative, since a scrolls folder that lives at the repo root instead would otherwise be silently out of scope (not an error — the sweep still runs, just narrower than it might need to be).

Because a directory literally named `scrolls` (no dot) is a more generic name than `.scrolls`, false positives are more plausible here than in `/unhide-scrolls` — the `STARTER.md`-presence guard described below is what keeps a broad root safe regardless.

## Steps

### 1. Run the bundled script

```
bash <skill-dir>/scripts/hide.sh [-p ROOT ...] | [-r] | [-l]
```

Pass through whatever flags the user gave, in the same forms. Omit them entirely to use the default. The script:

1. Under each resolved root, searches a bounded number of levels deep for directories literally named `scrolls` that contain a `STARTER.md` — that guard is what makes a broad root (even the whole repo) safe to search: coincidentally-named directories without a `STARTER.md` are ignored, and common heavy/vendor directories (`node_modules`, `.git`, `vendor`, `dist`, `build`, `.venv`, `venv`, `__pycache__`, `target`, `.next`, `.cache`) are pruned rather than descended into. A root that *is* itself a scrolls folder also matches directly.
2. For each match: skips it (reporting why) if a `.scrolls` folder already sits alongside it; otherwise renames it with `git mv` when the repo and file are git-tracked (preserving history), falling back to a plain `mv` otherwise.
3. Rewrites the reference to the old path inside the *moved folder's own files* (this catches `STARTER.md`, which references its own path throughout) and inside any `CLAUDE.md` it finds referencing it, **scoped to the directory containing `docs`** — not the whole repo. `/setup-scrolls` writes a short, portable reference (`docs/scrolls`) relative to wherever `CLAUDE.md` itself lives, so in a multi-location sweep two different scrolls folders can legitimately share that same short string; scoping the rewrite locally is what keeps a monorepo sweep from cross-wiring one package's fix into another's files. (It also tries the full path as discovered, for scrolls folders set up with a custom `--path` under the older convention.)
4. Prints any other files within that same scope that still mention the old path — these are **reported, not edited**. The script deliberately doesn't touch files outside the scrolls folder and `CLAUDE.md`, since rewriting arbitrary prose (READMEs, CI configs, other docs) without reading it first risks corrupting unrelated content.

Exits with an error if a given root has no matching folder anywhere under it — that's the signal to check the path (or try `-r` if you expected the repo root) or point the user at `/setup-scrolls` instead.

### 2. Handle the leftover references it reports

For each file the script lists under "Other references... left for manual review" — read it and update the reference yourself if it's a genuine stale path (a README, a CONTRIBUTING doc, a CI script), using normal editing judgment rather than blind find-and-replace. Skip anything that isn't actually about this project's scrolls folder (e.g. a coincidental string match).

### 3. Report back

List each folder that was hidden (old path → new path), what was auto-fixed for each (its own files, `CLAUDE.md`), any that were skipped and why (target already existed), and what you fixed manually in step 2, if anything.
