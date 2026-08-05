#!/usr/bin/env node
// Red/Green regression check for the pptxdiff Chocolatey package.
//
// There's no interesting pure business logic in a Chocolatey wrapper
// package (it's nuspec XML + two short PowerShell scripts) — same
// situation src/pptxdiff/test_offline_capable.mjs documented for the
// offline-vendoring infrastructure change. So, same approach: assert real
// INVARIANTS a static-analysis pass over the source text can check,
// without needing `choco`/`pwsh` (neither is available in this repo's
// Linux dev/CI sandbox — see this package's own README).
//
// Specifically this guards against two real risk classes:
//   1. Version drift: pptxdiff.nuspec's <version>, its <dependency
//      id="nodejs"> minimum, tools/chocolateyinstall.ps1's fallback
//      version pin, and the root package.json's own version/engines.node
//      are FOUR separately-maintained values that must agree by hand on
//      every release (see docs/.scrolls/GAP_ANALYSIS.md's "Chocolatey
//      package" section) — nothing else catches them silently diverging.
//   2. The exact PowerShell command-mode-vs-expression-mode concatenation
//      bug found and fixed while writing this package (see
//      docs/.scrolls/WISDOM.md's "PowerShell command-mode vs.
//      expression-mode argument parsing" entry): `Write-Warning "a" + "b"`
//      does NOT concatenate in PowerShell's cmdlet-call argument parsing —
//      it silently throws the first time that code path actually runs. A
//      permanent regression guard so a future edit can't reintroduce it.
//
// Run: node src/packages/pptxdiff-chocolatey/test_chocolatey_package.mjs

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(DIR, "..", "..", "..");

let failures = [];
let checks = 0;

function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
}

function readSource(relPath, baseDir = DIR) {
  const p = path.join(baseDir, relPath);
  if (!existsSync(p)) throw new Error(`missing file: ${relPath}`);
  return readFileSync(p, "utf8");
}

// ---- Pure extraction/detection helpers (the testable "core") ----

function extractNuspecTag(nuspecXml, tag) {
  const m = nuspecXml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1].trim() : null;
}

function extractNuspecDependencyVersion(nuspecXml, id) {
  const m = nuspecXml.match(
    new RegExp(`<dependency\\s+id="${id}"\\s+version="([^"]+)"`)
  );
  return m ? m[1] : null;
}

function extractInstallScriptFallbackVersion(ps1Text) {
  const m = ps1Text.match(/\$npmPackageVersion\s*=\s*'([^']+)'/);
  return m ? m[1] : null;
}

// True if `ps1Text` contains a cmdlet call whose argument list tries to
// `+`-concatenate quoted strings — invalid in PowerShell's command
// (argument) parsing mode, only valid in expression mode. See WISDOM.md.
function hasCmdletPlusConcatBug(ps1Text) {
  return /Write-(?:Warning|Host|Error|Output|Verbose)\s+"[^"]*"\s*\+/.test(ps1Text);
}

// Minimum major Node version implied by a root package.json-style
// engines.node string like ">=18" or ">=18.0.0".
function minNodeMajorFromEnginesField(enginesNode) {
  const m = String(enginesNode || "").match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function majorOf(semverLike) {
  const m = String(semverLike || "").match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

// ---- Load real files ----

const nuspec = readSource("pptxdiff.nuspec");
const installPs1 = readSource(path.join("tools", "chocolateyinstall.ps1"));
const uninstallPs1 = readSource(path.join("tools", "chocolateyuninstall.ps1"));
const verificationTxt = readSource(path.join("tools", "VERIFICATION.txt"));
const licenseTxt = readSource(path.join("tools", "LICENSE.txt"));
const readme = readSource("README.md");
const changelog = readSource("CHANGELOG.md");
const rootPackageJson = JSON.parse(readSource("package.json", ROOT_DIR));
const rootLicense = readSource("LICENSE", ROOT_DIR);

// ---- Package identity ----

assert("nuspec <id> is pptxdiff", extractNuspecTag(nuspec, "id") === "pptxdiff");
assert(
  "nuspec <title> is present",
  Boolean(extractNuspecTag(nuspec, "title"))
);
assert(
  "nuspec declares an Apache-2.0 license expression",
  /<license type="expression">Apache-2\.0<\/license>/.test(nuspec)
);

// ---- Version sync (the real drift risk this package's own docs call out) ----

const nuspecVersion = extractNuspecTag(nuspec, "version");
const installFallbackVersion = extractInstallScriptFallbackVersion(installPs1);

assert("nuspec <version> is present", Boolean(nuspecVersion));
assert(
  `nuspec <version> (${nuspecVersion}) matches root package.json version (${rootPackageJson.version})`,
  nuspecVersion === rootPackageJson.version
);
assert(
  `chocolateyinstall.ps1's fallback version (${installFallbackVersion}) matches nuspec <version> (${nuspecVersion})`,
  installFallbackVersion === nuspecVersion
);

const nodejsDepVersion = extractNuspecDependencyVersion(nuspec, "nodejs");
const rootMinNodeMajor = minNodeMajorFromEnginesField(rootPackageJson.engines?.node);
assert("nuspec depends on the 'nodejs' Chocolatey package", Boolean(nodejsDepVersion));
assert(
  `nuspec's nodejs dependency major version (${nodejsDepVersion}) matches root package.json engines.node minimum (${rootPackageJson.engines?.node})`,
  majorOf(nodejsDepVersion) === rootMinNodeMajor
);

// ---- Install/uninstall scripts do what they claim, and nothing embedded ----

assert(
  "chocolateyinstall.ps1 installs pptxdiff globally via npm",
  /npm install --global "\$npmPackageName@\$npmPackageVersion"/.test(installPs1)
);
assert(
  "chocolateyinstall.ps1 sets \\$ErrorActionPreference = 'Stop' (fail loudly, not silently)",
  /\$ErrorActionPreference\s*=\s*'Stop'/.test(installPs1)
);
assert(
  "chocolateyuninstall.ps1 uninstalls pptxdiff globally via npm",
  /npm uninstall --global \$npmPackageName/.test(uninstallPs1)
);
assert(
  "chocolateyuninstall.ps1 sets \\$ErrorActionPreference = 'Stop'",
  /\$ErrorActionPreference\s*=\s*'Stop'/.test(uninstallPs1)
);

// The specific PowerShell trap this package's WISDOM.md entry documents —
// a permanent regression guard against reintroducing it.
assert(
  "chocolateyinstall.ps1 does not use the invalid cmdlet-argument-mode '+' string concatenation bug",
  !hasCmdletPlusConcatBug(installPs1)
);
assert(
  "chocolateyuninstall.ps1 does not use the invalid cmdlet-argument-mode '+' string concatenation bug",
  !hasCmdletPlusConcatBug(uninstallPs1)
);

// ---- Required companion files (Chocolatey moderation + repo convention) ----

assert("tools/VERIFICATION.txt is non-empty", verificationTxt.trim().length > 0);
assert(
  "tools/VERIFICATION.txt explains there is no embedded binary payload",
  /no.*embed|does not embed/i.test(verificationTxt)
);
assert(
  "tools/LICENSE.txt is byte-identical to the root LICENSE (Apache 2.0)",
  licenseTxt === rootLicense
);
assert("package README.md is non-empty", readme.trim().length > 0);
assert("package CHANGELOG.md is non-empty", changelog.trim().length > 0);
assert(
  "CHANGELOG.md follows Keep a Changelog format",
  changelog.includes("Keep a Changelog")
);

// ---- files section actually packages the tools/ directory ----

assert(
  "nuspec <files> packages the tools directory",
  /<file\s+src="tools\\?\/?\*\*"\s+target="tools"\s*\/>/.test(nuspec)
);

console.log(`chocolatey package check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All chocolatey-package checks passed (GREEN).");
}
