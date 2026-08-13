#!/usr/bin/env pwsh
# Red/Green regression test for session_diff.sh / session_diff.ps1 parity.
# Run with: pwsh tests/test_session_diff.ps1
#
# Builds scratch git fixtures covering each behavioral branch, runs BOTH
# implementations (bash on macOS/Linux, PowerShell on any platform) against
# them, and asserts each produces the same key signals — not byte-identical
# output (bash/PowerShell format differently), but the same section
# headers, decisions, and exit codes. The bash script's already-proven
# behavior is the spec the PowerShell port must match; skips the bash side
# entirely if bash isn't on PATH (e.g. a Windows-only CI runner) rather
# than failing — that half of the parity check just doesn't apply there.
$ErrorActionPreference = "Stop"

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $Here
$ShScript = Join-Path $SkillDir "scripts/session_diff.sh"
$Ps1Script = Join-Path $SkillDir "scripts/session_diff.ps1"
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

function New-ScratchDir {
    $dir = Join-Path ([System.IO.Path]::GetTempPath()) ("scrolls-update-test-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $dir | Out-Null
    return $dir
}

function Invoke-Sh {
    param([string]$Dir, [string[]]$Args)
    Push-Location $Dir
    try {
        $out = & bash $ShScript @Args 2>&1 | Out-String
        return @{ Output = $out; ExitCode = $LASTEXITCODE }
    } finally { Pop-Location }
}

function Invoke-Ps1 {
    param([string]$Dir, [string[]]$Args)
    Push-Location $Dir
    try {
        $out = & pwsh -NoProfile -File $Ps1Script @Args 2>&1 | Out-String
        return @{ Output = $out; ExitCode = $LASTEXITCODE }
    } finally { Pop-Location }
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

Write-Host "`n=== Scenario A: not a git repository ===" -ForegroundColor Cyan
$dirA = New-ScratchDir
$resPs1A = Invoke-Ps1 $dirA @()
Assert-Match $resPs1A.Output "Not a git repository" "ps1: reports not-a-git-repo"
Assert-ExitCode $resPs1A.ExitCode 0 "ps1: exits 0 on not-a-git-repo"
if ($HaveBash) {
    $resShA = Invoke-Sh $dirA @()
    Assert-Match $resShA.Output "Not a git repository" "sh: reports not-a-git-repo"
    Assert-ExitCode $resShA.ExitCode 0 "sh: exits 0 on not-a-git-repo"
}
Remove-Item -Recurse -Force $dirA

Write-Host "`n=== Scenario B: git repo, no scrolls dir ===" -ForegroundColor Cyan
$dirB = New-ScratchDir
New-GitRepo $dirB
$resPs1B = Invoke-Ps1 $dirB @()
Assert-Match $resPs1B.Output "scrolls-setup" "ps1: points at /scrolls-setup when nothing found"
Assert-ExitCode $resPs1B.ExitCode 1 "ps1: exits 1 when nothing found"
if ($HaveBash) {
    $resShB = Invoke-Sh $dirB @()
    Assert-Match $resShB.Output "scrolls-setup" "sh: points at /scrolls-setup when nothing found"
    Assert-ExitCode $resShB.ExitCode 1 "sh: exits 1 when nothing found"
}
Remove-Item -Recurse -Force $dirB

Write-Host "`n=== Scenario C: scrolls dir exists, never committed ===" -ForegroundColor Cyan
$dirC = New-ScratchDir
New-GitRepo $dirC
New-Item -ItemType Directory -Path (Join-Path $dirC "docs/.scrolls") -Force | Out-Null
Set-Content -Path (Join-Path $dirC "docs/.scrolls/STARTER.md") -Value "# STARTER"
$resPs1C = Invoke-Ps1 $dirC @()
Assert-Match $resPs1C.Output "no commit history yet" "ps1: reports no commit history for uncommitted scrolls dir"
Assert-ExitCode $resPs1C.ExitCode 0 "ps1: exits 0 when scrolls dir has no history"
if ($HaveBash) {
    $resShC = Invoke-Sh $dirC @()
    Assert-Match $resShC.Output "no commit history yet" "sh: reports no commit history for uncommitted scrolls dir"
    Assert-ExitCode $resShC.ExitCode 0 "sh: exits 0 when scrolls dir has no history"
}
Remove-Item -Recurse -Force $dirC

Write-Host "`n=== Scenario D: scrolls committed, then more commits + uncommitted change ===" -ForegroundColor Cyan
$dirD = New-ScratchDir
New-GitRepo $dirD
New-Item -ItemType Directory -Path (Join-Path $dirD "docs/.scrolls") -Force | Out-Null
Set-Content -Path (Join-Path $dirD "docs/.scrolls/STARTER.md") -Value "# STARTER"
Push-Location $dirD
& git add -A; & git commit -q -m "init scrolls"
Set-Content -Path (Join-Path $dirD "app.js") -Value "console.log(1)"
& git add -A; & git commit -q -m "add app.js"
Set-Content -Path (Join-Path $dirD "README.md") -Value "uncommitted change"
Pop-Location
$resPs1D = Invoke-Ps1 $dirD @()
Assert-Match $resPs1D.Output "Uncommitted changes" "ps1: shows uncommitted-changes section"
Assert-Match $resPs1D.Output "README\.md" "ps1: lists the actual uncommitted file"
Assert-Match $resPs1D.Output "was last touched at commit" "ps1: shows last-touched-commit section"
Assert-Match $resPs1D.Output "add app\.js" "ps1: lists the commit made after the scrolls dir"
Assert-Match $resPs1D.Output "app\.js" "ps1: lists app.js in the changed-files stat"
Assert-ExitCode $resPs1D.ExitCode 0 "ps1: exits 0 on the full-report path"
if ($HaveBash) {
    $resShD = Invoke-Sh $dirD @()
    Assert-Match $resShD.Output "Uncommitted changes" "sh: shows uncommitted-changes section"
    Assert-Match $resShD.Output "README\.md" "sh: lists the actual uncommitted file"
    Assert-Match $resShD.Output "was last touched at commit" "sh: shows last-touched-commit section"
    Assert-Match $resShD.Output "add app\.js" "sh: lists the commit made after the scrolls dir"
    Assert-Match $resShD.Output "app\.js" "sh: lists app.js in the changed-files stat"
    Assert-ExitCode $resShD.ExitCode 0 "sh: exits 0 on the full-report path"
}
Remove-Item -Recurse -Force $dirD

Write-Host "`n=== Results: $($script:Total - $script:Failures)/$($script:Total) passed ===" -ForegroundColor $(if ($script:Failures -eq 0) { "Green" } else { "Red" })
if (-not $HaveBash) {
    Write-Host "(bash not found on PATH — only the PowerShell side was exercised)" -ForegroundColor Yellow
}
if ($script:Failures -gt 0) { exit 1 } else { exit 0 }
