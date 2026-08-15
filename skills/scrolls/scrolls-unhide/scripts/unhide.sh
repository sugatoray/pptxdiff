#!/usr/bin/env bash
# Renames .scrolls folder(s) to scrolls (visible), rewriting the path
# references inside the moved folder and in any CLAUDE.md that mentions
# it. Reports (never auto-edits) any other stray references it finds
# nearby.
#
# Usage:
#   unhide.sh [-p ROOT | --path=ROOT | --path ROOT] ... [-r|--recurse]
#   unhide.sh -t | --reporoot [-r|--recurse]
#   unhide.sh -l | --local    [-r|--recurse]
#
# -p/--path may be repeated to target multiple locations in one run.
# -t/-l each resolve to a single BASE_DIR (the git repo's top level, or
# the current directory) and cannot be combined with -p or with each
# other. -r/--recurse is an independent modifier, combinable with any
# of the above (or with none, recursing from cwd).
#
# Default (no -p/-t/-l): $DEFAULT_SCROLLS_RELPATH if set, else the
# current directory, used as BASE_DIR.
#
# Without -r (default): for each BASE_DIR, checks exactly one spot —
# BASE_DIR itself if it already IS a scrolls folder (has STARTER.md),
# otherwise BASE_DIR/docs/.scrolls. This matches the location
# scrolls-setup/scrolls-update use by default, so a bare invocation
# targets the obvious place first, like `rm`/`cp` without -r.
#
# With -r/--recurse: searches a bounded number of levels deep under
# BASE_DIR (common vendor/build dirs pruned) for ANY directory
# literally named ".scrolls" containing a STARTER.md — for a
# monorepo-wide sweep. If BASE_DIR wasn't given explicitly (no -p/-t/-l)
# and differs from the git repo root, a note points at -t as well, in
# case the repo root should be included in the sweep too.
set -euo pipefail

FROM_NAME=".scrolls"
TO_NAME="scrolls"
MAXDEPTH=8
PRUNE_NAMES=(.git node_modules vendor dist build .venv venv __pycache__ target .next .cache)

roots=()
mode=""      # "", "path", "reporoot", "local"
recurse=0

conflict_check() {
  if [ -n "$mode" ] && [ "$mode" != "$1" ]; then
    echo "Cannot combine -p/--path with -t/--reporoot or -l/--local — pick one way to target a location." >&2
    exit 2
  fi
  mode="$1"
}

while [ $# -gt 0 ]; do
  case "$1" in
    -p) conflict_check path; roots+=("$2"); shift 2 ;;
    --path) conflict_check path; roots+=("$2"); shift 2 ;;
    --path=*) conflict_check path; roots+=("${1#--path=}"); shift ;;
    -p=*) conflict_check path; roots+=("${1#-p=}"); shift ;;
    -t|--reporoot)
      conflict_check reporoot
      repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
        echo "-t/--reporoot requires being inside a git repository; none was detected here." >&2
        exit 2
      }
      roots=("$repo_root")
      shift
      ;;
    -l|--local)
      conflict_check local
      roots=(".")
      shift
      ;;
    -r|--recurse) recurse=1; shift ;;
    *) echo "Unrecognized argument: $1" >&2; exit 2 ;;
  esac
done

if [ ${#roots[@]} -eq 0 ]; then
  if [ -z "${DEFAULT_SCROLLS_RELPATH:-}" ] && [ "$recurse" -eq 0 ]; then
    repo_root=$(git rev-parse --show-toplevel 2>/dev/null || true)
    if [ -n "$repo_root" ] && [ "$repo_root" != "$(pwd)" ]; then
      echo "Note: checking $(pwd)/docs only — not the repo root ($repo_root), not recursively." >&2
      echo "Pass -t/--reporoot to check the repo root's docs instead, -r/--recurse to search recursively under here, or both to sweep the whole repo." >&2
      echo >&2
    fi
  fi
  roots=("${DEFAULT_SCROLLS_RELPATH:-$(pwd)}")
fi

prune_expr=()
for n in "${PRUNE_NAMES[@]}"; do
  prune_expr+=(-name "$n" -o)
done
unset 'prune_expr[${#prune_expr[@]}-1]'

escape_for_sed() {
  printf '%s' "$1" | sed -e 's/[.[\*^$()+?{|/]/\\&/g'
}

# References written by setup/scrolls-update are always relative to the
# project root (cwd). Normalize whatever form we ended up with — absolute
# (e.g. from -t) or "./"-prefixed — to that same cwd-relative form, so
# grep/sed line up with the on-disk text.
normalize_path() {
  local p="$1" cwd
  cwd="$(pwd)"
  case "$p" in
    "$cwd"/*) p="${p#"$cwd"/}" ;;
    "$cwd") p="." ;;
  esac
  p="${p#./}"
  printf '%s' "$p"
}

process_one() {
  local old_dir="$1"
  local docs_dir base_dir docs_name new_dir short_old short_new

  docs_dir="$(dirname "$old_dir")"        # .../docs
  base_dir="$(dirname "$docs_dir")"        # whatever contains "docs" — where CLAUDE.md should live
  docs_name="$(basename "$docs_dir")"      # normally "docs", but honors a custom --path basename
  new_dir="${docs_dir}/${TO_NAME}"
  short_old="${docs_name}/${FROM_NAME}"    # e.g. "docs/.scrolls" — the portable form scrolls-setup
  short_new="${docs_name}/${TO_NAME}"      # writes for -t/-l/default (see scrolls-setup step 3)

  if [ -e "$new_dir" ]; then
    echo "SKIP: $old_dir -> $new_dir already exists"
    return
  fi

  local in_git=0
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 && in_git=1

  if [ "$in_git" -eq 1 ] && git ls-files --error-unmatch "$old_dir" >/dev/null 2>&1; then
    git mv "$old_dir" "$new_dir"
  else
    mv "$old_dir" "$new_dir"
  fi
  echo "Moved: $old_dir -> $new_dir"

  local old_re short_re
  old_re=$(escape_for_sed "$old_dir")
  short_re=$(escape_for_sed "$short_old")

  # A scrolls folder's own references (e.g. inside STARTER.md) may be written
  # either as the full path from wherever this was invoked (old_dir) or as
  # the short form relative to base_dir (short_old, what -t/-l/default use)
  # — try both; whichever isn't present is simply a no-op substitution.
  rewrite_file() {
    sed -i -e "s#${old_re}#${new_dir}#g" -e "s#${short_re}#${short_new}#g" "$1"
    echo "  Updated: $1"
  }

  while IFS= read -r f; do
    rewrite_file "$f"
  done < <(grep -rlF -e "$old_dir" -e "$short_old" "$new_dir" 2>/dev/null || true)

  # CLAUDE.md is always an exact, direct sibling of "docs" by construction
  # (that's the whole point of the short-form convention scrolls-setup
  # writes) — check that ONE specific file, never a recursive search.
  # A recursive search scoped to base_dir sounds safe but isn't: when
  # base_dir is itself the repo root (the common case), "scoped to
  # base_dir" is no restriction at all, and a sibling package's CLAUDE.md
  # sharing the same short reference string would get wrongly rewritten.
  local claude_md="${base_dir}/CLAUDE.md"
  if [ -f "$claude_md" ] && grep -qF -e "$old_dir" -e "$short_old" "$claude_md" 2>/dev/null; then
    rewrite_file "$claude_md"
  fi

  # Leftover-reference reporting is read-only, so a false positive here is
  # just noise, not a correctness risk — but still exclude other scrolls
  # folders' own internal self-references, the most common source of noise
  # under the shared short-form convention.
  echo "  Other references (within $base_dir) left for manual review:"
  local leftover
  leftover=$(grep -rlF -e "$old_dir" -e "$short_old" "$base_dir" --exclude-dir=.git --exclude-dir=.scrolls --exclude-dir=scrolls 2>/dev/null || true)
  if [ -n "$leftover" ]; then
    echo "$leftover" | sed 's/^/    /'
  else
    echo "    (none found)"
  fi
}

declare -A seen=()
found_any=0

handle_match() {
  local raw_dir="$1"
  local dir
  dir="$(normalize_path "$raw_dir")"
  # Bare `return` after a FAILED test propagates that test's nonzero exit
  # status as this function's return code — under `set -e`, a plain
  # function-call statement returning nonzero kills the whole script, not
  # just this candidate. That silently aborted the entire run (skipping
  # every remaining -p root, or the rest of a -r sweep) whenever a
  # candidate lacked STARTER.md, which is exactly the common "nothing here"
  # case this guard exists to handle gracefully. `return 0` makes clear
  # this is "skip this candidate," never a script-level error.
  [ -f "$dir/STARTER.md" ] || return 0
  if [ -n "${seen[$dir]:-}" ]; then
    return 0
  fi
  seen[$dir]=1
  found_any=1
  echo
  echo "== $dir =="
  process_one "$dir"
}

for root in "${roots[@]}"; do
  root="${root%/}"
  [ -z "$root" ] && root="."
  if [ ! -d "$root" ]; then
    echo "WARN: root '$root' does not exist, skipping" >&2
    continue
  fi

  if [ "$recurse" -eq 1 ]; then
    while IFS= read -r -d '' raw_dir; do
      handle_match "$raw_dir"
    done < <(find "$root" -maxdepth "$MAXDEPTH" \( "${prune_expr[@]}" \) -prune -o -type d -name "$FROM_NAME" -print0)
  else
    if [ -f "$root/STARTER.md" ]; then
      handle_match "$root"
    else
      handle_match "${root}/docs/${FROM_NAME}"
    fi
  fi
done

if [ "$found_any" -eq 0 ]; then
  echo "No $FROM_NAME folder found under: ${roots[*]}"
  if [ "$recurse" -eq 0 ]; then
    echo "Checked the exact default location only — pass -r/--recurse to search recursively instead."
  fi
  echo "If this project hasn't been set up yet, run /scrolls-setup first."
  exit 1
fi
