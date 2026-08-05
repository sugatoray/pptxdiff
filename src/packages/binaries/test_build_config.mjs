#!/usr/bin/env node
"use strict";

// Fast, pure regression checks for build.mjs's build CONFIGURATION — no
// real pkg invocation, no network, no subprocess beyond reading files.
// Complements test_build_e2e.mjs (real build + real run, slow). Same
// fast/slow split as pptxdiff-cli's `npm test` vs `npm run test:difftool`.
//
// Run: node test_build_config.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TARGET_MAP, ASSET_GLOBS, resolveTarget } from "./build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

let pass = 0;
let fail = 0;
function assert(name, cond) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${name}`);
  }
}

// --- TARGET_MAP / resolveTarget ---
const EXPECTED_KEYS = ["linux", "linux-arm64", "mac", "mac-arm64", "win", "win-arm64"];
assert(`TARGET_MAP has exactly the six expected keys (got ${JSON.stringify(Object.keys(TARGET_MAP).sort())})`, (
  JSON.stringify(Object.keys(TARGET_MAP).sort()) === JSON.stringify(EXPECTED_KEYS)
));
assert("linux target: node22-linux-x64, no .exe suffix, own outDirKey, doesn't need mac signing", (
  TARGET_MAP.linux.pkgTarget === "node22-linux-x64" && !TARGET_MAP.linux.binName.includes(".") && TARGET_MAP.linux.outDirKey === "linux" && TARGET_MAP.linux.needsMacSign === false
));
assert("linux-arm64 target: node22-linux-arm64, shares linux's outDirKey, distinct binName, doesn't need mac signing", (
  TARGET_MAP["linux-arm64"].pkgTarget === "node22-linux-arm64" && TARGET_MAP["linux-arm64"].outDirKey === "linux" && TARGET_MAP["linux-arm64"].binName !== TARGET_MAP.linux.binName && TARGET_MAP["linux-arm64"].needsMacSign === false
));
assert("win target: node22-win-x64, binName ends .exe, own outDirKey, doesn't need mac signing", (
  TARGET_MAP.win.pkgTarget === "node22-win-x64" && TARGET_MAP.win.binName.endsWith(".exe") && TARGET_MAP.win.outDirKey === "win" && TARGET_MAP.win.needsMacSign === false
));
assert("win-arm64 target: node22-win-arm64, binName ends .exe, shares win's outDirKey, distinct binName, doesn't need mac signing", (
  TARGET_MAP["win-arm64"].pkgTarget === "node22-win-arm64" && TARGET_MAP["win-arm64"].binName.endsWith(".exe") && TARGET_MAP["win-arm64"].outDirKey === "win" && TARGET_MAP["win-arm64"].binName !== TARGET_MAP.win.binName && TARGET_MAP["win-arm64"].needsMacSign === false
));
assert("mac target: node22-macos-x64, needsMacSign true (the whole reason it's built separately in CI)", (
  TARGET_MAP.mac.pkgTarget === "node22-macos-x64" && TARGET_MAP.mac.needsMacSign === true
));
assert("mac-arm64 target: node22-macos-arm64, needsMacSign true, binName distinct from the x64 one", (
  TARGET_MAP["mac-arm64"].pkgTarget === "node22-macos-arm64" && TARGET_MAP["mac-arm64"].needsMacSign === true && TARGET_MAP["mac-arm64"].binName !== TARGET_MAP.mac.binName
));
assert("mac and mac-arm64 share the SAME outDirKey (both download from pptxdiff-mac/)", (
  TARGET_MAP.mac.outDirKey === "mac" && TARGET_MAP["mac-arm64"].outDirKey === "mac"
));
assert("only the two mac targets need signing — every linux/win target (x64 or arm64) does not", (
  ["linux", "linux-arm64", "win", "win-arm64"].every((k) => TARGET_MAP[k].needsMacSign === false)
));
assert("resolveTarget('linux') === TARGET_MAP.linux", resolveTarget("linux") === TARGET_MAP.linux);
assert("resolveTarget('mac-arm64') === TARGET_MAP['mac-arm64']", resolveTarget("mac-arm64") === TARGET_MAP["mac-arm64"]);
assert("resolveTarget('win-arm64') === TARGET_MAP['win-arm64']", resolveTarget("win-arm64") === TARGET_MAP["win-arm64"]);
assert("resolveTarget returns null for an unknown osKey", resolveTarget("solaris") === null);
assert("resolveTarget returns null for an empty string", resolveTarget("") === null);
assert("every TARGET_MAP entry declares an outDirKey", Object.values(TARGET_MAP).every((t) => typeof t.outDirKey === "string" && t.outDirKey.length > 0));
assert("every TARGET_MAP binName is unique (no two targets would collide in the same outDir)", (
  new Set(Object.values(TARGET_MAP).map((t) => t.outDirKey + "/" + t.binName)).size === Object.keys(TARGET_MAP).length
));

// --- ASSET_GLOBS drift guard: must match root package.json's "files" ---
// (same fixture-drift-check concern this project already tracks elsewhere
// — see GAP_ANALYSIS.md's "Fixture drift-check" ticket — applied here so
// the asset set a packaged binary embeds can never silently diverge from
// what the npm package itself ships.)
const rootPkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
const npmStaticFiles = rootPkg.files.filter((f) => f.startsWith("src/pptxdiff/"));
// ASSET_GLOBS uses a "/**/*" suffix for the vendor directory (a pkg glob
// requirement — bare "vendor" alone does not recurse); normalize before
// comparing against package.json's plain-directory "vendor" entry.
const assetGlobsNormalized = ASSET_GLOBS.map((g) => g.replace(/\/\*\*\/\*$/, "")).sort();
assert(
  `ASSET_GLOBS (normalized) match root package.json "files" static app subset (got ${JSON.stringify(assetGlobsNormalized)} vs ${JSON.stringify([...npmStaticFiles].sort())})`,
  JSON.stringify(assetGlobsNormalized) === JSON.stringify([...npmStaticFiles].sort())
);
assert("every ASSET_GLOBS entry's literal (non-glob) prefix exists on disk", (
  ASSET_GLOBS.every((g) => fs.existsSync(path.join(REPO_ROOT, g.replace(/\/\*\*\/\*$/, ""))))
));

// --- pkg's config-colocation requirement (see WISDOM.md's trap entry): ---
// buildOne() MUST write its temp pkg config directly at REPO_ROOT (next to
// the real package.json) — pkg resolves "assets" glob paths relative to
// wherever the CONFIG FILE ITSELF lives, not cwd, not the entry file's
// directory. A regression here fails SILENTLY at build time (pkg embeds
// zero assets, no error) and only shows up as 404s when the binary is
// actually run — exactly the kind of bug this static check exists to
// catch before it ever reaches test_build_e2e.mjs.
const buildSrc = fs.readFileSync(path.join(__dirname, "build.mjs"), "utf8");
assert("buildOne() writes its temp pkg config at REPO_ROOT, not __dirname or cwd", (
  /tmpConfigPath\s*=\s*path\.join\(REPO_ROOT,/.test(buildSrc)
));
assert("buildOne() removes the temp pkg config in a finally block", (
  /finally\s*\{[^}]*rmSync\(tmpConfigPath/.test(buildSrc)
));
assert("ASSET_GLOBS are relative (repo-root-relative) paths, not absolute", (
  ASSET_GLOBS.every((g) => !path.isAbsolute(g))
));
assert("buildOne() computes outDir from target.outDirKey, not the osKey argument (so mac/mac-arm64 share pptxdiff-mac/)", (
  /outDir\s*=\s*path\.join\(__dirname, `pptxdiff-\$\{target\.outDirKey\}`\)/.test(buildSrc)
));
// A cross-ARCH build (e.g. linux-arm64/win-arm64 from an x64 host) fails
// outright without this flag — confirmed directly, a genuine exec-format
// error trying to run a foreign-arch bytecode-generation helper. Losing
// this flag would silently break EVERY arm64 target's build (pkg errors
// out instead of falling back to plain-source shipping), the same
// "passes on x64, breaks only for arm64" blind spot the config-colocation
// gotcha above already represents for a different reason.
assert("buildOne()'s pkg invocation includes --fallback-to-source (required for cross-arch builds)", (
  /"--fallback-to-source"/.test(buildSrc)
));

// --- bin/cli.js is passed to pkg UNMODIFIED — no assets-folder workaround ---
// This is the whole point of switching to pkg (see GAP_CONTEXT.md): the
// packaged binary should need zero special-casing in bin/cli.js itself.
const cliSrc = fs.readFileSync(path.join(REPO_ROOT, "bin", "cli.js"), "utf8");
assert("bin/cli.js's startServer() takes no parameters (no packaging-specific root override)", (
  /function startServer\(\) \{/.test(cliSrc)
));
assert("bin/cli.js still exports startServer for pptxdiff-cli's reuse", (
  /module\.exports\s*=\s*\{[^}]*startServer[^}]*\}/.test(cliSrc)
));
assert("build.mjs points pkg directly at the real bin/cli.js (no wrapper entry file)", (
  /path\.join\(REPO_ROOT, "bin", "cli\.js"\)/.test(buildSrc)
));

// --- macOS signing safety: never silently ship an unsigned mac binary ---
assert("buildOne() warns explicitly when building the mac target off of a non-darwin host", (
  /WARNING.*UNSIGNED/.test(buildSrc)
));
assert("buildOne() only runs codesign when process.platform === \"darwin\"", (
  /process\.platform === "darwin"/.test(buildSrc)
));

// --- package.json devDependency present ---
const binPkg = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
assert("package.json devDependencies includes @yao-pkg/pkg", Boolean(binPkg.devDependencies && binPkg.devDependencies["@yao-pkg/pkg"]));

console.log(`build-config check: ${pass}/${pass + fail} passed`);
if (fail > 0) {
  console.error(`${fail} check(s) FAILED (RED).`);
  process.exitCode = 1;
} else {
  console.log("All build-config checks passed (GREEN).");
}
