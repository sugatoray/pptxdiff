#!/usr/bin/env pwsh
# Red/Green regression test for open_help.sh / open_help.ps1 parity.
# Run with: pwsh tests/test_open_help.ps1
#
# serve_help.py itself is pure-stdlib Python and already cross-platform —
# nothing to port there. What needs verifying is the *launcher*: does it
# correctly start the server detached, wait for it to actually confirm
# it's listening (not a fixed guessed delay), report a working URL, and
# leave a PID the caller can use to stop it. Exercises the real server
# over a real HTTP request, not just "did some output appear."

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $Here
$Ps1Script = Join-Path $SkillDir "scripts/open_help.ps1"
$ShScript = Join-Path $SkillDir "scripts/open_help.sh"
$HaveBash = [bool](Get-Command bash -ErrorAction SilentlyContinue)

$script:Total = 0
$script:Failures = 0
$script:PidsToClean = New-Object System.Collections.Generic.List[int]

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

function Stop-ReportedServer {
    param([string]$Output)
    if ($Output -match 'pid (\d+)') {
        $procId = [int]$Matches[1]
        try { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue } catch {}
        return $procId
    }
    return $null
}

Invoke-Scenario "Scenario 1: ps1 launcher reports a working URL and PID" {
    $out = (& pwsh -NoProfile -File $Ps1Script 2>&1 | Out-String)
    Assert-Match $out "^https?://127\.0\.0\.1:\d+/" "ps1: first line is a localhost URL"
    Assert-Match $out "pid \d+" "ps1: reports a PID"

    if ($out -match '(https?://127\.0\.0\.1:\d+/)') {
        $url = $Matches[1]
        Start-Sleep -Milliseconds 300
        try {
            $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
            $script:Total++
            if ($resp.StatusCode -eq 200) {
                Write-Host "PASS: ps1: server responds 200 to a real HTTP request" -ForegroundColor Green
            } else {
                $script:Failures++
                Write-Host "FAIL: ps1: server responded $($resp.StatusCode), expected 200" -ForegroundColor Red
            }
            Assert-Match $resp.Content "Scrolls" "ps1: served page contains expected title text"
            Assert-Match $resp.Content "<html" "ps1: served page looks like real HTML"
        } catch {
            $script:Total++
            $script:Failures++
            Write-Host "FAIL: ps1: could not reach the reported URL -- $_" -ForegroundColor Red
        }
    }

    # Checking Get-Process after Stop-Process is unreliable in this sandbox:
    # the reparented (PPID 1) python process goes zombie/defunct on SIGKILL
    # but lingers in the process table until reaped, which this container's
    # init doesn't do promptly -- confirmed identical for the bash launcher
    # too (kill -9 leaves the same "Z <defunct>" entry), so it's an
    # environment characteristic, not a bug in either script. What actually
    # matters -- the server no longer answers requests -- is meaningful
    # regardless of that bookkeeping artifact, so assert that instead.
    $stoppedPid = Stop-ReportedServer -Output $out
    if ($stoppedPid -and ($out -match '(https?://127\.0\.0\.1:\d+/)')) {
        $url = $Matches[1]
        Start-Sleep -Milliseconds 500
        $stillReachable = $true
        try {
            Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
        } catch {
            $stillReachable = $false
        }
        Assert-True (-not $stillReachable) "ps1: server no longer answers requests after being stopped"
    }
}

Invoke-Scenario "Scenario 2: each invocation gets its own port (no collision on repeat runs)" {
    $out1 = (& pwsh -NoProfile -File $Ps1Script 2>&1 | Out-String)
    $out2 = (& pwsh -NoProfile -File $Ps1Script 2>&1 | Out-String)
    $url1 = if ($out1 -match '(https?://127\.0\.0\.1:\d+/)') { $Matches[1] } else { $null }
    $url2 = if ($out2 -match '(https?://127\.0\.0\.1:\d+/)') { $Matches[1] } else { $null }
    Assert-True (($null -ne $url1) -and ($null -ne $url2) -and ($url1 -ne $url2)) "ps1: two runs get two different ports"
    Stop-ReportedServer -Output $out1 | Out-Null
    Stop-ReportedServer -Output $out2 | Out-Null
}

if ($HaveBash) {
    Invoke-Scenario "Parity: sh launcher also reports a reachable URL" {
        $outSh = (& bash $ShScript 2>&1 | Out-String)
        Assert-Match $outSh "^https?://127\.0\.0\.1:\d+/" "sh: first line is a localhost URL"
        if ($outSh -match '(https?://127\.0\.0\.1:\d+/)') {
            $urlSh = $Matches[1]
            Start-Sleep -Milliseconds 300
            try {
                $respSh = Invoke-WebRequest -Uri $urlSh -UseBasicParsing -TimeoutSec 5
                Assert-True ($respSh.StatusCode -eq 200) "sh: server responds 200"
            } catch {
                $script:Total++; $script:Failures++
                Write-Host "FAIL: sh: could not reach the reported URL -- $_" -ForegroundColor Red
            }
        }
        if ($outSh -match 'pid (\d+)') {
            try { Stop-Process -Id ([int]$Matches[1]) -Force -ErrorAction SilentlyContinue } catch {}
        }
    }
}

Write-Host "`n=== Results: $($script:Total - $script:Failures)/$($script:Total) passed ===" -ForegroundColor $(if ($script:Failures -eq 0) { "Green" } else { "Red" })
if ($script:Failures -gt 0) { exit 1 } else { exit 0 }
