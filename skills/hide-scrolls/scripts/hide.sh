#!/usr/bin/env bash
# Finds scrolls folders under one or more roots and renames each to
# .scrolls (dotfile-hidden), rewriting the path references inside the
# moved folder and in any CLAUDE.md that mentions it. Reports (never
# auto-edits) any other stray references found elsewhere in the repo.
#
# The exact mirror of unhide-scrolls's unhide.sh, in the opposite
# direction — see that script's header for the full option/discovery
# rationale, which applies here unchanged.
#
# Usage: hide.sh [-p ROOT | --path=ROOT | --path ROOT] ...
# -p/--path may be repeated to target multiple locations in one run.
# Default root (if none given): $DEFAULT_SCROLLS_RELPATH if set, else
# the current directory. Each root is searched a bounded number of
# levels deep (common vendor/build dirs pruned) for directories
# literally named "scrolls" containing a STARTER.md — that guard means
# passing a broad root (even ".") is safe: only real scrolls folders
# match, and a root that IS a scrolls folder itself also matches
# directly.
set -euo pipefail

FROM_NAME="scrolls"
TO_NAME=".scrolls"
MAXDEPTH=8
PRUNE_NAMES=(.git node_modules vendor dist build .venv venv __pycache__ target .next .cache)

roots=()
while [ $# -gt 0 ]; do
  case "$1" in
    -p) roots+=("$2"); shift 2 ;;
    --path) roots+=("$2"); shift 2 ;;
    --path=*) roots+=("${1#--path=}"); shift ;;
    -p=*) roots+=("${1#-p=}"); shift ;;
    *) echo "Unrecognized argument: $1" >&2; exit 2 ;;
  esac
done
if [ ${#roots[@]} -eq 0 ]; then
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

# References written by setup/update-scrolls are always relative to the
# project root (cwd). Normalize whatever form `find` handed back — absolute
# (when a root defaulted to $(pwd)) or "./"-prefixed (when a root was ".")
# — to that same cwd-relative form, so grep/sed line up with the on-disk text.
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
  local new_dir
  new_dir="$(dirname "$old_dir")/${TO_NAME}"

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

  local old_re
  old_re=$(escape_for_sed "$old_dir")

  while IFS= read -r f; do
    sed -i "s#${old_re}#${new_dir}#g" "$f"
    echo "  Updated: $f"
  done < <(grep -rlF -- "$old_dir" "$new_dir" 2>/dev/null || true)

  local claude_files
  if [ "$in_git" -eq 1 ]; then
    claude_files=$(git grep -lF -- "$old_dir" -- '*CLAUDE.md' 2>/dev/null || true)
  else
    claude_files=$(grep -rlF -- "$old_dir" . --include='CLAUDE.md' 2>/dev/null || true)
  fi
  if [ -n "$claude_files" ]; then
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      sed -i "s#${old_re}#${new_dir}#g" "$f"
      echo "  Updated: $f"
    done <<< "$claude_files"
  fi

  echo "  Other references to '$old_dir' left for manual review:"
  local leftover
  if [ "$in_git" -eq 1 ]; then
    leftover=$(git grep -lF -- "$old_dir" 2>/dev/null || true)
  else
    leftover=$(grep -rlF -- "$old_dir" . --exclude-dir=.git 2>/dev/null || true)
  fi
  if [ -n "$leftover" ]; then
    echo "$leftover" | sed 's/^/    /'
  else
    echo "    (none found)"
  fi
}

declare -A seen=()
found_any=0

for root in "${roots[@]}"; do
  root="${root%/}"
  [ -z "$root" ] && root="."
  if [ ! -d "$root" ]; then
    echo "WARN: root '$root' does not exist, skipping" >&2
    continue
  fi

  while IFS= read -r -d '' raw_dir; do
    dir="$(normalize_path "$raw_dir")"
    [ -f "$dir/STARTER.md" ] || continue
    if [ -n "${seen[$dir]:-}" ]; then
      continue
    fi
    seen[$dir]=1
    found_any=1
    echo
    echo "== $dir =="
    process_one "$dir"
  done < <(find "$root" -maxdepth "$MAXDEPTH" \( "${prune_expr[@]}" \) -prune -o -type d -name "$FROM_NAME" -print0)
done

if [ "$found_any" -eq 0 ]; then
  echo "No $FROM_NAME folders found under: ${roots[*]}"
  echo "If this project hasn't been set up yet, run /setup-scrolls first."
  exit 1
fi
