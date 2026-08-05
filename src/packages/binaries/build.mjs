#!/usr/bin/env node
"use strict";

// Builds standalone native pptxdiff executables using @yao-pkg/pkg (the
// actively-maintained fork of the Vercel-archived `pkg` — see
// docs/.scrolls/GAP_CONTEXT.md for why this was chosen over Node's own
// Single Executable Applications feature, which this package originally
// used).
//
// Unlike Node SEA, pkg genuinely cross-compiles: it downloads a prebuilt
// "base" node binary for each TARGET platform and injects the bundled app
// into it, so a single Linux (or any) host can build the Windows and Linux
// binaries. macOS is the one exception in THIS build — see below.
//
// Points bin/cli.js's UNMODIFIED entry point directly at pkg, and embeds
// the same static app files (index.html/support.js/sample-pptx.js/
// vendor/**) as pkg "assets" — pkg's snapshot filesystem preserves the
// real relative directory structure (entry at snapshot `/bin/cli.js`,
// assets at snapshot `/src/pptxdiff/...`), so `bin/cli.js`'s own
// `ROOT = path.join(__dirname, "..", "src", "pptxdiff")` resolves
// correctly with ZERO code changes — no assets-folder-next-to-the-binary
// workaround needed the way Node SEA required.
//
// IMPORTANT, hard-won gotcha (see WISDOM.md): pkg's "assets" glob paths in
// a config file resolve relative to WHATEVER DIRECTORY THAT CONFIG FILE
// ITSELF LIVES IN — not the process's cwd, not the entry file's directory.
// Silently: no error, no warning, it just embeds nothing if the globs
// don't match from the config's own location. The config therefore has to
// be written to REPO_ROOT (next to the real package.json) for
// "src/pptxdiff/**" to resolve — written fresh before each build and
// removed in a `finally`, since it isn't a real project file.
//
// **macOS (both `mac`/Intel and `mac-arm64`/Apple Silicon) is NOT
// cross-compiled from this build.** pkg can produce either macOS binary
// from Linux/Windows regardless of the BUILD host's own architecture, but
// it cannot codesign either one (`codesign` only exists on macOS) — and an
// entirely unsigned binary is a real functional problem specifically on
// Apple Silicon (arm64 requires at least an ad-hoc signature to launch at
// all under AMFI, not just a Gatekeeper warning like on Intel). So
// `buildOne()` only runs its codesign step when `process.platform ===
// 'darwin'`, for either mac target; on any other host it still produces a
// binary (for local experimentation) but loudly warns it's unsigned
// rather than silently shipping something that may not launch.
// .github/workflows/binaries.yml reflects this: linux+win build together
// on ubuntu-latest, both mac targets build separately on macos-latest
// (GitHub's macos-latest runners are themselves Apple Silicon as of 2024,
// so `mac-arm64` there is a genuinely native build+sign, not translated).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

// `outDirKey` is separate from the map's own key so multiple targets can
// share one OS folder — `mac` (Intel/x64) and `mac-arm64` (Apple Silicon,
// native) both land in `pptxdiff-mac/`, since they're the same OS as far
// as a user picking a download is concerned, just a different chip.
export const TARGET_MAP = {
  linux: { pkgTarget: "node22-linux-x64", binName: "pptxdiff-linux", outDirKey: "linux", needsMacSign: false },
  win: { pkgTarget: "node22-win-x64", binName: "pptxdiff-win.exe", outDirKey: "win", needsMacSign: false },
  mac: { pkgTarget: "node22-macos-x64", binName: "pptxdiff-mac", outDirKey: "mac", needsMacSign: true },
  "mac-arm64": { pkgTarget: "node22-macos-arm64", binName: "pptxdiff-mac-arm64", outDirKey: "mac", needsMacSign: true },
};

// Same subset root package.json's "files" ships to npm — the exact static
// files bin/cli.js's server reads from ROOT. Relative to REPO_ROOT, which
// is where the temp pkg config gets written (see the file header comment
// on WHY that placement matters).
export const ASSET_GLOBS = [
  "src/pptxdiff/index.html",
  "src/pptxdiff/support.js",
  "src/pptxdiff/sample-pptx.js",
  "src/pptxdiff/vendor/**/*",
];

// Pure: osKey -> TARGET_MAP entry, or null if unknown.
export function resolveTarget(osKey) {
  return TARGET_MAP[osKey] || null;
}

function log(osKey, msg) {
  console.log(`[build-binary:${osKey}] ${msg}`);
}

// Builds ONE OS's binary. `target` must be a TARGET_MAP entry. Returns the
// absolute path to the built executable. Writes bin.mjs's temp pkg config
// at REPO_ROOT and always removes it afterward, success or failure.
export async function buildOne(osKey, target) {
  const outDir = path.join(__dirname, `pptxdiff-${target.outDirKey}`);
  fs.mkdirSync(outDir, { recursive: true });
  const binOut = path.join(outDir, target.binName);
  fs.rmSync(binOut, { force: true });

  const tmpConfigPath = path.join(REPO_ROOT, `.pkg-binaries-config.${osKey}.json`);
  fs.writeFileSync(tmpConfigPath, JSON.stringify({ assets: ASSET_GLOBS }, null, 2));

  try {
    log(osKey, `Building ${target.pkgTarget} -> ${binOut}`);
    const { exec } = await import("@yao-pkg/pkg");
    await exec([
      path.join(REPO_ROOT, "bin", "cli.js"),
      "-c",
      tmpConfigPath,
      "-t",
      target.pkgTarget,
      "-o",
      binOut,
    ]);

    if (target.needsMacSign) {
      if (process.platform === "darwin") {
        log(osKey, "codesign --sign - (ad-hoc; no paid cert available — see GAP_ANALYSIS.md)");
        execFileSync("codesign", ["--sign", "-", binOut], { stdio: "inherit" });
      } else {
        console.warn(
          `[build-binary:${osKey}] WARNING: built on ${process.platform}, not darwin — this binary is COMPLETELY UNSIGNED (not even ad-hoc). ` +
            "It may not launch at all on Apple Silicon (AMFI requires at least an ad-hoc signature). Build on a real macOS host/runner for a distributable artifact."
        );
      }
    }

    if (!target.binName.endsWith(".exe")) fs.chmodSync(binOut, 0o755);
    log(osKey, `Done: ${binOut}`);
    return binOut;
  } finally {
    fs.rmSync(tmpConfigPath, { force: true });
  }
}

// Builds every osKey in `osKeys` (default: every TARGET_MAP entry — a
// reasonable local-dev default since pkg CAN cross-compile all of them
// from one machine; the mac-signing caveat above still applies to both
// `mac` and `mac-arm64`). Returns { [osKey]: binPath }.
export async function buildAll(osKeys = Object.keys(TARGET_MAP)) {
  const results = {};
  for (const osKey of osKeys) {
    const target = resolveTarget(osKey);
    if (!target) throw new Error(`Unknown osKey "${osKey}" (expected one of ${Object.keys(TARGET_MAP).join(", ")})`);
    results[osKey] = await buildOne(osKey, target);
  }
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const requested = process.argv.slice(2);
  buildAll(requested.length ? requested : undefined).catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
