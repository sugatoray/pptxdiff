#!/usr/bin/env pwsh
# Red/Green regression test for hide.sh / hide.ps1 parity.
# Run with: pwsh tests/test_hide.ps1
# Mirror of scrolls-unhide/tests/test_unhide.ps1, opposite direction —
# see that file for the full scenario rationale (including the two real
# bugs found during the bash version's own development, guarded here too).

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $Here
$ShScript = Join-Path $SkillDir "scripts/hide.sh"
$Ps1Script = Join-Path $SkillDir "scripts/hide.ps1"
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
    $dir = Join-Path ([System.IO.Path]::GetTempPath()) ("scrolls-hide-test-" + [guid]::NewGuid().ToString("N"))
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

function New-VisibleScrollsFixture {
    param([string]$Base, [string]$RelDocsDir, [string]$RefForm)
    # Opposite of unhide's fixture: starts VISIBLE ("scrolls", no dot).
    $scrollsPath = Join-Path $Base "$RelDocsDir/scrolls"
    New-Item -ItemType Directory -Path $scrollsPath -Force | Out-Null
    Set-Content -Path (Join-Path $scrollsPath "STARTER.md") -Value "# STARTER.md`nRead $RefForm/SPEC.md first."
    $baseOfDocs = Split-Path -Parent (Join-Path $Base $RelDocsDir)
    Set-Content -Path (Join-Path $baseOfDocs "CLAUDE.md") -Value "# Project instructions`nRead $RefForm/STARTER.md first."
}

# ============================================================

Invoke-Scenario "Scenario 1: default (exact-check) hides docs/scrolls at cwd" {
    $d1 = New-ScratchDir
    New-GitRepo $d1
    New-VisibleScrollsFixture -Base $d1 -RelDocsDir "docs" -RefForm "docs/scrolls"
    Push-Location $d1; & git add -A; & git commit -q -m init; Pop-Location

    Invoke-Ps1 $d1 @() | Out-Null
    Assert-True (Test-Path (Join-Path $d1 "docs/.scrolls")) "ps1: docs/.scrolls exists after hide"
    Assert-True (-not (Test-Path (Join-Path $d1 "docs/scrolls"))) "ps1: docs/scrolls no longer exists"
    $starterContent1 = Get-Content (Join-Path $d1 "docs/.scrolls/STARTER.md") -Raw
    Assert-Match $starterContent1 "docs/\.scrolls/SPEC\.md" "ps1: STARTER.md self-reference rewritten to docs/.scrolls"
    $claudeContent1 = Get-Content (Join-Path $d1 "CLAUDE.md") -Raw
    Assert-Match $claudeContent1 "docs/\.scrolls/STARTER\.md" "ps1: CLAUDE.md reference rewritten to docs/.scrolls"
    Remove-Item -Recurse -Force $d1
}

Invoke-Scenario "Scenario 2: exact-check finds nothing from a subdirectory; -t finds it via the SHORT reference form" {
    $d2 = New-ScratchDir
    New-GitRepo $d2
    New-VisibleScrollsFixture -Base $d2 -RelDocsDir "docs" -RefForm "docs/scrolls"
    New-Item -ItemType Directory -Path (Join-Path $d2 "foo/bar") -Force | Out-Null
    Push-Location $d2; & git add -A; & git commit -q -m init; Pop-Location

    $r2 = Invoke-Ps1 (Join-Path $d2 "foo/bar") @()
    Assert-ExitCode $r2.ExitCode 1 "ps1: exits 1 (not found) from subdirectory without -t"

    Invoke-Ps1 (Join-Path $d2 "foo/bar") @("-t") | Out-Null
    Assert-True (Test-Path (Join-Path $d2 "docs/.scrolls")) "ps1 -t: docs/.scrolls exists at repo root after hide from subdirectory"
    $starterContent2 = (Get-Content (Join-Path $d2 "docs/.scrolls/STARTER.md") -Raw).Trim()
    Assert-Match $starterContent2 "^# STARTER\.md\nRead docs/\.scrolls/SPEC\.md first\.$" "ps1 -t: STARTER.md rewritten to the SHORT form, not an absolute path"
    Assert-NotMatch $starterContent2 ([regex]::Escape($d2)) "ps1 -t: STARTER.md does NOT contain the absolute scratch-dir path"
    Remove-Item -Recurse -Force $d2
}

Invoke-Scenario "Scenario 3: -r sweep finds a nested package without cross-contaminating its sibling's CLAUDE.md" {
    $d3 = New-ScratchDir
    New-GitRepo $d3
    New-VisibleScrollsFixture -Base $d3 -RelDocsDir "docs" -RefForm "docs/scrolls"
    New-VisibleScrollsFixture -Base $d3 -RelDocsDir "packages/api/docs" -RefForm "docs/scrolls"
    Push-Location $d3; & git add -A; & git commit -q -m init; Pop-Location

    Invoke-Ps1 $d3 @("-r") | Out-Null
    Assert-True (Test-Path (Join-Path $d3 "docs/.scrolls")) "ps1 -r: root scrolls folder hidden"
    Assert-True (Test-Path (Join-Path $d3 "packages/api/docs/.scrolls")) "ps1 -r: nested package scrolls folder hidden too"
    $rootClaude3 = Get-Content (Join-Path $d3 "CLAUDE.md") -Raw
    $pkgClaude3 = Get-Content (Join-Path $d3 "packages/api/CLAUDE.md") -Raw
    Assert-Match $rootClaude3 "docs/\.scrolls/STARTER\.md" "ps1 -r: root CLAUDE.md correctly rewritten"
    Assert-Match $pkgClaude3 "docs/\.scrolls/STARTER\.md" "ps1 -r: package CLAUDE.md correctly rewritten to its OWN short form"
    Remove-Item -Recurse -Force $d3
}

Invoke-Scenario "Scenario 4: repeatable -p targets two explicit locations in one run" {
    $d4 = New-ScratchDir
    New-GitRepo $d4
    New-VisibleScrollsFixture -Base $d4 -RelDocsDir "a/docs" -RefForm "docs/scrolls"
    New-VisibleScrollsFixture -Base $d4 -RelDocsDir "b/docs" -RefForm "docs/scrolls"
    Push-Location $d4; & git add -A; & git commit -q -m init; Pop-Location

    Invoke-Ps1 $d4 @("-p", "a", "-p", "b") | Out-Null
    Assert-True (Test-Path (Join-Path $d4 "a/docs/.scrolls")) "ps1: -p a hidden"
    Assert-True (Test-Path (Join-Path $d4 "b/docs/.scrolls")) "ps1: -p b hidden"
    Remove-Item -Recurse -Force $d4
}

Invoke-Scenario "Scenario 5: conflicting flags rejected" {
    $d5 = New-ScratchDir
    New-GitRepo $d5
    $r5 = Invoke-Ps1 $d5 @("-l", "-t")
    Assert-ExitCode $r5.ExitCode 2 "ps1: -l combined with -t exits 2"
    Assert-Match $r5.Output "Cannot combine" "ps1: -l combined with -t gives a clear error"
    Remove-Item -Recurse -Force $d5
}

Invoke-Scenario "Scenario 6: already-hidden is a clean no-op, not an error" {
    $d6 = New-ScratchDir
    New-GitRepo $d6
    New-Item -ItemType Directory -Path (Join-Path $d6 "docs/.scrolls") -Force | Out-Null
    Set-Content -Path (Join-Path $d6 "docs/.scrolls/STARTER.md") -Value "# STARTER.md"
    $r6 = Invoke-Ps1 $d6 @()
    Assert-ExitCode $r6.ExitCode 1 "ps1: nothing to hide (already hidden) still exits 1 (nothing found)"
    Assert-Match $r6.Output "No scrolls folder found" "ps1: reports nothing found rather than crashing"
    Remove-Item -Recurse -Force $d6
}

Invoke-Scenario "Scenario 7: round trip with unhide.ps1 returns to byte-identical content" {
    $unhideScript = Join-Path $SkillDir "../scrolls-unhide/scripts/unhide.ps1"
    if (-not (Test-Path $unhideScript)) {
        Write-Host "SKIP: unhide.ps1 not present yet" -ForegroundColor Yellow
        return
    }
    $d7 = New-ScratchDir
    New-GitRepo $d7
    New-Item -ItemType Directory -Path (Join-Path $d7 "docs/.scrolls") -Force | Out-Null
    Set-Content -Path (Join-Path $d7 "docs/.scrolls/STARTER.md") -Value "# STARTER.md`nRead docs/.scrolls/SPEC.md first."
    Set-Content -Path (Join-Path $d7 "CLAUDE.md") -Value "# Project instructions`nRead docs/.scrolls/STARTER.md first."
    $originalStarter = Get-Content (Join-Path $d7 "docs/.scrolls/STARTER.md") -Raw
    $originalClaude = Get-Content (Join-Path $d7 "CLAUDE.md") -Raw

    Push-Location $d7
    & pwsh -NoProfile -File $unhideScript | Out-Null
    & pwsh -NoProfile -File $Ps1Script | Out-Null
    Pop-Location

    $finalStarter = Get-Content (Join-Path $d7 "docs/.scrolls/STARTER.md") -Raw
    $finalClaude = Get-Content (Join-Path $d7 "CLAUDE.md") -Raw
    Assert-True ($finalStarter -eq $originalStarter) "ps1 round trip: STARTER.md is byte-identical to before unhide+hide"
    Assert-True ($finalClaude -eq $originalClaude) "ps1 round trip: CLAUDE.md is byte-identical to before unhide+hide"
    Remove-Item -Recurse -Force $d7
}

if ($HaveBash) {
    Invoke-Scenario "Parity: scenario 3 (recursive sweep, no cross-contamination)" {
        $dq = New-ScratchDir
        New-GitRepo $dq
        New-VisibleScrollsFixture -Base $dq -RelDocsDir "docs" -RefForm "docs/scrolls"
        New-VisibleScrollsFixture -Base $dq -RelDocsDir "packages/api/docs" -RefForm "docs/scrolls"
        Push-Location $dq; & git add -A; & git commit -q -m init; Pop-Location
        Invoke-Sh $dq @("-r") | Out-Null
        Assert-True (Test-Path (Join-Path $dq "docs/.scrolls")) "sh -r: root scrolls folder hidden"
        Assert-True (Test-Path (Join-Path $dq "packages/api/docs/.scrolls")) "sh -r: nested package scrolls folder hidden too"
        $pkgClaudeQ = Get-Content (Join-Path $dq "packages/api/CLAUDE.md") -Raw
        Assert-NotMatch $pkgClaudeQ "(?<!\.)scrolls/STARTER" "sh -r: package CLAUDE.md wasn't wrongly double-processed"
        Remove-Item -Recurse -Force $dq
    }
}

Write-Host "`n=== Results: $($script:Total - $script:Failures)/$($script:Total) passed ===" -ForegroundColor $(if ($script:Failures -eq 0) { "Green" } else { "Red" })
if (-not $HaveBash) {
    Write-Host "(bash not found on PATH -- parity spot-check skipped)" -ForegroundColor Yellow
}
if ($script:Failures -gt 0) { exit 1 } else { exit 0 }
