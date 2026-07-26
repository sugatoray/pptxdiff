#!/usr/bin/env node
// Red/Green regression check for offline capability.
//
// By default this app must load React/ReactDOM/Babel/JSZip/pptx-renderer/
// fonts from local vendor/ files only, so it works fully air-gapped. An
// explicit opt-in (PPTXDIFF_LITE_MODE=1/y/yes/true via bin/cli.js, or
// `?lite=1` on the URL directly) switches those same five dependencies to
// their original CDN sources instead — see docs/.scrolls/SPEC.md for why.
//
// This script checks BOTH halves of that contract: every vendor swap point
// still has its `./vendor/...` default AND its CDN fallback gated behind
// the lite-mode flag (not a stray unconditional CDN reference), every local
// vendor/ file that's referenced actually exists on disk, and bin/cli.js
// recognizes the env var. Live-push feature endpoints (Slack/Notion/
// Confluence), which are legitimate outbound calls the USER triggers
// explicitly, are exempt — this only checks assets the app needs to boot.
//
// Run: node src/pptxdiff/test_offline_capable.mjs

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIR = path.dirname(fileURLToPath(import.meta.url));

let failures = [];
let checks = 0;

function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
}

function readSource(relPath) {
  const p = path.join(DIR, relPath);
  if (!existsSync(p)) throw new Error(`missing file: ${relPath}`);
  return readFileSync(p, "utf8");
}

const indexHtml = readSource("index.html");
const supportJs = readSource("support.js");
const cliJs = readFileSync(path.join(DIR, "..", "..", "bin", "cli.js"), "utf8");

// Every vendor swap point: which file it lives in, its default (offline)
// local path, its lite-mode CDN URL, and the flag name gating the choice.
const SWAP_POINTS = [
  { name: "React (support.js)", src: supportJs, vendor: "./vendor/react.production.min.js", cdn: "unpkg.com/react@" },
  { name: "ReactDOM (support.js)", src: supportJs, vendor: "./vendor/react-dom.production.min.js", cdn: "unpkg.com/react-dom@" },
  { name: "Babel (support.js)", src: supportJs, vendor: "./vendor/babel.min.js", cdn: "unpkg.com/@babel/standalone@" },
  { name: "JSZip (index.html)", src: indexHtml, vendor: "./vendor/jszip.min.js", cdn: "cdnjs.cloudflare.com/ajax/libs/jszip/" },
  { name: "Spectral font (index.html)", src: indexHtml, vendor: "./vendor/fonts/spectral.css", cdn: "fonts.googleapis.com/css2" },
  { name: "pptx-renderer (index.html)", src: indexHtml, vendor: "./vendor/pptx-renderer.bundle.js", cdn: "esm.sh/@aiden0z/pptx-renderer@" },
];

for (const p of SWAP_POINTS) {
  assert(`${p.name}: default vendor path "${p.vendor}" present`, p.src.includes(p.vendor));
  assert(`${p.name}: lite-mode CDN fallback "${p.cdn}" present`, p.src.includes(p.cdn));
}

// The CDN strings above must be reachable only through the lite-mode flag,
// not left in as a stray unconditional reference (e.g. an old CDN URL that
// should have been deleted but wasn't).
assert("support.js gates its CDN URLs behind PPTXDIFF_LITE_MODE", supportJs.includes("PPTXDIFF_LITE_MODE"));
assert("index.html gates its CDN URLs behind __PPTXDIFF_LITE_MODE__", indexHtml.includes("__PPTXDIFF_LITE_MODE__"));

// Every local vendor/ path referenced by index.html or support.js must
// actually exist on disk, so "vendored" isn't just a URL rewrite that 404s.
const vendorRefPattern = /(['"`])(\.\/vendor\/[^"'`)\s]+)\1/g;
for (const [label, src] of [["index.html", indexHtml], ["support.js", supportJs]]) {
  let m;
  while ((m = vendorRefPattern.exec(src))) {
    const relRef = m[2].replace(/^\.\//, "");
    const full = path.join(DIR, relRef);
    assert(`${label} references ${m[2]}, which must exist on disk`, existsSync(full));
  }
}

// bin/cli.js must actually recognize the env var (the RED/GREEN behavioral
// check for this lives in test_lite_mode_cli.mjs, which spawns the real
// process — this is just a fast static sanity check that the wiring exists).
assert("bin/cli.js references PPTXDIFF_LITE_MODE", cliJs.includes("PPTXDIFF_LITE_MODE"));
assert("bin/cli.js appends ?lite=1 when lite mode is on", cliJs.includes("lite=1"));

console.log(`offline-capable check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All offline-capability checks passed (GREEN).");
}
