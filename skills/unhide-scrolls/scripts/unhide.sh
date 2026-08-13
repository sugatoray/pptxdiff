#!/usr/bin/env bash
# Renames DOCS_BASE/.scrolls to DOCS_BASE/scrolls (preserving git history when
# possible), rewrites the literal old path inside the moved files and inside
# any CLAUDE.md that references it, then reports any other references left
# elsewhere in the repo for manual review.
#
# Usage: unhide.sh [docs-base-path]   (default: docs)
set -euo pipefail

DOCS_BASE="${1:-docs}"
DOCS_BASE="${DOCS_BASE%/}"
OLD_DIR="${DOCS_BASE}/.scrolls"
NEW_DIR="${DOCS_BASE}/scrolls"

if [ ! -d "$OLD_DIR" ]; then
  if [ -d "$NEW_DIR" ]; then
    echo "Already unhidden: $NEW_DIR exists and $OLD_DIR does not. Nothing to do."
    exit 0
  fi
  echo "No $OLD_DIR found. Nothing to unhide — run /setup-scrolls first if this project has no scrolls yet." >&2
  exit 1
fi

if [ -e "$NEW_DIR" ]; then
  echo "Refusing to overwrite: $NEW_DIR already exists." >&2
  exit 1
fi

IN_GIT=0
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  IN_GIT=1
fi

if [ "$IN_GIT" -eq 1 ] && git ls-files --error-unmatch "$OLD_DIR" >/dev/null 2>&1; then
  git mv "$OLD_DIR" "$NEW_DIR"
else
  mv "$OLD_DIR" "$NEW_DIR"
fi
echo "Moved $OLD_DIR -> $NEW_DIR"

# Escape regex metacharacters for safe use as a sed search pattern.
escape_for_sed() {
  printf '%s' "$1" | sed -e 's/[.[\*^$()+?{|/]/\\&/g'
}
OLD_RE=$(escape_for_sed "$OLD_DIR")

echo
echo "== Rewriting '$OLD_DIR' references to '$NEW_DIR' =="

# 1. Inside the moved folder's own files (STARTER.md, etc.)
while IFS= read -r f; do
  sed -i "s#${OLD_RE}#${NEW_DIR}#g" "$f"
  echo "Updated: $f"
done < <(grep -rlF -- "$OLD_DIR" "$NEW_DIR" 2>/dev/null || true)

# 2. Any CLAUDE.md anywhere that references the old path
if [ "$IN_GIT" -eq 1 ]; then
  claude_files=$(git grep -lF -- "$OLD_DIR" -- '*CLAUDE.md' 2>/dev/null || true)
else
  claude_files=$(grep -rlF -- "$OLD_DIR" . --include='CLAUDE.md' 2>/dev/null || true)
fi
if [ -n "$claude_files" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    sed -i "s#${OLD_RE}#${NEW_DIR}#g" "$f"
    echo "Updated: $f"
  done <<< "$claude_files"
fi

# 3. Report anything left over, for manual review — never auto-edit unknown files.
echo
echo "== Other files still referencing '$OLD_DIR' (review/update manually) =="
if [ "$IN_GIT" -eq 1 ]; then
  git grep -lF -- "$OLD_DIR" 2>/dev/null || echo "(none found)"
else
  grep -rlF -- "$OLD_DIR" . --exclude-dir=.git 2>/dev/null || echo "(none found)"
fi
