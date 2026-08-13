#!/usr/bin/env bash
# Red/Green regression test for session_diff.sh, in bash (no PowerShell
# needed to run this — see test_session_diff.ps1 for the parity harness
# that also cross-checks this script from the pwsh side).
# Run with: bash tests/test_session_diff.sh
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$HERE")"
SCRIPT="$SKILL_DIR/scripts/session_diff.sh"

TOTAL=0
FAILURES=0

pass() { TOTAL=$((TOTAL + 1)); echo "PASS: $1"; }
fail() { TOTAL=$((TOTAL + 1)); FAILURES=$((FAILURES + 1)); echo "FAIL: $1"; }

assert_match() {
  local text="$1" pattern="$2" label="$3"
  if printf '%s' "$text" | grep -qE "$pattern"; then
    pass "$label"
  else
    fail "$label -- expected to match: $pattern"
    echo "--- actual output ---"; printf '%s\n' "$text"; echo "---"
  fi
}

assert_exit() {
  local actual="$1" expected="$2" label="$3"
  if [ "$actual" -eq "$expected" ]; then pass "$label"; else fail "$label -- expected exit $expected, got $actual"; fi
}

new_scratch_dir() { mktemp -d -t "scrolls-update-test.XXXXXX"; }

new_git_repo() {
  ( cd "$1" && git init -q && git config user.email test@test.com && git config user.name test )
}

# ============================================================

echo
echo "=== Scenario A: not a git repository ==="
dirA="$(new_scratch_dir)"
out="$(cd "$dirA" && bash "$SCRIPT" 2>&1)"; code=$?
assert_match "$out" "Not a git repository" "reports not-a-git-repo"
assert_exit "$code" 0 "exits 0 on not-a-git-repo"
rm -rf "$dirA"

echo
echo "=== Scenario B: git repo, no scrolls dir ==="
dirB="$(new_scratch_dir)"
new_git_repo "$dirB"
out="$(cd "$dirB" && bash "$SCRIPT" 2>&1)"; code=$?
assert_match "$out" "scrolls-setup" "points at /scrolls-setup when nothing found"
assert_exit "$code" 1 "exits 1 when nothing found"
rm -rf "$dirB"

echo
echo "=== Scenario C: scrolls dir exists, never committed ==="
dirC="$(new_scratch_dir)"
new_git_repo "$dirC"
mkdir -p "$dirC/docs/.scrolls"
echo "# STARTER" > "$dirC/docs/.scrolls/STARTER.md"
out="$(cd "$dirC" && bash "$SCRIPT" 2>&1)"; code=$?
assert_match "$out" "no commit history yet" "reports no commit history for uncommitted scrolls dir"
assert_exit "$code" 0 "exits 0 when scrolls dir has no history"
rm -rf "$dirC"

echo
echo "=== Scenario D: scrolls committed, then more commits + uncommitted change ==="
dirD="$(new_scratch_dir)"
new_git_repo "$dirD"
mkdir -p "$dirD/docs/.scrolls"
echo "# STARTER" > "$dirD/docs/.scrolls/STARTER.md"
( cd "$dirD" && git add -A && git commit -q -m "init scrolls" )
echo 'console.log(1)' > "$dirD/app.js"
( cd "$dirD" && git add -A && git commit -q -m "add app.js" )
echo "uncommitted change" > "$dirD/README.md"
out="$(cd "$dirD" && bash "$SCRIPT" 2>&1)"; code=$?
assert_match "$out" "Uncommitted changes" "shows uncommitted-changes section"
assert_match "$out" "README\.md" "lists the actual uncommitted file"
assert_match "$out" "was last touched at commit" "shows last-touched-commit section"
assert_match "$out" "add app\.js" "lists the commit made after the scrolls dir"
assert_match "$out" "app\.js" "lists app.js in the changed-files stat"
assert_exit "$code" 0 "exits 0 on the full-report path"
rm -rf "$dirD"

echo
echo "=== Scenario E: custom SCROLLS_DIR positional argument ==="
dirE="$(new_scratch_dir)"
new_git_repo "$dirE"
mkdir -p "$dirE/packages/api/docs/.scrolls"
echo "# STARTER" > "$dirE/packages/api/docs/.scrolls/STARTER.md"
out="$(cd "$dirE" && bash "$SCRIPT" "packages/api/docs/.scrolls" 2>&1)"; code=$?
assert_match "$out" "no commit history yet" "honors a custom SCROLLS_DIR positional argument"
assert_exit "$code" 0 "exits 0 for the custom path"
rm -rf "$dirE"

echo
echo "=== Results: $((TOTAL - FAILURES))/$TOTAL passed ==="
[ "$FAILURES" -eq 0 ] && exit 0 || exit 1
