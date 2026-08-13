#!/usr/bin/env bash
# Red/Green regression test for open_help.sh, in bash (no PowerShell
# needed to run this — see test_open_help.ps1 for the parity harness
# that also cross-checks this script from the pwsh side).
# Run with: bash tests/test_open_help.sh
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$HERE")"
SCRIPT="$SKILL_DIR/scripts/open_help.sh"

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

assert_eq() {
  local actual="$1" expected="$2" label="$3"
  if [ "$actual" = "$expected" ]; then pass "$label"; else fail "$label -- expected '$expected', got '$actual'"; fi
}

stop_reported_server() {
  local output="$1" pid
  pid="$(printf '%s' "$output" | grep -oE 'pid [0-9]+' | grep -oE '[0-9]+')"
  if [ -n "$pid" ]; then
    kill "$pid" 2>/dev/null || true
  fi
  printf '%s' "$pid"
}

# ============================================================

echo
echo "=== Scenario 1: launcher reports a working URL and PID ==="
out1="$(bash "$SCRIPT" 2>&1)"
assert_match "$out1" '^https?://127\.0\.0\.1:[0-9]+/' "first line is a localhost URL"
assert_match "$out1" 'pid [0-9]+' "reports a PID"

url1="$(printf '%s' "$out1" | grep -oE 'https?://127\.0\.0\.1:[0-9]+/' | head -n1)"
if [ -n "$url1" ]; then
  sleep 0.3
  status="$(curl -s -o /tmp/open_help_test_body.html -w '%{http_code}' "$url1" 2>/dev/null || echo "000")"
  assert_eq "$status" "200" "server responds 200 to a real HTTP request"
  body="$(cat /tmp/open_help_test_body.html 2>/dev/null || echo "")"
  assert_match "$body" "Scrolls" "served page contains expected title text"
  assert_match "$body" "<html" "served page looks like real HTML"
  rm -f /tmp/open_help_test_body.html
fi

pid1="$(stop_reported_server "$out1")"
if [ -n "$pid1" ]; then
  sleep 0.5
  # Get-Process-equivalent process-table checks are unreliable in this
  # sandbox (a killed, reparented process goes zombie/defunct and lingers
  # until this container's init reaps it -- confirmed identical for the
  # PowerShell launcher too during its own test development, so it's an
  # environment characteristic, not a script bug). What actually matters
  # -- the server no longer answers requests -- is meaningful regardless.
  still_reachable="no"
  if curl -s -o /dev/null -m 2 "$url1" 2>/dev/null; then
    still_reachable="yes"
  fi
  assert_eq "$still_reachable" "no" "server no longer answers requests after being stopped"
fi

echo
echo "=== Scenario 2: each invocation gets its own port (no collision on repeat runs) ==="
out2a="$(bash "$SCRIPT" 2>&1)"
out2b="$(bash "$SCRIPT" 2>&1)"
url2a="$(printf '%s' "$out2a" | grep -oE 'https?://127\.0\.0\.1:[0-9]+/' | head -n1)"
url2b="$(printf '%s' "$out2b" | grep -oE 'https?://127\.0\.0\.1:[0-9]+/' | head -n1)"
if [ -n "$url2a" ] && [ -n "$url2b" ] && [ "$url2a" != "$url2b" ]; then
  pass "two runs get two different ports"
else
  fail "two runs get two different ports -- got '$url2a' and '$url2b'"
fi
stop_reported_server "$out2a" >/dev/null
stop_reported_server "$out2b" >/dev/null

echo
echo "=== Results: $((TOTAL - FAILURES))/$TOTAL passed ==="
[ "$FAILURES" -eq 0 ] && exit 0 || exit 1
