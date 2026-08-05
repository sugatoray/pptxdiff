$ErrorActionPreference = 'Stop'

$npmPackageName    = 'pptxdiff'
$npmPackageVersion = $env:chocolateyPackageVersion
if ([string]::IsNullOrWhiteSpace($npmPackageVersion)) {
  # Fallback for manual `choco pack`/`choco install -s .` runs where Chocolatey
  # doesn't set the package-version environment variable (e.g. local testing).
  $npmPackageVersion = '0.7.0'
}

$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
  $msg = "npm was not found on PATH. This package depends on the 'nodejs' Chocolatey package to " +
         "provide Node.js (>= 18) and npm -- if it was skipped or a shell restart is needed, " +
         "install Node.js manually from https://nodejs.org/ and re-run this install."
  throw $msg
}

Write-Host "Installing $npmPackageName@$npmPackageVersion globally via npm ..."
& npm install --global "$npmPackageName@$npmPackageVersion" --no-fund --no-audit
if ($LASTEXITCODE -ne 0) {
  throw "npm install --global $npmPackageName@$npmPackageVersion failed with exit code $LASTEXITCODE."
}

Write-Host "$npmPackageName installed. Run 'pptxdiff' from any shell to start it."
