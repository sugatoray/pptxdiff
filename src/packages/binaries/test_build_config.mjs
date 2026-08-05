#!/usr/bin/env node
"use strict";

// Fast, pure regression checks for build.mjs's build CONFIGURATION — no
// real SEA build, no subprocess, no network. Complements test_build_e2e.mjs
// (which actually builds and runs a real binary but is slow/heavy) the
// same way this project's other packages split a fast pure-unit suite from
// a slower real-process/real-browser one (e.g. pptxdiff-cli's `npm test`
// vs `npm run test:difftool`).
//
// Run: node test_build_config.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLATFORM_MAP, ASSET_ENTRIES, resolveTarget } from "./build.mjs";

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

// --- PLATFORM_MAP / resolveTarget ---
assert("PLATFORM_MAP has exactly win32/darwin/linux keys", (
  JSON.stringify(Object.keys(PLATFORM_MAP).sort()) === JSON.stringify(["darwin", "linux", "win32"])
));
assert("win32 maps to osKey=win, binName ends .exe, isWin=true", (
  PLATFORM_MAP.win32.osKey === "win" && PLATFORM_MAP.win32.binName === "pptxdiff-win.exe" && PLATFORM_MAP.win32.isWin === true
));
assert("darwin maps to osKey=mac, isMac=true, isWin=false", (
  PLATFORM_MAP.darwin.osKey === "mac" && PLATFORM_MAP.darwin.isMac === true && PLATFORM_MAP.darwin.isWin === false
));
assert("linux maps to osKey=linux, isMac=false, isWin=false, no .exe suffix", (
  PLATFORM_MAP.linux.osKey === "linux" && PLATFORM_MAP.linux.isMac === false && PLATFORM_MAP.linux.isWin === false && !PLATFORM_MAP.linux.binName.includes(".")
));
assert("resolveTarget('win32') === PLATFORM_MAP.win32", resolveTarget("win32") === PLATFORM_MAP.win32);
assert("resolveTarget returns null for an unsupported platform", resolveTarget("aix") === null);
assert("resolveTarget returns null for a made-up platform string", resolveTarget("not-a-real-platform") === null);

// --- ASSET_ENTRIES drift guard: must match root package.json's "files" ---
// (mirrors the project's existing fixture-drift-check concern — see
// GAP_ANALYSIS.md's "Fixture drift-check" ticket — applied here to the
// asset set a packaged binary ships, so it can never silently diverge from
// what the npm package itself ships.)
const rootPkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
const npmStaticFiles = rootPkg.files.filter((f) => f.startsWith("src/pptxdiff/"));
const assetSrcPaths = ASSET_ENTRIES.map(([src]) => src).sort();
assert(
  `ASSET_ENTRIES source paths match root package.json "files" static app subset (got ${JSON.stringify(assetSrcPaths)} vs ${JSON.stringify([...npmStaticFiles].sort())})`,
  JSON.stringify(assetSrcPaths) === JSON.stringify([...npmStaticFiles].sort())
);
assert("every ASSET_ENTRIES source path exists on disk", (
  ASSET_ENTRIES.every(([src]) => fs.existsSync(path.join(REPO_ROOT, src)))
));
assert("every ASSET_ENTRIES dest path is a plain relative name (no traversal)", (
  ASSET_ENTRIES.every(([, dest]) => !dest.includes("..") && !path.isAbsolute(dest))
));

// --- bin/cli.js contract sea-entry.cjs depends on ---
// A regression guard, not a design assertion: if a future edit to
// bin/cli.js drops startServer()'s optional `root` param (or its default),
// the packaged binary silently breaks (it would try to serve from the npm
// package's own ROOT instead of the assets folder next to the executable)
// with no error at build time — only a confusing 404 at runtime. Catch it
// here instead, the same static-source-check pattern WISDOM.md's
// "stale renderVals binding" entry established for a similar class of
// silent-breakage risk.
const cliSrc = fs.readFileSync(path.join(REPO_ROOT, "bin", "cli.js"), "utf8");
assert("bin/cli.js's startServer() still accepts an optional root param defaulting to ROOT", (
  /function startServer\(root\s*=\s*ROOT\)/.test(cliSrc)
));
assert("bin/cli.js's startServer() still exports (module.exports includes startServer)", (
  /module\.exports\s*=\s*\{[^}]*startServer[^}]*\}/.test(cliSrc)
));

// --- sea-entry.cjs's own asset-resolution contract ---
const entrySrc = fs.readFileSync(path.join(__dirname, "sea-entry.cjs"), "utf8");
assert("sea-entry.cjs resolves ROOT relative to process.execPath, not __dirname", (
  entrySrc.includes("path.dirname(process.execPath)") && /const ROOT = path\.join\(path\.dirname\(process\.execPath\)/.test(entrySrc)
));
assert("sea-entry.cjs passes ROOT into startServer() explicitly", (
  /startServer\(ROOT\)/.test(entrySrc)
));

// --- package.json devDependencies actually present ---
const binPkg = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
for (const dep of ["esbuild", "jszip", "postject"]) {
  assert(`package.json devDependencies includes ${dep}`, Boolean(binPkg.devDependencies && binPkg.devDependencies[dep]));
}

console.log(`build-config check: ${pass}/${pass + fail} passed`);
if (fail > 0) {
  console.error(`${fail} check(s) FAILED (RED).`);
  process.exitCode = 1;
} else {
  console.log("All build-config checks passed (GREEN).");
}
