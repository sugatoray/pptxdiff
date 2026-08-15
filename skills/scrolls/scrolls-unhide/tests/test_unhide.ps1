#!/usr/bin/env pwsh
# Red/Green regression test for unhide.sh / unhide.ps1 parity.
# Run with: pwsh tests/test_unhide.ps1
#
# Mirrors the scenarios manually verified for unhide.sh during its own
# development: default exact-check, -r sweep, -t/-l, repeatable -p, -p
# pointing directly at a scrolls folder, conflicts, the "already exists"
# skip, and — most importantly — the two real bugs caught along the way:
# (1) absolute-path roots producing references that don't match the
# relative text actually written in STARTER.md/CLAUDE.md, and (2) a
# same-string-prefix sibling package's CLAUDE.md getting wrongly rewritten
# during a recursive sweep. Both are asserted directly, not just implied.
#
# Each scenario runs inside Invoke-Scenario, which catches any unexpected
# terminating error and records it as one failed assertion rather than
# aborting the whole run — so a bug in scenario 3 doesn't hide whether
# scenarios 4-8 pass.

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $Here
$ShScript = Join-Path $SkillDir "scripts/unhide.sh"
$Ps1Script = Join-Path $SkillDir "scripts/unhide.ps1"
$HaveBash = [bool](Get-Command bash -ErrorAction SilentlyContinue)

$script:Total = 0
$script:Failures = 0

function Assert-Match {
    param([string]$Text, [string]$Pattern, [string]$Label)
    $script:Total++
    if ($Text -notmatch $Pattern) {
        $script:Failures++
        Write-Host "FAIL: $Label -- expected to match /$Pattern/" -ForegroundColor Red
        Write-Host "--- actual output ---`n$Text`n---" -ForegroundColor DarkGray
    } else {
        Write-Host "PASS: $Label" -ForegroundColor Green
    }
}

function Assert-NotMatch {
    param([string]$Text, [string]$Pattern, [string]$Label)
    $script:Total++
    if ($Text -match $Pattern) {
        $script:Failures++
        Write-Host "FAIL: $Label -- expected NOT to match /$Pattern/" -ForegroundColor Red
        Write-Host "--- actual output ---`n$Text`n---" -ForegroundColor DarkGray
    } else {
        Write-Host "PASS: $Label" -ForegroundColor Green
    }
}

function Assert-True {
    param([bool]$Condition, [string]$Label)
    $script:Total++
    if (-not $Condition) {
        $script:Failures++
        Write-Host "FAIL: $Label" -ForegroundColor Red
    } else {
        Write-Host "PASS: $Label" -ForegroundColor Green
    }
}

function Assert-ExitCode {
    param([int]$Actual, [int]$Expected, [string]$Label)
    $script:Total++
    if ($Actual -ne $Expected) {
        $script:Failures++
        Write-Host "FAIL: $Label -- expected exit $Expected, got $Actual" -ForegroundColor Red
    } else {
        Write-Host "PASS: $Label" -ForegroundColor Green
    }
}

function Invoke-Scenario {
    param([string]$Name, [scriptblock]$Body)
    Write-Host "`n=== $Name ===" -ForegroundColor Cyan
    try {
        & $Body
    } catch {
        $script:Total++
        $script:Failures++
        Write-Host "FAIL: $Name -- unexpected error: $_" -ForegroundColor Red
    }
}

function New-ScratchDir {
    $dir = Join-Path ([System.IO.Path]::GetTempPath()) ("scrolls-unhide-test-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $dir | Out-Null
    return $dir
}

function New-GitRepo {
    param([string]$Dir)
    Push-Location $Dir
    try {
        & git init -q
        & git config user.email "test@test.com"
        & git config user.name "test"
    } finally { Pop-Location }
}

function Invoke-Ps1 {
    param([string]$Dir, [string[]]$ScriptArgs = @())
    Push-Location $Dir
    try {
        $out = & pwsh -NoProfile -File $Ps1Script @ScriptArgs 2>&1 | Out-String
        return @{ Output = $out; ExitCode = $LASTEXITCODE }
    } finally { Pop-Location }
}

function Invoke-Sh {
    param([string]$Dir, [string[]]$ScriptArgs = @())
    Push-Location $Dir
    try {
        $out = & bash $ShScript @ScriptArgs 2>&1 | Out-String
        return @{ Output = $out; ExitCode = $LASTEXITCODE }
    } finally { Pop-Location }
}

function New-ScrollsFixture {
    param([string]$Base, [string]$RelDocsDir, [string]$RefForm)
    # RelDocsDir e.g. "docs" or "packages/api/docs"; RefForm is what STARTER.md
    # and CLAUDE.md reference internally ("docs/.scrolls", matching the
    # short-form convention scrolls-setup writes for -t/-l/default).
    $scrollsPath = Join-Path $Base "$RelDocsDir/.scrolls"
    New-Item -ItemType Directory -Path $scrollsPath -Force | Out-Null
    Set-Content -Path (Join-Path $scrollsPath "STARTER.md") -Value "# STARTER.md`nRead $RefForm/SPEC.md first."
    $baseOfDocs = Split-Path -Parent (Join-Path $Base $RelDocsDir)
    Set-Content -Path (Join-Path $baseOfDocs "CLAUDE.md") -Value "# Project instructions`nRead $RefForm/STARTER.md first."
}

# ============================================================

Invoke-Scenario "Scenario 1: default (exact-check) unhides docs/.scrolls at cwd" {
    $d1 = New-ScratchDir
    New-GitRepo $d1
    New-ScrollsFixture -Base $d1 -RelDocsDir "docs" -RefForm "docs/.scrolls"
    Push-Location $d1; & git add -A; & git commit -q -m init; Pop-Location

    Invoke-Ps1 $d1 @() | Out-Null
    Assert-True (Test-Path (Join-Path $d1 "docs/scrolls")) "ps1: docs/scrolls exists after unhide"
    Assert-True (-not (Test-Path (Join-Path $d1 "docs/.scrolls"))) "ps1: docs/.scrolls no longer exists"
    $starterContent1 = Get-Content (Join-Path $d1 "docs/scrolls/STARTER.md") -Raw
    Assert-Match $starterContent1 "docs/scrolls/SPEC\.md" "ps1: STARTER.md self-reference rewritten to docs/scrolls"
    $claudeContent1 = Get-Content (Join-Path $d1 "CLAUDE.md") -Raw
    Assert-Match $claudeContent1 "docs/scrolls/STARTER\.md" "ps1: CLAUDE.md reference rewritten to docs/scrolls"
    Remove-Item -Recurse -Force $d1
}

Invoke-Scenario "Scenario 2: exact-check finds nothing from a subdirectory; -t finds it via the SHORT reference form" {
    $d2 = New-ScratchDir
    New-GitRepo $d2
    New-ScrollsFixture -Base $d2 -RelDocsDir "docs" -RefForm "docs/.scrolls"
    New-Item -ItemType Directory -Path (Join-Path $d2 "foo/bar") -Force | Out-Null
    Push-Location $d2; & git add -A; & git commit -q -m init; Pop-Location

    $r2 = Invoke-Ps1 (Join-Path $d2 "foo/bar") @()
    Assert-ExitCode $r2.ExitCode 1 "ps1: exits 1 (not found) from subdirectory without -t"
    Assert-Match $r2.Output "scrolls-setup" "ps1: not-found message points at /scrolls-setup"

    Invoke-Ps1 (Join-Path $d2 "foo/bar") @("-t") | Out-Null
    Assert-True (Test-Path (Join-Path $d2 "docs/scrolls")) "ps1 -t: docs/scrolls exists at repo root after unhide from subdirectory"
    $starterContent2 = (Get-Content (Join-Path $d2 "docs/scrolls/STARTER.md") -Raw).Trim()
    Assert-Match $starterContent2 "^# STARTER\.md\nRead docs/scrolls/SPEC\.md first\.$" "ps1 -t: STARTER.md rewritten to the SHORT form (docs/scrolls), not an absolute path"
    Assert-NotMatch $starterContent2 ([regex]::Escape($d2)) "ps1 -t: STARTER.md does NOT contain the absolute scratch-dir path (would be a portability bug)"
    $claudeContent2 = Get-Content (Join-Path $d2 "CLAUDE.md") -Raw
    Assert-Match $claudeContent2 "docs/scrolls/STARTER\.md" "ps1 -t: CLAUDE.md rewritten to the short form too"
    Remove-Item -Recurse -Force $d2
}

Invoke-Scenario "Scenario 3: -r sweep finds a nested package without cross-contaminating its sibling's CLAUDE.md" {
    $d3 = New-ScratchDir
    New-GitRepo $d3
    New-ScrollsFixture -Base $d3 -RelDocsDir "docs" -RefForm "docs/.scrolls"
    New-ScrollsFixture -Base $d3 -RelDocsDir "packages/api/docs" -RefForm "docs/.scrolls"
    Push-Location $d3; & git add -A; & git commit -q -m init; Pop-Location

    Invoke-Ps1 $d3 @("-r") | Out-Null
    Assert-True (Test-Path (Join-Path $d3 "docs/scrolls")) "ps1 -r: root scrolls folder unhidden"
    Assert-True (Test-Path (Join-Path $d3 "packages/api/docs/scrolls")) "ps1 -r: nested package scrolls folder unhidden too"
    $rootClaude3 = Get-Content (Join-Path $d3 "CLAUDE.md") -Raw
    Assert-Match $rootClaude3 "docs/scrolls/STARTER\.md" "ps1 -r: root CLAUDE.md correctly rewritten"
    $pkgClaude3 = Get-Content (Join-Path $d3 "packages/api/CLAUDE.md") -Raw
    Assert-Match $pkgClaude3 "docs/scrolls/STARTER\.md" "ps1 -r: package CLAUDE.md correctly rewritten to its OWN short form"
    Assert-NotMatch $rootClaude3 "\.scrolls" "ps1 -r: root CLAUDE.md has no leftover .scrolls reference"
    Assert-NotMatch $pkgClaude3 "\.scrolls" "ps1 -r: package CLAUDE.md has no leftover .scrolls reference"
    Remove-Item -Recurse -Force $d3
}

Invoke-Scenario "Scenario 4: repeatable -p targets two explicit locations in one run" {
    $d4 = New-ScratchDir
    New-GitRepo $d4
    New-ScrollsFixture -Base $d4 -RelDocsDir "a/docs" -RefForm "docs/.scrolls"
    New-ScrollsFixture -Base $d4 -RelDocsDir "b/docs" -RefForm "docs/.scrolls"
    Push-Location $d4; & git add -A; & git commit -q -m init; Pop-Location

    Invoke-Ps1 $d4 @("-p", "a", "-p", "b") | Out-Null
    Assert-True (Test-Path (Join-Path $d4 "a/docs/scrolls")) "ps1: -p a unhidden"
    Assert-True (Test-Path (Join-Path $d4 "b/docs/scrolls")) "ps1: -p b unhidden"
    Remove-Item -Recurse -Force $d4
}

Invoke-Scenario "Scenario 5: -p pointing directly at the scrolls folder itself" {
    $d5 = New-ScratchDir
    New-GitRepo $d5
    New-ScrollsFixture -Base $d5 -RelDocsDir "docs" -RefForm "docs/.scrolls"
    Push-Location $d5; & git add -A; & git commit -q -m init; Pop-Location

    Invoke-Ps1 $d5 @("-p", "docs/.scrolls") | Out-Null
    Assert-True (Test-Path (Join-Path $d5 "docs/scrolls")) "ps1: -p pointing directly at the folder works"
    Remove-Item -Recurse -Force $d5
}

Invoke-Scenario "Scenario 6: conflicting flags rejected" {
    $d6 = New-ScratchDir
    New-GitRepo $d6
    $r6 = Invoke-Ps1 $d6 @("-p", "x", "-t")
    Assert-ExitCode $r6.ExitCode 2 "ps1: -p combined with -t exits 2"
    Assert-Match $r6.Output "Cannot combine" "ps1: -p combined with -t gives a clear error"
    Remove-Item -Recurse -Force $d6
}

Invoke-Scenario "Scenario 7: -t outside a git repository errors clearly" {
    $d7 = New-ScratchDir
    $r7 = Invoke-Ps1 $d7 @("-t")
    Assert-ExitCode $r7.ExitCode 2 "ps1: -t outside git repo exits 2"
    Assert-Match $r7.Output "requires being inside a git repository" "ps1: -t outside git repo gives a clear error"
    Remove-Item -Recurse -Force $d7
}

Invoke-Scenario "Scenario 8: already-unhidden is a clean no-op, not an error" {
    $d8 = New-ScratchDir
    New-GitRepo $d8
    New-Item -ItemType Directory -Path (Join-Path $d8 "docs/scrolls") -Force | Out-Null
    Set-Content -Path (Join-Path $d8 "docs/scrolls/STARTER.md") -Value "# STARTER.md"
    $r8 = Invoke-Ps1 $d8 @()
    Assert-ExitCode $r8.ExitCode 1 "ps1: nothing to unhide (already visible) still exits 1 (nothing found)"
    Assert-Match $r8.Output "No \.scrolls folder found" "ps1: reports nothing found rather than crashing"
    Remove-Item -Recurse -Force $d8
}

if ($HaveBash) {
    Invoke-Scenario "Parity: scenario 2 (subdirectory + -t, short-form rewrite)" {
        $dp = New-ScratchDir
        New-GitRepo $dp
        New-ScrollsFixture -Base $dp -RelDocsDir "docs" -RefForm "docs/.scrolls"
        New-Item -ItemType Directory -Path (Join-Path $dp "foo/bar") -Force | Out-Null
        Push-Location $dp; & git add -A; & git commit -q -m init; Pop-Location
        Invoke-Sh (Join-Path $dp "foo/bar") @("-t") | Out-Null
        Assert-True (Test-Path (Join-Path $dp "docs/scrolls")) "sh -t: docs/scrolls exists at repo root after unhide from subdirectory"
        $starterContentP = Get-Content (Join-Path $dp "docs/scrolls/STARTER.md") -Raw
        Assert-Match $starterContentP "docs/scrolls/SPEC\.md" "sh -t: STARTER.md rewritten to the SHORT form"
        Remove-Item -Recurse -Force $dp
    }

    Invoke-Scenario "Parity: scenario 3 (recursive sweep, no cross-contamination)" {
        $dq = New-ScratchDir
        New-GitRepo $dq
        New-ScrollsFixture -Base $dq -RelDocsDir "docs" -RefForm "docs/.scrolls"
        New-ScrollsFixture -Base $dq -RelDocsDir "packages/api/docs" -RefForm "docs/.scrolls"
        Push-Location $dq; & git add -A; & git commit -q -m init; Pop-Location
        Invoke-Sh $dq @("-r") | Out-Null
        Assert-True (Test-Path (Join-Path $dq "docs/scrolls")) "sh -r: root scrolls folder unhidden"
        Assert-True (Test-Path (Join-Path $dq "packages/api/docs/scrolls")) "sh -r: nested package scrolls folder unhidden too"
        $pkgClaudeQ = Get-Content (Join-Path $dq "packages/api/CLAUDE.md") -Raw
        Assert-NotMatch $pkgClaudeQ "\.scrolls" "sh -r: package CLAUDE.md has no leftover .scrolls reference"
        Remove-Item -Recurse -Force $dq
    }
}

Write-Host "`n=== Results: $($script:Total - $script:Failures)/$($script:Total) passed ===" -ForegroundColor $(if ($script:Failures -eq 0) { "Green" } else { "Red" })
if (-not $HaveBash) {
    Write-Host "(bash not found on PATH — parity spot-checks skipped)" -ForegroundColor Yellow
}
if ($script:Failures -gt 0) { exit 1 } else { exit 0 }
