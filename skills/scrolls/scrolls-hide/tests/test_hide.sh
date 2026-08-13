#!/usr/bin/env bash
# Red/Green regression test for hide.sh, in bash (no PowerShell needed to
# run this — see test_hide.ps1 for the parity harness that also
# cross-checks this script from the pwsh side).
# Run with: bash tests/test_hide.sh
# Mirror of scrolls-unhide/tests/test_unhide.sh, opposite direction —
# see that file for the full scenario rationale, including Scenarios 9-10
# which regression-guard a real set -e/bare-return bug found and fixed
# in both hide.sh and unhide.sh during this test suite's own development.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$HERE")"
SCRIPT="$SKILL_DIR/scripts/hide.sh"

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

new_scratch_dir() { mktemp -d -t "scrolls-hide-test.XXXXXX"; }

new_git_repo() {
  ( cd "$1" && git init -q && git config user.email test@test.com && git config user.name test )
}

# Opposite of unhide's fixture: starts VISIBLE ("scrolls", no dot).
new_visible_scrolls_fixture() {
  local base="$1" rel_docs_dir="$2" ref_form="$3"
  mkdir -p "$base/$rel_docs_dir/scrolls"
  printf '# STARTER.md\nRead %s/SPEC.md first.\n' "$ref_form" > "$base/$rel_docs_dir/scrolls/STARTER.md"
  local base_of_docs
  base_of_docs="$(dirname "$base/$rel_docs_dir")"
  printf '# Project instructions\nRead %s/STARTER.md first.\n' "$ref_form" > "$base_of_docs/CLAUDE.md"
}

# ============================================================

echo
echo "=== Scenario 1: default (exact-check) hides docs/scrolls at cwd ==="
d1="$(new_scratch_dir)"
new_git_repo "$d1"
new_visible_scrolls_fixture "$d1" "docs" "docs/scrolls"
( cd "$d1" && git add -A && git commit -q -m init )
( cd "$d1" && bash "$SCRIPT" >/dev/null 2>&1 )
assert "docs/.scrolls exists after hide" test -d "$d1/docs/.scrolls"
assert "docs/scrolls no longer exists" bash -c "[ ! -d '$d1/docs/scrolls' ]"
assert_match "$(cat "$d1/docs/.scrolls/STARTER.md")" 'docs/\.scrolls/SPEC\.md' "STARTER.md self-reference rewritten to docs/.scrolls"
assert_match "$(cat "$d1/CLAUDE.md")" 'docs/\.scrolls/STARTER\.md' "CLAUDE.md reference rewritten to docs/.scrolls"
rm -rf "$d1"

echo
echo "=== Scenario 2: exact-check finds nothing from a subdirectory; -t finds it via the SHORT reference form ==="
d2="$(new_scratch_dir)"
new_git_repo "$d2"
new_visible_scrolls_fixture "$d2" "docs" "docs/scrolls"
mkdir -p "$d2/foo/bar"
( cd "$d2" && git add -A && git commit -q -m init )
out2="$(cd "$d2/foo/bar" && bash "$SCRIPT" 2>&1)"; code2=$?
assert_exit "$code2" 1 "exits 1 (not found) from subdirectory without -t"
assert_match "$out2" "scrolls-setup" "not-found message points at /scrolls-setup"

( cd "$d2/foo/bar" && bash "$SCRIPT" -t >/dev/null 2>&1 )
assert "docs/.scrolls exists at repo root after hide from subdirectory" test -d "$d2/docs/.scrolls"
starter2="$(cat "$d2/docs/.scrolls/STARTER.md")"
assert_match "$starter2" '^# STARTER\.md$' "STARTER.md rewritten to the SHORT form, not an absolute path"
assert_not_contains_literal "$starter2" "$d2" "STARTER.md does NOT contain the absolute scratch-dir path"
rm -rf "$d2"

echo
echo "=== Scenario 3: -r sweep finds a nested package without cross-contaminating its sibling's CLAUDE.md ==="
d3="$(new_scratch_dir)"
new_git_repo "$d3"
new_visible_scrolls_fixture "$d3" "docs" "docs/scrolls"
new_visible_scrolls_fixture "$d3" "packages/api/docs" "docs/scrolls"
( cd "$d3" && git add -A && git commit -q -m init )
( cd "$d3" && bash "$SCRIPT" -r >/dev/null 2>&1 )
assert "root scrolls folder hidden" test -d "$d3/docs/.scrolls"
assert "nested package scrolls folder hidden too" test -d "$d3/packages/api/docs/.scrolls"
assert_match "$(cat "$d3/CLAUDE.md")" 'docs/\.scrolls/STARTER\.md' "root CLAUDE.md correctly rewritten"
assert_match "$(cat "$d3/packages/api/CLAUDE.md")" 'docs/\.scrolls/STARTER\.md' "package CLAUDE.md correctly rewritten to its OWN short form"
rm -rf "$d3"

echo
echo "=== Scenario 4: repeatable -p targets two explicit locations in one run ==="
d4="$(new_scratch_dir)"
new_git_repo "$d4"
new_visible_scrolls_fixture "$d4" "a/docs" "docs/scrolls"
new_visible_scrolls_fixture "$d4" "b/docs" "docs/scrolls"
( cd "$d4" && git add -A && git commit -q -m init )
( cd "$d4" && bash "$SCRIPT" -p a -p b >/dev/null 2>&1 )
assert "-p a hidden" test -d "$d4/a/docs/.scrolls"
assert "-p b hidden" test -d "$d4/b/docs/.scrolls"
rm -rf "$d4"

echo
echo "=== Scenario 5: conflicting flags rejected ==="
d5="$(new_scratch_dir)"
new_git_repo "$d5"
out5="$(cd "$d5" && bash "$SCRIPT" -l -t 2>&1)"; code5=$?
assert_exit "$code5" 2 "-l combined with -t exits 2"
assert_match "$out5" "Cannot combine" "-l combined with -t gives a clear error"
rm -rf "$d5"

echo
echo "=== Scenario 6: already-hidden is a clean no-op, not an error ==="
d6="$(new_scratch_dir)"
new_git_repo "$d6"
mkdir -p "$d6/docs/.scrolls"
echo "# STARTER.md" > "$d6/docs/.scrolls/STARTER.md"
out6="$(cd "$d6" && bash "$SCRIPT" 2>&1)"; code6=$?
assert_exit "$code6" 1 "nothing to hide (already hidden) still exits 1 (nothing found)"
assert_match "$out6" "No scrolls folder found" "reports nothing found rather than crashing"
rm -rf "$d6"

echo
echo "=== Scenario 7: round trip with unhide.sh returns to byte-identical content ==="
UNHIDE_SCRIPT="$SKILL_DIR/../scrolls-unhide/scripts/unhide.sh"
if [ -f "$UNHIDE_SCRIPT" ]; then
  d7="$(new_scratch_dir)"
  new_git_repo "$d7"
  mkdir -p "$d7/docs/.scrolls"
  printf '# STARTER.md\nRead docs/.scrolls/SPEC.md first.\n' > "$d7/docs/.scrolls/STARTER.md"
  printf '# Project instructions\nRead docs/.scrolls/STARTER.md first.\n' > "$d7/CLAUDE.md"
  original_starter="$(cat "$d7/docs/.scrolls/STARTER.md")"
  original_claude="$(cat "$d7/CLAUDE.md")"
  ( cd "$d7" && bash "$UNHIDE_SCRIPT" >/dev/null 2>&1 && bash "$SCRIPT" >/dev/null 2>&1 )
  final_starter="$(cat "$d7/docs/.scrolls/STARTER.md")"
  final_claude="$(cat "$d7/CLAUDE.md")"
  assert "round trip: STARTER.md is byte-identical to before unhide+hide" bash -c "[ '$final_starter' = '$original_starter' ]"
  assert "round trip: CLAUDE.md is byte-identical to before unhide+hide" bash -c "[ '$final_claude' = '$original_claude' ]"
  rm -rf "$d7"
else
  echo "SKIP: unhide.sh not present"
fi

echo
echo "=== Scenario 8: an earlier -p root with nothing to hide doesn't abort later roots (regression) ==="
# Real bug caught during this test suite's own development, identical in
# both hide.sh and unhide.sh: handle_match's "[ -f STARTER.md ] || return"
# propagated the failed test's exit status as the function's own return
# code, and under `set -e` a plain function call returning nonzero kills
# the WHOLE SCRIPT -- silently skipping every root after the first one
# with nothing to find. Fixed to "return 0".
d8="$(new_scratch_dir)"
new_git_repo "$d8"
mkdir -p "$d8/empty"
new_visible_scrolls_fixture "$d8" "has-scrolls/docs" "docs/scrolls"
( cd "$d8" && git add -A && git commit -q -m init )
out8="$(cd "$d8" && bash "$SCRIPT" -p empty -p has-scrolls 2>&1)"; code8=$?
assert_exit "$code8" 0 "an empty root before a real one doesn't change the overall exit code"
assert "the SECOND root's scrolls folder still got processed despite the first root having nothing" test -d "$d8/has-scrolls/docs/.scrolls"
rm -rf "$d8"

echo
echo "=== Scenario 9: a coincidentally-named match without STARTER.md doesn't abort a -r sweep (regression) ==="
d9="$(new_scratch_dir)"
new_git_repo "$d9"
mkdir -p "$d9/random/scrolls"
echo "not a real scrolls folder, no STARTER.md" > "$d9/random/scrolls/notes.txt"
new_visible_scrolls_fixture "$d9" "real/docs" "docs/scrolls"
( cd "$d9" && git add -A && git commit -q -m init )
out9="$(cd "$d9" && bash "$SCRIPT" -r 2>&1)"; code9=$?
assert_exit "$code9" 0 "a coincidental non-match earlier in the sweep doesn't change the overall exit code"
assert "the real scrolls folder further into the sweep still got processed" test -d "$d9/real/docs/.scrolls"
assert "the coincidentally-named non-scrolls directory was left alone" test -d "$d9/random/scrolls"
rm -rf "$d9"

echo
echo "=== Results: $((TOTAL - FAILURES))/$TOTAL passed ==="
[ "$FAILURES" -eq 0 ] && exit 0 || exit 1
