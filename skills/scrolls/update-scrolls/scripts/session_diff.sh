#!/usr/bin/env bash
# Summarizes what changed since docs/.scrolls/ was last updated, as evidence
# for /update-scrolls. Conversation context is the primary source of truth;
# this is a cross-check for when that context is thin, compacted, or the
# scrolls are being updated for work done outside the current conversation.
set -euo pipefail

SCROLLS_DIR="${1:-docs/.scrolls}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repository — no commit history to inspect. Rely on conversation context only."
  exit 0
fi

if [ ! -d "$SCROLLS_DIR" ]; then
  echo "No $SCROLLS_DIR directory found here. Run /setup-scrolls first — there's nothing to update yet."
  exit 1
fi

echo "== Uncommitted changes (working tree vs HEAD) =="
git status --short || true

LAST_COMMIT=$(git log -1 --format=%H -- "$SCROLLS_DIR" 2>/dev/null || true)

if [ -z "$LAST_COMMIT" ]; then
  echo
  echo "== $SCROLLS_DIR has no commit history yet — nothing to diff against. =="
  echo "Treat this as the first update since setup; describe the session from context alone."
  exit 0
fi

echo
echo "== $SCROLLS_DIR was last touched at commit $LAST_COMMIT =="
git log -1 --format='%h %ad %s' --date=short "$LAST_COMMIT"

echo
echo "== Commits since then =="
git log --oneline "${LAST_COMMIT}..HEAD" 2>/dev/null || echo "(none — HEAD hasn't moved since)"

echo
echo "== Files changed since then, excluding $SCROLLS_DIR itself =="
git diff --stat "${LAST_COMMIT}..HEAD" -- . ":(exclude)${SCROLLS_DIR}/*" 2>/dev/null || echo "(no diff available)"
