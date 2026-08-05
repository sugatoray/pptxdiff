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

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const PKG_VERSION = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")).version;

const PLATFORM_MAP = {
  win32: { osKey: "win", binName: "pptxdiff-win.exe", isWin: true, isMac: false },
  darwin: { osKey: "mac", binName: "pptxdiff-mac", isWin: false, isMac: true },
  linux: { osKey: "linux", binName: "pptxdiff-linux", isWin: false, isMac: false },
};

const target = PLATFORM_MAP[process.platform];
if (!target) {
  console.error(`No SEA build mapping for process.platform=${process.platform} (supported: win32, darwin, linux).`);
  process.exitCode = 1;
  process.exit();
}

const OUT_DIR = path.join(__dirname, `pptxdiff-${target.osKey}`);
const BUILD_TMP = path.join(__dirname, ".build");
const ASSETS_OUT = path.join(OUT_DIR, "assets");
const BIN_OUT = path.join(OUT_DIR, target.binName);

// Same subset root package.json's "files" ships to npm — the exact set of
// static files bin/cli.js's server actually reads from ROOT.
const ASSET_ENTRIES = [
  ["src/pptxdiff/index.html", "index.html"],
  ["src/pptxdiff/support.js", "support.js"],
  ["src/pptxdiff/sample-pptx.js", "sample-pptx.js"],
  ["src/pptxdiff/vendor", "vendor"],
];

function log(msg) {
  console.log(`[build-binary:${target.osKey}] ${msg}`);
}

function run(cmd, args, opts = {}) {
  log(`$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { stdio: "inherit", ...opts });
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
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

async function main() {
  log(`Building for ${process.platform} -> ${OUT_DIR}`);
  cleanDir(OUT_DIR);
  cleanDir(BUILD_TMP);

  // 1. Bundle sea-entry.cjs (which itself inlines bin/cli.js's exports) into
  //    a single flat CommonJS file — SEA's `main` must be one self-contained
  //    file; it does not resolve a script's own `require("./other-file")`
  //    calls at runtime.
  const esbuild = await import("esbuild");
  const bundlePath = path.join(BUILD_TMP, "bundle.cjs");
  await esbuild.build({
    entryPoints: [path.join(__dirname, "sea-entry.cjs")],
    outfile: bundlePath,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
  });

  // 2. Generate the SEA config + blob.
  const seaConfigPath = path.join(BUILD_TMP, "sea-config.json");
  const blobPath = path.join(BUILD_TMP, "sea-prep.blob");
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
  run(process.execPath, ["--experimental-sea-config", seaConfigPath]);

  // 3. Copy the currently-running node executable as the base, then inject
  //    the blob into it.
  fs.copyFileSync(process.execPath, BIN_OUT);
  fs.chmodSync(BIN_OUT, 0o755);

  if (target.isMac) {
    // Required by Node's SEA guide: an existing signature on the copied
    // node binary must be removed before injecting, or postject's write
    // corrupts it.
    run("codesign", ["--remove-signature", BIN_OUT]);
  }

  run("npx", [
    "--no-install",
    "postject",
    BIN_OUT,
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
    run("codesign", ["--sign", "-", BIN_OUT]);
  }
  if (!target.isWin) fs.chmodSync(BIN_OUT, 0o755);

  // 4. Copy the static app assets the server reads from `root`.
  fs.mkdirSync(ASSETS_OUT, { recursive: true });
  for (const [srcRel, destRel] of ASSET_ENTRIES) {
    const src = path.join(REPO_ROOT, srcRel);
    const dest = path.join(ASSETS_OUT, destRel);
    fs.cpSync(src, dest, { recursive: true });
  }

  // 5. Zip the binary + assets together as the actual downloadable artifact.
  const zipPath = path.join(OUT_DIR, `pptxdiff-${target.osKey}-${PKG_VERSION}.zip`);
  await zipDir(OUT_DIR, zipPath);

  fs.rmSync(BUILD_TMP, { recursive: true, force: true });
  log(`Done: ${BIN_OUT}`);
  log(`Done: ${zipPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
