#!/usr/bin/env node
"use strict";

// Builds a standalone native pptxdiff executable for the CURRENT host OS
// using Node's Single Executable Applications (SEA) feature, and drops it
// (plus the static app files it serves, plus a zip of both) into
// src/packages/binaries/pptxdiff-<win|mac|linux>/.
//
// Node SEA has no supported cross-platform mode: a SEA binary is built by
// injecting a JS blob into a COPY OF THE CURRENTLY RUNNING node executable
// (process.execPath). Building all three platforms' binaries therefore
// means running this script once per OS — see .github/workflows/binaries.yml
// for a CI matrix (ubuntu-latest/macos-latest/windows-latest) that does
// exactly that. There is no attempt here to fake cross-compilation.
//
// No code-signing certificate is available (or in scope — see
// docs/.scrolls/GAP_CONTEXT.md), so the macOS binary is only ad-hoc signed
// (runs locally, still triggers Gatekeeper's "unidentified developer"
// warning on a freshly-downloaded copy) and the Windows .exe is unsigned
// (triggers a SmartScreen warning). Documented, not silently hidden.
//
// PLATFORM_MAP/ASSET_ENTRIES/resolveTarget are exported (pure, no side
// effects) so test_build_config.mjs can assert on them without triggering
// a real build; buildBinary() is exported so test_build_e2e.mjs can run a
// real build for the current platform and drive the actual output binary.
// The entrypoint guard below (same pattern as capture_screenshots.mjs —
// see WISDOM.md) means importing this module never runs a build as a side
// effect — only `node build.mjs` (or an explicit buildBinary() call) does.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

export const PLATFORM_MAP = {
  win32: { osKey: "win", binName: "pptxdiff-win.exe", isWin: true, isMac: false },
  darwin: { osKey: "mac", binName: "pptxdiff-mac", isWin: false, isMac: true },
  linux: { osKey: "linux", binName: "pptxdiff-linux", isWin: false, isMac: false },
};

// Same subset root package.json's "files" ships to npm — the exact set of
// static files bin/cli.js's server actually reads from ROOT.
export const ASSET_ENTRIES = [
  ["src/pptxdiff/index.html", "index.html"],
  ["src/pptxdiff/support.js", "support.js"],
  ["src/pptxdiff/sample-pptx.js", "sample-pptx.js"],
  ["src/pptxdiff/vendor", "vendor"],
];

// Pure: `platform` -> PLATFORM_MAP entry, or null if unsupported.
export function resolveTarget(platform) {
  return PLATFORM_MAP[platform] || null;
}

function log(osKey, msg) {
  console.log(`[build-binary:${osKey}] ${msg}`);
}

function run(osKey, cmd, args, opts = {}) {
  log(osKey, `$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { stdio: "inherit", ...opts });
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

// Removes only what a previous build.mjs run generated inside an OS folder
// (the binary, the copied assets/ folder, any zip artifacts) — NOT a blind
// `rm -rf` of the whole folder, which would also delete the tracked
// README.md/CHANGELOG.md that live there. Safe to call whether or not a
// prior build has ever run (nothing to remove on a fresh clone).
function cleanGeneratedOutDir(outDir, target) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.rmSync(path.join(outDir, target.binName), { force: true });
  fs.rmSync(path.join(outDir, "assets"), { recursive: true, force: true });
  for (const entry of fs.readdirSync(outDir)) {
    if (entry.endsWith(".zip")) fs.rmSync(path.join(outDir, entry), { force: true });
  }
}

async function zipDir(dir, outZipPath) {
  const zip = new JSZip();
  const walk = (abs, rel) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const absChild = path.join(abs, entry.name);
      const relChild = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(absChild, relChild);
      else zip.file(relChild, fs.readFileSync(absChild));
    }
  };
  walk(dir, "");
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(outZipPath, buf);
}

// Builds the given PLATFORM_MAP `target` (must match the CURRENT
// process.platform — SEA injects into a copy of the running node binary,
// it cannot target a different OS). Returns {outDir, binPath, zipPath}.
export async function buildBinary(target) {
  const PKG_VERSION = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")).version;
  const outDir = path.join(__dirname, `pptxdiff-${target.osKey}`);
  const buildTmp = path.join(__dirname, ".build");
  const assetsOut = path.join(outDir, "assets");
  const binOut = path.join(outDir, target.binName);

  log(target.osKey, `Building for ${process.platform} -> ${outDir}`);
  cleanGeneratedOutDir(outDir, target);
  cleanDir(buildTmp);

  // 1. Bundle sea-entry.cjs (which itself inlines bin/cli.js's exports) into
  //    a single flat CommonJS file — SEA's `main` must be one self-contained
  //    file; it does not resolve a script's own `require("./other-file")`
  //    calls at runtime.
  const esbuild = await import("esbuild");
  const bundlePath = path.join(buildTmp, "bundle.cjs");
  await esbuild.build({
    entryPoints: [path.join(__dirname, "sea-entry.cjs")],
    outfile: bundlePath,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
  });

  // 2. Generate the SEA config + blob.
  const seaConfigPath = path.join(buildTmp, "sea-config.json");
  const blobPath = path.join(buildTmp, "sea-prep.blob");
  fs.writeFileSync(
    seaConfigPath,
    JSON.stringify(
      {
        main: bundlePath,
        output: blobPath,
        disableExperimentalSEAWarning: true,
      },
      null,
      2
    )
  );
  run(target.osKey, process.execPath, ["--experimental-sea-config", seaConfigPath]);

  // 3. Copy the currently-running node executable as the base, then inject
  //    the blob into it.
  fs.copyFileSync(process.execPath, binOut);
  fs.chmodSync(binOut, 0o755);

  if (target.isMac) {
    // Required by Node's SEA guide: an existing signature on the copied
    // node binary must be removed before injecting, or postject's write
    // corrupts it.
    run(target.osKey, "codesign", ["--remove-signature", binOut]);
  }

  run(target.osKey, "npx", [
    "--no-install",
    "postject",
    binOut,
    "NODE_SEA_BLOB",
    blobPath,
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
    ...(target.isMac ? ["--macho-segment-name", "NODE_SEA"] : []),
  ]);

  if (target.isMac) {
    // Ad-hoc signature (no cert) so the binary can run locally at all;
    // Gatekeeper still warns on a freshly-downloaded copy — see the file
    // header comment and GAP_ANALYSIS.md.
    run(target.osKey, "codesign", ["--sign", "-", binOut]);
  }
  if (!target.isWin) fs.chmodSync(binOut, 0o755);

  // 4. Copy the static app assets the server reads from `root`.
  fs.mkdirSync(assetsOut, { recursive: true });
  for (const [srcRel, destRel] of ASSET_ENTRIES) {
    const src = path.join(REPO_ROOT, srcRel);
    const dest = path.join(assetsOut, destRel);
    fs.cpSync(src, dest, { recursive: true });
  }

  // 5. Zip the binary + assets together as the actual downloadable artifact.
  const zipPath = path.join(outDir, `pptxdiff-${target.osKey}-${PKG_VERSION}.zip`);
  await zipDir(outDir, zipPath);

  fs.rmSync(buildTmp, { recursive: true, force: true });
  log(target.osKey, `Done: ${binOut}`);
  log(target.osKey, `Done: ${zipPath}`);
  return { outDir, binPath: binOut, zipPath };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = resolveTarget(process.platform);
  if (!target) {
    console.error(`No SEA build mapping for process.platform=${process.platform} (supported: win32, darwin, linux).`);
    process.exitCode = 1;
  } else {
    buildBinary(target).catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
  }
}
