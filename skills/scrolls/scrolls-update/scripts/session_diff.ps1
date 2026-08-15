#!/usr/bin/env pwsh
# Summarizes what changed since docs/.scrolls/ was last updated, as evidence
# for /scrolls-update. Conversation context is the primary source of truth;
# this is a cross-check for when that context is thin, compacted, or the
# scrolls are being updated for work done outside the current conversation.
#
# PowerShell port of session_diff.sh — same behavior, same section headers,
# same exit codes (0 = report shown or nothing to compare against yet,
# 1 = no scrolls dir found at all). Cross-platform: runs under pwsh on
# Windows, macOS, or Linux, so this is the counterpart used when bash isn't
# available (native Windows without WSL/Git Bash).
param(
    [string]$ScrollsDir = "docs/.scrolls"
)

$ErrorActionPreference = "Stop"

function Test-InsideGitWorkTree {
    & git rev-parse --is-inside-work-tree *>$null
    return $LASTEXITCODE -eq 0
}

if (-not (Test-InsideGitWorkTree)) {
    Write-Host "Not a git repository — no commit history to inspect. Rely on conversation context only."
    exit 0
}

if (-not (Test-Path -LiteralPath $ScrollsDir -PathType Container)) {
    Write-Host "No $ScrollsDir directory found here. Run /scrolls-setup first — there's nothing to update yet."
    exit 1
}

Write-Host "== Uncommitted changes (working tree vs HEAD) =="
& git status --short

$LastCommit = (& git log -1 --format=%H -- $ScrollsDir 2>$null)
if ($LASTEXITCODE -ne 0) { $LastCommit = "" }

if ([string]::IsNullOrWhiteSpace($LastCommit)) {
    Write-Host ""
    Write-Host "== $ScrollsDir has no commit history yet — nothing to diff against. =="
    Write-Host "Treat this as the first update since setup; describe the session from context alone."
    exit 0
}

Write-Host ""
Write-Host "== $ScrollsDir was last touched at commit $LastCommit =="
& git log -1 --format="%h %ad %s" --date=short $LastCommit

Write-Host ""
Write-Host "== Commits since then =="
$commitsSince = & git log --oneline "$LastCommit..HEAD" 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($commitsSince)) {
    Write-Host "(none — HEAD hasn't moved since)"
} else {
    $commitsSince | ForEach-Object { Write-Host $_ }
}

Write-Host ""
Write-Host "== Files changed since then, excluding $ScrollsDir itself =="
$diffStat = & git diff --stat "$LastCommit..HEAD" -- . ":(exclude)$ScrollsDir/*" 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($diffStat)) {
    Write-Host "(no diff available)"
} else {
    $diffStat | ForEach-Object { Write-Host $_ }
}
