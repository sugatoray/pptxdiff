"use strict";

// Vendors the static pptxdiff app into ./media so the packaged .vsix is
// self-contained — vsce runs this via "vscode:prepublish" before packaging.
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "..", "..", "pptxdiff");
const ASSETS = path.join(__dirname, "..", "..", "..", "docs", "assets");
const DEST = path.join(__dirname, "media");
const APP_FILES = ["index.html", "support.js", "sample-pptx.js"];
const ASSET_FILES = [
  "pptxdiff_logo.png",
  "pptxdiff_banner.png",
  "pptxdiff_demo_1_allpairs.png",
  "sample_before.pptx",
  "sample_after.pptx",
  "icon.png",
];

fs.mkdirSync(DEST, { recursive: true });
for (const file of APP_FILES) {
  fs.copyFileSync(path.join(SRC, file), path.join(DEST, file));
}
for (const file of ASSET_FILES) {
  fs.copyFileSync(path.join(ASSETS, file), path.join(DEST, file));
}
// index.html loads React/ReactDOM/Babel/JSZip/pptx-renderer/fonts from
// ./vendor/ by default (offline-first; ?lite=1 opts into CDN instead) — the
// vsix must ship that directory or the packaged extension can't boot.
fs.cpSync(path.join(SRC, "vendor"), path.join(DEST, "vendor"), { recursive: true });
console.log(
  `pptxdiff-vscode: copied ${APP_FILES.length + ASSET_FILES.length} files + vendor/ into ${path.relative(process.cwd(), DEST)}`,
);
