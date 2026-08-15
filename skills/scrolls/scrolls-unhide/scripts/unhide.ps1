#!/usr/bin/env pwsh
# Renames .scrolls folder(s) to scrolls (visible), rewriting the path
# references inside the moved folder and in any CLAUDE.md that mentions
# it. Reports (never auto-edits) any other stray references it finds
# nearby.
#
# PowerShell port of unhide.sh — same option surface, same discovery and
# rewrite semantics; see that script's header for the full rationale.
# Requires PowerShell 7+ (pwsh), not legacy Windows PowerShell 5.1, for
# predictable cross-platform default encoding.
#
# Deliberate design note for this port: every path this script constructs
# itself (old_dir, docs_dir, base_dir, the short/full reference strings)
# is kept forward-slash-only, never using Join-Path/Split-Path's
# OS-native separators. Two reasons: (1) these values get WRITTEN INTO
# committed markdown text (STARTER.md/CLAUDE.md references), where the
# established convention across this whole project is forward slashes
# regardless of which OS generated them — a Windows-native backslash
# path baked into checked-in docs would be a portability regression, not
# an improvement; (2) Windows/.NET file APIs accept '/' as an alternate
# separator transparently, so this loses nothing for the actual
# filesystem operations (Test-Path, Move-Item, git) either. Paths that
# come FROM the filesystem (Get-ChildItem results) are the one place
# native separators can appear, so they're normalized to forward slashes
# immediately in ConvertTo-CwdRelative before anything else touches them.
#
# Usage:
#   unhide.ps1 [-p ROOT | --path=ROOT | --path ROOT] ... [-r|--recurse]
#   unhide.ps1 -t | --reporoot [-r|--recurse]
#   unhide.ps1 -l | --local    [-r|--recurse]

$FromName = ".scrolls"
$ToName = "scrolls"
$MaxDepth = 8
$PruneNames = @(".git", "node_modules", "vendor", "dist", "build", ".venv", "venv", "__pycache__", "target", ".next", ".cache")

function Write-Stderr {
    param([string]$Message)
    [Console]::Error.WriteLine($Message)
}

# ---- forward-slash-only path helpers (see design note above) ----

function Get-DirName {
    param([string]$Path)
    $p = $Path.TrimEnd('/')
    $idx = $p.LastIndexOf('/')
    if ($idx -lt 0) { return "." }
    if ($idx -eq 0) { return "/" }
    return $p.Substring(0, $idx)
}

function Get-BaseName {
    param([string]$Path)
    $p = $Path.TrimEnd('/')
    $idx = $p.LastIndexOf('/')
    if ($idx -lt 0) { return $p }
    return $p.Substring($idx + 1)
}

function ConvertTo-CwdRelative {
    param([string]$Path)
    $normalized = $Path.Replace('\', '/')
    $cwd = (Get-Location).Path.Replace('\', '/').TrimEnd('/')
    if ($normalized -eq $cwd) { return "." }
    if ($normalized.StartsWith("$cwd/")) {
        $normalized = $normalized.Substring($cwd.Length + 1)
    }
    $normalized = $normalized -replace '^\./', ''
    return $normalized
}

# ---- recursive filesystem helpers (real prune, not filter-after) ----

function Get-FilesRecursive {
    param([string]$Root, [string[]]$ExcludeDirNames = @())
    $results = New-Object System.Collections.Generic.List[string]
    if (-not (Test-Path -LiteralPath $Root -PathType Container)) { return $results }

    function Visit {
        param([string]$Dir)
        $items = $null
        try { $items = Get-ChildItem -LiteralPath $Dir -Force -ErrorAction Stop } catch { return }
        foreach ($item in $items) {
            if ($item.PSIsContainer) {
                if ($ExcludeDirNames -contains $item.Name) { continue }
                Visit -Dir $item.FullName
            } else {
                [void]$results.Add($item.FullName)
            }
        }
    }

    Visit -Dir (Resolve-Path -LiteralPath $Root).Path
    return $results
}

function Select-FilesContaining {
    param([string]$Dir, [string[]]$Patterns, [string[]]$ExcludeDirNames = @())
    $patterns = $Patterns | Where-Object { $_ -ne "" }
    if ($patterns.Count -eq 0) { return @() }
    $files = Get-FilesRecursive -Root $Dir -ExcludeDirNames $ExcludeDirNames
    $matches = New-Object System.Collections.Generic.List[string]
    foreach ($f in $files) {
        try {
            $text = Get-Content -LiteralPath $f -Raw -ErrorAction Stop
        } catch {
            continue
        }
        foreach ($p in $patterns) {
            if ($text.Contains($p)) {
                [void]$matches.Add($f)
                break
            }
        }
    }
    return $matches
}

function Find-ScrollsDirs {
    param([string]$Root, [string]$TargetName, [int]$MaxDepth, [string[]]$PruneNames)
    $results = New-Object System.Collections.Generic.List[string]
    if (-not (Test-Path -LiteralPath $Root -PathType Container)) { return $results }
    $rootFull = (Resolve-Path -LiteralPath $Root).Path

    function Visit {
        param([string]$Dir, [int]$Depth)
        $leaf = Split-Path -Leaf $Dir
        if ($PruneNames -contains $leaf) { return }
        if ($leaf -eq $TargetName) { [void]$results.Add($Dir) }
        if ($Depth -ge $MaxDepth) { return }
        $children = $null
        try { $children = Get-ChildItem -LiteralPath $Dir -Directory -Force -ErrorAction Stop } catch { return }
        foreach ($child in $children) {
            Visit -Dir $child.FullName -Depth ($Depth + 1)
        }
    }

    Visit -Dir $rootFull -Depth 0
    return $results
}

# .NET's plain String.Replace is already a literal (non-regex) substring
# replace — no escaping needed at all, unlike bash's sed-based approach.
function Update-FileReferences {
    param([string]$Path, [string]$OldDir, [string]$NewDir, [string]$ShortOld, [string]$ShortNew)
    $content = Get-Content -LiteralPath $Path -Raw
    $content = $content.Replace($OldDir, $NewDir)
    $content = $content.Replace($ShortOld, $ShortNew)
    Set-Content -LiteralPath $Path -Value $content -NoNewline -Encoding utf8
    Write-Host "  Updated: $Path"
}

function Invoke-ProcessOne {
    param([string]$OldDir)

    $docsDir = Get-DirName $OldDir
    $baseDir = Get-DirName $docsDir
    $docsName = Get-BaseName $docsDir
    $newDir = "$docsDir/$ToName"
    $shortOld = "$docsName/$FromName"
    $shortNew = "$docsName/$ToName"

    if (Test-Path -LiteralPath $newDir) {
        Write-Host "SKIP: $OldDir -> $newDir already exists"
        return
    }

    $inGit = $false
    & git rev-parse --is-inside-work-tree *>$null
    if ($LASTEXITCODE -eq 0) { $inGit = $true }

    $isTracked = $false
    if ($inGit) {
        & git ls-files --error-unmatch $OldDir *>$null
        if ($LASTEXITCODE -eq 0) { $isTracked = $true }
    }

    if ($isTracked) {
        & git mv $OldDir $newDir
    } else {
        Move-Item -LiteralPath $OldDir -Destination $newDir
    }
    Write-Host "Moved: $OldDir -> $newDir"

    # A scrolls folder's own references may be written either as the full
    # path from wherever this was invoked (OldDir) or the short form
    # relative to base_dir (ShortOld, what -t/-l/default use) -- try both.
    $filesInNewDir = Select-FilesContaining -Dir $newDir -Patterns @($OldDir, $shortOld)
    foreach ($f in $filesInNewDir) {
        Update-FileReferences -Path $f -OldDir $OldDir -NewDir $newDir -ShortOld $shortOld -ShortNew $shortNew
    }

    # CLAUDE.md is always an exact, direct sibling of "docs" by construction
    # -- check that ONE specific file, never a recursive search. A search
    # scoped to base_dir sounds safe but isn't: when base_dir is itself the
    # repo root (the common case), that's no restriction at all, and a
    # sibling package's CLAUDE.md sharing the same short reference string
    # would get wrongly rewritten.
    $claudeMd = "$baseDir/CLAUDE.md"
    if (Test-Path -LiteralPath $claudeMd -PathType Leaf) {
        $text = $null
        try { $text = Get-Content -LiteralPath $claudeMd -Raw -ErrorAction Stop } catch { $text = $null }
        if ($text -and ($text.Contains($OldDir) -or $text.Contains($shortOld))) {
            Update-FileReferences -Path $claudeMd -OldDir $OldDir -NewDir $newDir -ShortOld $shortOld -ShortNew $shortNew
        }
    }

    # Leftover-reference reporting is read-only, so a false positive here is
    # just noise, not a correctness risk -- but still exclude other scrolls
    # folders' own internal self-references, the most common source of
    # noise under the shared short-form convention.
    Write-Host "  Other references (within $baseDir) left for manual review:"
    $leftover = Select-FilesContaining -Dir $baseDir -Patterns @($OldDir, $shortOld) -ExcludeDirNames @(".git", ".scrolls", "scrolls")
    if ($leftover.Count -gt 0) {
        foreach ($f in $leftover) { Write-Host "    $f" }
    } else {
        Write-Host "    (none found)"
    }
}

# ---- argument parsing ----

$roots = New-Object System.Collections.Generic.List[string]
$mode = ""
$recurse = $false

function Test-ConflictAndSetMode {
    param([string]$NewMode)
    if ($script:mode -ne "" -and $script:mode -ne $NewMode) {
        Write-Stderr "Cannot combine -p/--path with -t/--reporoot or -l/--local -- pick one way to target a location."
        exit 2
    }
    $script:mode = $NewMode
}

$scriptArgs = $args
$i = 0
while ($i -lt $scriptArgs.Count) {
    $a = $scriptArgs[$i]
    if ($a -eq '-p') {
        Test-ConflictAndSetMode "path"
        $i++
        if ($i -ge $scriptArgs.Count) { Write-Stderr "Missing value for -p"; exit 2 }
        [void]$roots.Add($scriptArgs[$i])
        $i++
    }
    elseif ($a -eq '--path') {
        Test-ConflictAndSetMode "path"
        $i++
        if ($i -ge $scriptArgs.Count) { Write-Stderr "Missing value for --path"; exit 2 }
        [void]$roots.Add($scriptArgs[$i])
        $i++
    }
    elseif ($a -match '^--path=(.*)$') {
        Test-ConflictAndSetMode "path"
        [void]$roots.Add($Matches[1])
        $i++
    }
    elseif ($a -match '^-p=(.*)$') {
        Test-ConflictAndSetMode "path"
        [void]$roots.Add($Matches[1])
        $i++
    }
    elseif ($a -eq '-t' -or $a -eq '--reporoot') {
        Test-ConflictAndSetMode "reporoot"
        $repoRoot = (& git rev-parse --show-toplevel 2>$null)
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repoRoot)) {
            Write-Stderr "-t/--reporoot requires being inside a git repository; none was detected here."
            exit 2
        }
        $roots.Clear()
        [void]$roots.Add($repoRoot)
        $i++
    }
    elseif ($a -eq '-l' -or $a -eq '--local') {
        Test-ConflictAndSetMode "local"
        $roots.Clear()
        [void]$roots.Add(".")
        $i++
    }
    elseif ($a -eq '-r' -or $a -eq '--recurse') {
        $recurse = $true
        $i++
    }
    else {
        Write-Stderr "Unrecognized argument: $a"
        exit 2
    }
}

if ($roots.Count -eq 0) {
    $defaultRelPath = $env:DEFAULT_SCROLLS_RELPATH
    if ([string]::IsNullOrEmpty($defaultRelPath) -and -not $recurse) {
        $repoRoot = (& git rev-parse --show-toplevel 2>$null)
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($repoRoot)) {
            $cwd = (Get-Location).Path.Replace('\', '/').TrimEnd('/')
            $repoRootNorm = $repoRoot.Replace('\', '/').TrimEnd('/')
            if ($repoRootNorm -ne $cwd) {
                Write-Stderr "Note: checking $cwd/docs only -- not the repo root ($repoRootNorm), not recursively."
                Write-Stderr "Pass -t/--reporoot to check the repo root's docs instead, -r/--recurse to search recursively under here, or both to sweep the whole repo."
                Write-Stderr ""
            }
        }
    }
    if ([string]::IsNullOrEmpty($defaultRelPath)) {
        [void]$roots.Add((Get-Location).Path)
    } else {
        [void]$roots.Add($defaultRelPath)
    }
}

# ---- main ----

$seen = New-Object System.Collections.Generic.HashSet[string]
$foundAny = $false

function Invoke-Match {
    param([string]$RawDir)
    $dir = ConvertTo-CwdRelative $RawDir
    if (-not (Test-Path -LiteralPath "$dir/STARTER.md" -PathType Leaf)) { return }
    if ($seen.Contains($dir)) { return }
    [void]$seen.Add($dir)
    $script:foundAny = $true
    Write-Host ""
    Write-Host "== $dir =="
    Invoke-ProcessOne -OldDir $dir
}

foreach ($root in $roots) {
    $r = $root.TrimEnd('/', '\')
    if ([string]::IsNullOrEmpty($r)) { $r = "." }
    if (-not (Test-Path -LiteralPath $r -PathType Container)) {
        Write-Stderr "WARN: root '$r' does not exist, skipping"
        continue
    }

    if ($recurse) {
        $matches = Find-ScrollsDirs -Root $r -TargetName $FromName -MaxDepth $MaxDepth -PruneNames $PruneNames
        foreach ($m in $matches) { Invoke-Match -RawDir $m }
    } else {
        if (Test-Path -LiteralPath "$r/STARTER.md" -PathType Leaf) {
            Invoke-Match -RawDir $r
        } else {
            Invoke-Match -RawDir "$r/docs/$FromName"
        }
    }
}

if (-not $foundAny) {
    Write-Host "No $FromName folder found under: $($roots -join ' ')"
    if (-not $recurse) {
        Write-Host "Checked the exact default location only -- pass -r/--recurse to search recursively instead."
    }
    Write-Host "If this project hasn't been set up yet, run /scrolls-setup first."
    exit 1
}
