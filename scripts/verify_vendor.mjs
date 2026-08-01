#!/usr/bin/env node
// Verifies src/pptxdiff/vendor/'s on-disk files against
// src/pptxdiff/vendor/manifest.json's recorded provenance (upstream
// package/version/source URL/hash/license per file). This is the
// "repeatable, CI-runnable" version of the one-off manual SRI cross-check
// described in docs/.scrolls/WISDOM.md's vendoring addendum — see
// docs/.scrolls/SECURITY_HARDENING_PLAN.md P1 ticket 6.
//
// Checks, per manifest entry:
//   1. the file exists on disk at the recorded path;
//   2. its sha256 matches the manifest's recorded hash;
//   3. the manifest's hash string also appears in
//      src/pptxdiff/vendor/PROVENANCE.md (catches the human-readable doc
//      silently drifting from the machine-checkable manifest).
// Plus one cross-check specific to React/ReactDOM: support.js already
// hardcodes sha384 SRI hashes for these two files (used for the CDN/lite-
// mode <script integrity="..."> tags) — re-derives sha384 for the vendored
// copies and asserts they match support.js's own constants, proving the
// vendored file and the CDN-served file it lists are still byte-identical.
//
// Exit code 0 on a clean report, 1 if anything doesn't match.
//
// Run: node scripts/verify_vendor.mjs

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PPTXDIFF_DIR = path.join(REPO_ROOT, "src", "pptxdiff");
const MANIFEST_PATH = path.join(PPTXDIFF_DIR, "vendor", "manifest.json");
const PROVENANCE_PATH = path.join(PPTXDIFF_DIR, "vendor", "PROVENANCE.md");
const SUPPORT_JS_PATH = path.join(PPTXDIFF_DIR, "support.js");

function hashFile(absPath, algo) {
  return createHash(algo).update(readFileSync(absPath)).digest("hex");
}

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const provenanceText = existsSync(PROVENANCE_PATH) ? readFileSync(PROVENANCE_PATH, "utf8") : null;
assert(`${PROVENANCE_PATH} exists`, provenanceText !== null);

for (const entry of manifest.files) {
  const absPath = path.join(PPTXDIFF_DIR, entry.file.replace(/^vendor\//, "vendor/"));
  const exists = existsSync(absPath);
  assert(`${entry.file}: file exists on disk`, exists);
  if (!exists) continue;

  const actualHash = hashFile(absPath, manifest.hashAlgorithm || "sha256");
  assert(
    `${entry.file}: ${manifest.hashAlgorithm || "sha256"} matches manifest.json (${entry.sha256.slice(0, 12)}...)`,
    actualHash === entry.sha256
  );

  if (provenanceText !== null) {
    assert(
      `${entry.file}: manifest hash is also documented in PROVENANCE.md (no doc drift)`,
      provenanceText.includes(entry.sha256)
    );
  }
}

// Cross-check: support.js's hardcoded SRI hashes for React/ReactDOM must
// still match the vendored copies (proves CDN and vendored bytes agree).
const supportJs = readFileSync(SUPPORT_JS_PATH, "utf8");
const reactSriMatch = supportJs.match(/REACT_SRI\s*=\s*"sha384-([^"]+)"/);
const reactDomSriMatch = supportJs.match(/REACT_DOM_SRI\s*=\s*"sha384-([^"]+)"/);

assert("support.js defines REACT_SRI", !!reactSriMatch);
assert("support.js defines REACT_DOM_SRI", !!reactDomSriMatch);

if (reactSriMatch) {
  const reactPath = path.join(PPTXDIFF_DIR, "vendor", "react.production.min.js");
  const actualSha384 = Buffer.from(hashFile(reactPath, "sha384"), "hex").toString("base64");
  assert(
    "vendor/react.production.min.js sha384 matches support.js's REACT_SRI (vendored copy == CDN copy support.js pins)",
    actualSha384 === reactSriMatch[1]
  );
}

if (reactDomSriMatch) {
  const reactDomPath = path.join(PPTXDIFF_DIR, "vendor", "react-dom.production.min.js");
  const actualSha384 = Buffer.from(hashFile(reactDomPath, "sha384"), "hex").toString("base64");
  assert(
    "vendor/react-dom.production.min.js sha384 matches support.js's REACT_DOM_SRI (vendored copy == CDN copy support.js pins)",
    actualSha384 === reactDomSriMatch[1]
  );
}

// pptx-renderer.bundle.js compiles in several dependencies beyond the
// top-level @aiden0z/pptx-renderer package (echarts, zrender, tslib, an
// embedded d3.js fragment) — see docs/.scrolls/LICENSE_REVIEW.md. None of
// these get their own manifest.json hash entry (they're not separately
// fetchable files), but their license text must still ship, so check for
// its presence directly rather than relying only on manifest.json coverage.
const bundledSubLicenses = [
  "echarts.LICENSE",
  "echarts.NOTICE",
  "zrender.LICENSE",
  "d3.LICENSE",
  "tslib.LICENSE",
];
for (const name of bundledSubLicenses) {
  const licensePath = path.join(PPTXDIFF_DIR, "vendor", "licenses", name);
  assert(`vendor/licenses/${name}: exists (pptx-renderer.bundle.js sub-dependency license)`, existsSync(licensePath));
}

console.log(`vendor provenance check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All vendor provenance checks passed (GREEN).");
}
