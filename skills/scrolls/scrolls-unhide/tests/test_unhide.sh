#!/usr/bin/env bash
# Red/Green regression test for unhide.sh, in bash (no PowerShell needed
# to run this — see test_unhide.ps1 for the parity harness that also
# cross-checks this script from the pwsh side).
# Run with: bash tests/test_unhide.sh
#
# Mirrors the scenarios covered by test_unhide.ps1, including the two
# real bugs caught during this script's own development: (1) absolute-
# path roots producing references that don't match the relative text
# actually written in STARTER.md/CLAUDE.md, and (2) a same-string-prefix
# sibling package's CLAUDE.md getting wrongly rewritten during a
# recursive sweep.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$HERE")"
SCRIPT="$SKILL_DIR/scripts/unhide.sh"

TOTAL=0
FAILURES=0

pass() { TOTAL=$((TOTAL + 1)); echo "PASS: $1"; }
fail() { TOTAL=$((TOTAL + 1)); FAILURES=$((FAILURES + 1)); echo "FAIL: $1"; }

assert() {
  local label="$1"; shift
  if "$@"; then pass "$label"; else fail "$label"; fi
}

assert_match() {
  local text="$1" pattern="$2" label="$3"
  if printf '%s' "$text" | grep -qE "$pattern"; then
    pass "$label"
  else
    fail "$label -- expected to match: $pattern"
    echo "--- actual output ---"; printf '%s\n' "$text"; echo "---"
  fi
}

assert_not_match() {
  local text="$1" pattern="$2" label="$3"
  if printf '%s' "$text" | grep -qE "$pattern"; then
    fail "$label -- expected NOT to match: $pattern"
    echo "--- actual output ---"; printf '%s\n' "$text"; echo "---"
  else
    pass "$label"
  fi
}

# Plain literal substring check (bash glob pattern, no regex metacharacter
# escaping needed) — used where the needle is an arbitrary path that may
# contain regex-special characters like "." (e.g. mktemp's own output).
assert_not_contains_literal() {
  local text="$1" needle="$2" label="$3"
  if [[ "$text" == *"$needle"* ]]; then
    fail "$label -- expected NOT to contain: $needle"
    echo "--- actual output ---"; printf '%s\n' "$text"; echo "---"
  else
    pass "$label"
  fi
}

assert_exit() {
  local actual="$1" expected="$2" label="$3"
  if [ "$actual" -eq "$expected" ]; then pass "$label"; else fail "$label -- expected exit $expected, got $actual"; fi
}

new_scratch_dir() { mktemp -d -t "scrolls-unhide-test.XXXXXX"; }

new_git_repo() {
  ( cd "$1" && git init -q && git config user.email test@test.com && git config user.name test )
}

# base, rel_docs_dir (e.g. "docs" or "packages/api/docs"), ref_form (what
# STARTER.md/CLAUDE.md reference internally, e.g. "docs/.scrolls")
new_scrolls_fixture() {
  local base="$1" rel_docs_dir="$2" ref_form="$3"
  mkdir -p "$base/$rel_docs_dir/.scrolls"
  printf '# STARTER.md\nRead %s/SPEC.md first.\n' "$ref_form" > "$base/$rel_docs_dir/.scrolls/STARTER.md"
  local base_of_docs
  base_of_docs="$(dirname "$base/$rel_docs_dir")"
  printf '# Project instructions\nRead %s/STARTER.md first.\n' "$ref_form" > "$base_of_docs/CLAUDE.md"
}

# ============================================================

echo
echo "=== Scenario 1: default (exact-check) unhides docs/.scrolls at cwd ==="
d1="$(new_scratch_dir)"
new_git_repo "$d1"
new_scrolls_fixture "$d1" "docs" "docs/.scrolls"
( cd "$d1" && git add -A && git commit -q -m init )
( cd "$d1" && bash "$SCRIPT" >/dev/null 2>&1 )
assert "docs/scrolls exists after unhide" test -d "$d1/docs/scrolls"
assert "docs/.scrolls no longer exists" bash -c "[ ! -d '$d1/docs/.scrolls' ]"
assert_match "$(cat "$d1/docs/scrolls/STARTER.md")" "docs/scrolls/SPEC\.md" "STARTER.md self-reference rewritten to docs/scrolls"
assert_match "$(cat "$d1/CLAUDE.md")" "docs/scrolls/STARTER\.md" "CLAUDE.md reference rewritten to docs/scrolls"
rm -rf "$d1"

echo
echo "=== Scenario 2: exact-check finds nothing from a subdirectory; -t finds it via the SHORT reference form ==="
d2="$(new_scratch_dir)"
new_git_repo "$d2"
new_scrolls_fixture "$d2" "docs" "docs/.scrolls"
mkdir -p "$d2/foo/bar"
( cd "$d2" && git add -A && git commit -q -m init )
out2="$(cd "$d2/foo/bar" && bash "$SCRIPT" 2>&1)"; code2=$?
assert_exit "$code2" 1 "exits 1 (not found) from subdirectory without -t"
assert_match "$out2" "scrolls-setup" "not-found message points at /scrolls-setup"

( cd "$d2/foo/bar" && bash "$SCRIPT" -t >/dev/null 2>&1 )
assert "docs/scrolls exists at repo root after unhide from subdirectory" test -d "$d2/docs/scrolls"
starter2="$(cat "$d2/docs/scrolls/STARTER.md")"
assert_match "$starter2" '^# STARTER\.md$' "STARTER.md rewritten to the SHORT form (docs/scrolls), not an absolute path"
assert_match "$starter2" "docs/scrolls/SPEC\.md" "STARTER.md contains the short-form reference"
assert_not_contains_literal "$starter2" "$d2" "STARTER.md does NOT contain the absolute scratch-dir path (would be a portability bug)"
assert_match "$(cat "$d2/CLAUDE.md")" "docs/scrolls/STARTER\.md" "CLAUDE.md rewritten to the short form too"
rm -rf "$d2"

echo
echo "=== Scenario 3: -r sweep finds a nested package without cross-contaminating its sibling's CLAUDE.md ==="
d3="$(new_scratch_dir)"
new_git_repo "$d3"
new_scrolls_fixture "$d3" "docs" "docs/.scrolls"
new_scrolls_fixture "$d3" "packages/api/docs" "docs/.scrolls"
( cd "$d3" && git add -A && git commit -q -m init )
( cd "$d3" && bash "$SCRIPT" -r >/dev/null 2>&1 )
assert "root scrolls folder unhidden" test -d "$d3/docs/scrolls"
assert "nested package scrolls folder unhidden too" test -d "$d3/packages/api/docs/scrolls"
root_claude3="$(cat "$d3/CLAUDE.md")"
pkg_claude3="$(cat "$d3/packages/api/CLAUDE.md")"
assert_match "$root_claude3" "docs/scrolls/STARTER\.md" "root CLAUDE.md correctly rewritten"
assert_match "$pkg_claude3" "docs/scrolls/STARTER\.md" "package CLAUDE.md correctly rewritten to its OWN short form"
assert_not_match "$root_claude3" "\.scrolls" "root CLAUDE.md has no leftover .scrolls reference"
assert_not_match "$pkg_claude3" "\.scrolls" "package CLAUDE.md has no leftover .scrolls reference"
rm -rf "$d3"

echo
echo "=== Scenario 4: repeatable -p targets two explicit locations in one run ==="
d4="$(new_scratch_dir)"
new_git_repo "$d4"
new_scrolls_fixture "$d4" "a/docs" "docs/.scrolls"
new_scrolls_fixture "$d4" "b/docs" "docs/.scrolls"
( cd "$d4" && git add -A && git commit -q -m init )
( cd "$d4" && bash "$SCRIPT" -p a -p b >/dev/null 2>&1 )
assert "-p a unhidden" test -d "$d4/a/docs/scrolls"
assert "-p b unhidden" test -d "$d4/b/docs/scrolls"
rm -rf "$d4"

echo
echo "=== Scenario 5: -p pointing directly at the scrolls folder itself ==="
d5="$(new_scratch_dir)"
new_git_repo "$d5"
new_scrolls_fixture "$d5" "docs" "docs/.scrolls"
( cd "$d5" && git add -A && git commit -q -m init )
( cd "$d5" && bash "$SCRIPT" -p docs/.scrolls >/dev/null 2>&1 )
assert "-p pointing directly at the folder works" test -d "$d5/docs/scrolls"
rm -rf "$d5"

echo
echo "=== Scenario 6: conflicting flags rejected ==="
d6="$(new_scratch_dir)"
new_git_repo "$d6"
out6="$(cd "$d6" && bash "$SCRIPT" -p x -t 2>&1)"; code6=$?
assert_exit "$code6" 2 "-p combined with -t exits 2"
assert_match "$out6" "Cannot combine" "-p combined with -t gives a clear error"
rm -rf "$d6"

echo
echo "=== Scenario 7: -t outside a git repository errors clearly ==="
d7="$(new_scratch_dir)"
out7="$(cd "$d7" && bash "$SCRIPT" -t 2>&1)"; code7=$?
assert_exit "$code7" 2 "-t outside git repo exits 2"
assert_match "$out7" "requires being inside a git repository" "-t outside git repo gives a clear error"
rm -rf "$d7"

echo
echo "=== Scenario 8: already-unhidden is a clean no-op, not an error ==="
d8="$(new_scratch_dir)"
new_git_repo "$d8"
mkdir -p "$d8/docs/scrolls"
echo "# STARTER.md" > "$d8/docs/scrolls/STARTER.md"
out8="$(cd "$d8" && bash "$SCRIPT" 2>&1)"; code8=$?
assert_exit "$code8" 1 "nothing to unhide (already visible) still exits 1 (nothing found)"
assert_match "$out8" "No \.scrolls folder found" "reports nothing found rather than crashing"
rm -rf "$d8"

echo
echo "=== Scenario 9: an earlier -p root with nothing to unhide doesn't abort later roots (regression) ==="
# Real bug caught by this test suite during development: handle_match's
# "[ -f STARTER.md ] || return" propagated the failed test's exit status
# as the function's own return code, and under `set -e` a plain function
# call returning nonzero kills the WHOLE SCRIPT -- silently skipping every
# root after the first one with nothing to find. Fixed to "return 0".
d9="$(new_scratch_dir)"
new_git_repo "$d9"
mkdir -p "$d9/empty"
new_scrolls_fixture "$d9" "has-scrolls/docs" "docs/.scrolls"
( cd "$d9" && git add -A && git commit -q -m init )
out9="$(cd "$d9" && bash "$SCRIPT" -p empty -p has-scrolls 2>&1)"; code9=$?
assert_exit "$code9" 0 "an empty root before a real one doesn't change the overall exit code"
assert "the SECOND root's scrolls folder still got processed despite the first root having nothing" test -d "$d9/has-scrolls/docs/scrolls"
rm -rf "$d9"

echo
echo "=== Scenario 10: a coincidentally-named match without STARTER.md doesn't abort a -r sweep (regression) ==="
# Same root cause as Scenario 9, but hit via the STARTER.md guard during a
# recursive sweep instead of via multiple -p roots -- a non-scrolls
# directory that happens to be named ".scrolls" anywhere in the tree used
# to silently kill the whole sweep before it reached the real one.
d10="$(new_scratch_dir)"
new_git_repo "$d10"
mkdir -p "$d10/random/.scrolls"
echo "not a real scrolls folder, no STARTER.md" > "$d10/random/.scrolls/notes.txt"
new_scrolls_fixture "$d10" "real/docs" "docs/.scrolls"
( cd "$d10" && git add -A && git commit -q -m init )
out10="$(cd "$d10" && bash "$SCRIPT" -r 2>&1)"; code10=$?
assert_exit "$code10" 0 "a coincidental non-match earlier in the sweep doesn't change the overall exit code"
assert "the real scrolls folder further into the sweep still got processed" test -d "$d10/real/docs/scrolls"
assert "the coincidentally-named non-scrolls directory was left alone" test -d "$d10/random/.scrolls"
rm -rf "$d10"

echo
echo "=== Results: $((TOTAL - FAILURES))/$TOTAL passed ==="
[ "$FAILURES" -eq 0 ] && exit 0 || exit 1
