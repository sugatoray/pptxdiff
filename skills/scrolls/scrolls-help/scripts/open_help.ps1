#!/usr/bin/env pwsh
# Launches serve_help.py in the background on an OS-assigned localhost
# port and prints the URL once the server confirms it's ready — rather
# than guessing a fixed startup delay. The server keeps running after
# this script exits; prints its PID so the caller can stop it later.
#
# PowerShell port of open_help.sh. serve_help.py itself needs no porting
# — it's pure stdlib Python, already cross-platform — but the *launcher*
# does: bash's nohup/disown/mktemp don't exist on native Windows, and
# Windows commonly has only "python" on PATH rather than "python3".
# Requires PowerShell 7+ (pwsh).

$Here = $PSScriptRoot
$ServeScript = Join-Path $Here "serve_help.py"

function Resolve-Python {
    foreach ($candidate in @("python3", "python")) {
        if (Get-Command $candidate -ErrorAction SilentlyContinue) {
            return $candidate
        }
    }
    [Console]::Error.WriteLine("Neither python3 nor python was found on PATH.")
    exit 1
}
$Python = Resolve-Python

# Start-Process refuses to redirect stdout and stderr to the same file, so
# use two and treat their concatenation as "the log" everywhere below.
$StdoutLog = [System.IO.Path]::GetTempFileName()
$StderrLog = [System.IO.Path]::GetTempFileName()

function Get-CombinedLog {
    $out = ""
    if (Test-Path $StdoutLog) { $out += (Get-Content -Raw $StdoutLog -ErrorAction SilentlyContinue) }
    if (Test-Path $StderrLog) { $out += (Get-Content -Raw $StderrLog -ErrorAction SilentlyContinue) }
    return $out
}

$proc = Start-Process -FilePath $Python -ArgumentList @($ServeScript) `
    -RedirectStandardOutput $StdoutLog -RedirectStandardError $StderrLog `
    -NoNewWindow -PassThru

$deadline = (Get-Date).AddSeconds(10)
while ((Get-Date) -lt $deadline) {
    $log = Get-CombinedLog
    if ($log -match '(?m)^(https?://\S+)\s*$') {
        Write-Host $Matches[1]
        Write-Host "(pid $($proc.Id) — kill it to stop the server; log at $StdoutLog / $StderrLog)"
        exit 0
    }
    if ($proc.HasExited) {
        [Console]::Error.WriteLine("Server process exited unexpectedly:")
        [Console]::Error.WriteLine($log)
        exit 1
    }
    Start-Sleep -Milliseconds 250
}

[Console]::Error.WriteLine("Timed out waiting for the server to start:")
[Console]::Error.WriteLine((Get-CombinedLog))
try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
exit 1
