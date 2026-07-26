#!/usr/bin/env node
// Red/Green regression check for offline capability.
//
// Scans this app's own served files (index.html, support.js) for references
// to external CDN hosts. The app must load React/ReactDOM/Babel/JSZip/the
// pptx-renderer library and fonts from local vendor/ files only, so it works
// fully air-gapped. Live-push feature endpoints (Slack/Notion/Confluence),
// which are legitimate outbound calls the USER triggers explicitly, are
// exempt — this only checks for CDN asset hosts the app needs just to boot.
//
// Run: node src/pptxdiff/test_offline_capable.mjs

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIR = path.dirname(fileURLToPath(import.meta.url));

const CDN_ASSET_HOSTS = [
  "unpkg.com",
  "esm.sh",
  "cdnjs.cloudflare.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "jsdelivr.net",
  "cdn.jsdelivr.net",
  "unpkg.dev",
];

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

for (const host of CDN_ASSET_HOSTS) {
  assert(`index.html must not reference ${host}`, !indexHtml.includes(host));
  assert(`support.js must not reference ${host}`, !supportJs.includes(host));
}

// Every local vendor/ path referenced by index.html or support.js must
// actually exist on disk, so "vendored" isn't just a URL rewrite that 404s.
const vendorRefPattern = /(?:src=["']|['"`])(\.\/vendor\/[^"'`)\s]+)["'`)]/g;
for (const [label, src] of [["index.html", indexHtml], ["support.js", supportJs]]) {
  let m;
  while ((m = vendorRefPattern.exec(src))) {
    const relRef = m[1].replace(/^\.\//, "");
    const full = path.join(DIR, relRef);
    assert(`${label} references ${m[1]}, which must exist on disk`, existsSync(full));
  }
}

console.log(`offline-capable check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All offline-capability checks passed (GREEN).");
}
