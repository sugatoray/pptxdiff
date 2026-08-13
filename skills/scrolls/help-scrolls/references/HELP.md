# Scrolls — Command Reference

Scrolls are a small, checked-in `docs/.scrolls/` (or `docs/scrolls/`) file set that gives Claude cross-session memory for a project — what it does, what state it's in, what's known-missing, what's next, and what traps to avoid — plus a `CLAUDE.md` pointer that makes every future session read it first instead of re-discovering everything from scratch.

## Quick start

```
/setup-scrolls          # once, the first time in a project
/update-scrolls         # at the end of every session after that
```

That covers the typical single-repo workflow completely. Everything below is for less common cases: running from a subdirectory, monorepos, and toggling the folder's visibility.

## The four commands

| Command | Does |
|---|---|
| `/setup-scrolls` | Creates the scrolls system for a project that doesn't have one yet. |
| `/update-scrolls` | Updates an existing scrolls system to reflect what happened this session — the one to run regularly. |
| `/hide-scrolls` | Renames an existing `scrolls/` folder to dotfile-hidden `.scrolls/`. |
| `/unhide-scrolls` | Renames an existing `.scrolls/` folder to visible `scrolls/`. |

`/hide-scrolls` and `/unhide-scrolls` are retrofit tools — for a brand-new project, `/setup-scrolls -u` already creates it visible in one step, no separate toggle needed.

## Flags

All four commands share the same location flags. `-u` only makes sense on `setup`; `-r` means something specific to each command.

| Flag | Meaning | setup | update | hide / unhide |
|---|---|---|---|---|
| `-p`, `--path <dir>` | Use a specific docs folder / base directory instead of the default | single value | single value | repeatable |
| `-t`, `--reporoot` | Use the git repository's top level, regardless of cwd | ✓ | ✓ | ✓ |
| `-l`, `--local` | Use the current directory explicitly (same as the default, stated on purpose) | ✓ | ✓ | ✓ |
| `-r`, `--recurse` | See below — meaning differs per command | pre-creation duplicate scan | fallback search | sweep mode |
| `-u`, `--unhide` | Create the folder visible (`scrolls`) instead of hidden (`.scrolls`) | ✓ | — | — |

`-p`, `-t`, and `-l` are three ways to answer the same question ("where?") — pick at most one. `-r` is independent and stacks with any of them, or with none.

**What `-r`/`--recurse` does on each command**, since it's the one flag that isn't a location picker:
- `/setup-scrolls -r` — before creating anything, scans recursively for a scrolls folder that already exists nearby, and checks with you rather than silently creating a disconnected duplicate.
- `/update-scrolls -r` — if nothing's at the exact expected spot, searches recursively instead of just reporting "not set up" (and asks you to pick if it finds more than one).
- `/hide-scrolls -r` / `/unhide-scrolls -r` — without it, these check exactly one location; with it, they sweep an entire directory tree for every matching folder (e.g. every package in a monorepo, in one run).

**Default, with no flags at all**: everything happens relative to the current directory. If that's not the git repository's root, `/setup-scrolls` and `/update-scrolls` say so and check with you before proceeding — cwd still wins if you don't have a preference, it just won't happen silently.

## Examples

**First time in a new project, standing at the repo root:**
```
/setup-scrolls
```

**First time, but you're a couple of directories deep and want it at the repo root:**
```
/setup-scrolls -t
```

**Setting up scrolls for one package inside a monorepo:**
```
/setup-scrolls -p packages/api/docs
```

**Wrapping up a work session:**
```
/update-scrolls
```
Not sure exactly where the scrolls live relative to here:
```
/update-scrolls -r
```

**Want the scrolls folder visible in a normal directory listing instead of dotfile-hidden:**
```
/unhide-scrolls
```

**Convert every scrolls folder in a monorepo to visible, in one shot, from anywhere in the repo:**
```
/unhide-scrolls -t -r
```

**Put it back to hidden, same way:**
```
/hide-scrolls -t -r
```

## How the pieces fit together

- `docs/.scrolls/STARTER.md` (or `docs/scrolls/STARTER.md`) is the entry point: it lists the other six files in reading order and says when to update each.
- `CLAUDE.md`, at the same level as `docs`, points every session at `STARTER.md` first — that's the whole mechanism that makes this "memory."
- The six other files: `SPEC.md` (features, updated when they ship), `HANDOFF.md` (session snapshot, overwritten each time, not appended), `GAP_ANALYSIS.md`/`GAP_CONTEXT.md` (known gaps and why they exist), `PLAN.md` (prioritized backlog), `WISDOM.md` (constraints, traps, ditches, and lessons worth reusing).

## Troubleshooting

- **"It created a second scrolls system in a subdirectory I didn't expect."** You ran `/setup-scrolls` or `/update-scrolls` from somewhere other than the repo root without `-t`. Re-run with `-t` to target the repo root, or `-p`/`-l` to be explicit about where you meant.
- **"hide/unhide didn't find anything."** By default they check exactly one location (`<base>/docs/.scrolls` or `.../scrolls`). Add `-r` to search recursively, or `-t` if you meant the repo root.
- **"A monorepo package's `CLAUDE.md` got the wrong text after a sweep."** Shouldn't happen — hide/unhide only ever touch the one `CLAUDE.md` that's a direct sibling of the `docs` folder being renamed, never a broader search, specifically to avoid cross-wiring sibling packages that happen to share the same short reference text. If this happens, it's a bug worth reporting.
