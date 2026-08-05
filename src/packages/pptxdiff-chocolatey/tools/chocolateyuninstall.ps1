$ErrorActionPreference = 'Stop'

$npmPackageName = 'pptxdiff'

$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
  $msg = "npm was not found on PATH; skipping 'npm uninstall --global $npmPackageName'. " +
         "If Node.js/npm is still installed under a different PATH, remove it manually with " +
         "'npm uninstall --global $npmPackageName'."
  Write-Warning $msg
  return
}

& npm uninstall --global $npmPackageName
if ($LASTEXITCODE -ne 0) {
  $msg = "npm uninstall --global $npmPackageName exited with code $LASTEXITCODE (it may " +
         "already have been removed, or removed via a different npm prefix)."
  Write-Warning $msg
}
