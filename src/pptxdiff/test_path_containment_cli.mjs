#!/usr/bin/env node
// Red/Green regression check for the CLI's static-file path containment.
//
// bin/cli.js used to gate served files with `filePath.startsWith(ROOT)`, a
// raw string-prefix check. Two known weaknesses (per
// docs/.scrolls/SECURITY_HARDENING_PLAN.md P0 ticket 3):
//   (a) a sibling directory that merely shares ROOT's prefix (e.g.
//       ROOT=/app/src/pptxdiff vs. /app/src/pptxdiff-evil) would pass the
//       prefix check despite not being inside ROOT;
//   (b) path.normalize() alone does not canonicalize symlinks.
// This test asserts:
//   1. the pure `isPathContained(root, candidate)` helper correctly
//      classifies: root itself, a real subdir/file, a sibling-prefix path
//      (must reject — this is exactly what a raw startsWith() check gets
//      wrong), a parent directory, and an unrelated absolute path;
//   2. the real, spawned CLI still serves ordinary files (/, /support.js,
//      /sample-pptx.js) with 200;
//   3. the real, spawned CLI still never leaks a 200 for ordinary "../"
//      traversal or URL-encoded traversal (%2e%2e%2f) requests. Verified
//      empirically that both the pre-fix AND post-fix code return 404 (not
//      403) for these specific payloads — path.normalize()'s absolute-path
//      clamping plus path.join()'s non-absolute-resetting join already
//      collapse them to a path that's safely inside ROOT but doesn't
//      exist, for THIS call site's particular construction, independent of
//      which containment check gates it. So this is a "never regresses to
//      200" guard, not evidence the old check was exploitable here — the
//      real behavioral difference this ticket closes is the sibling-prefix
//      case, which IS a genuine startsWith()-vs-path.relative() divergence
//      and is asserted directly against isPathContained() above.
// Not tested (documented-only, per the ticket's own carve-out): a symlink
// inside ROOT pointing outside it. path.resolve() does not canonicalize
// symlinks, so this residual gap is real but not something this pure
// function (or a portable, sandbox-safe test) can close.
//
// Run: node src/pptxdiff/test_path_containment_cli.mjs

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import http from "node:http";
import path from "node:path";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(DIR, "..", "..", "bin", "cli.js");

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
}

// --- 1. Pure isPathContained() unit assertions ---

let mod;
let importError = null;
try {
  mod = await import(path.join(DIR, "..", "..", "bin", "cli.js"));
} catch (e) {
  importError = e;
}

assert("bin/cli.js can be imported without starting a server (guards its own execution)", importError === null);
assert("bin/cli.js exports isPathContained for unit testing", !!mod && typeof mod.isPathContained === "function");

if (mod && typeof mod.isPathContained === "function") {
  const { isPathContained } = mod;
  const ROOT = "/app/src/pptxdiff";

  assert("root itself is contained", isPathContained(ROOT, ROOT) === true);
  assert("an ordinary subpath is contained", isPathContained(ROOT, "/app/src/pptxdiff/index.html") === true);
  assert(
    "a nested subpath is contained",
    isPathContained(ROOT, "/app/src/pptxdiff/vendor/react.js") === true
  );
  assert(
    "a sibling directory sharing ROOT's prefix is NOT contained (the exact bug a raw startsWith() check has)",
    isPathContained(ROOT, "/app/src/pptxdiff-evil/secret.txt") === false
  );
  assert(
    "a sibling directory sharing ROOT's prefix with no separator at all is NOT contained",
    isPathContained(ROOT, "/app/src/pptxdiffsomethingelse") === false
  );
  assert("the parent directory is NOT contained", isPathContained(ROOT, "/app/src") === false);
  assert(
    "an unrelated absolute path is NOT contained",
    isPathContained(ROOT, "/etc/passwd") === false
  );
  assert(
    "a path that normalizes back to ROOT via internal '..' segments is contained",
    isPathContained(ROOT, "/app/src/pptxdiff/sub/../index.html") === true
  );
}

// --- 2 & 3. Real spawned-CLI HTTP behavior ---

function runCli() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI], { env: process.env });
    let out = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("timed out waiting for CLI to print its URL"));
    }, 8000);

    child.stdout.on("data", (chunk) => {
      out += chunk.toString();
      const m = out.match(/pptxdiff running at http:\/\/localhost:(\d+)/);
      if (m) {
        clearTimeout(timeout);
        resolve({ child, port: Number(m[1]) });
      }
    });
    child.stderr.on("data", () => {});
    child.on("error", (e) => {
      clearTimeout(timeout);
      reject(e);
    });
  });
}

function get(port, rawPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: rawPath }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", reject);
  });
}

const { child, port } = await runCli();

try {
  assert("GET / returns 200", (await get(port, "/")) === 200);
  assert("GET /support.js returns 200", (await get(port, "/support.js")) === 200);
  assert("GET /sample-pptx.js returns 200", (await get(port, "/sample-pptx.js")) === 200);

  assert(
    "GET /../../../etc/passwd (ordinary traversal) never returns 200",
    (await get(port, "/../../../etc/passwd")) !== 200
  );
  assert(
    "GET /..%2f..%2f..%2fetc%2fpasswd (URL-encoded traversal) never returns 200",
    (await get(port, "/..%2f..%2f..%2fetc%2fpasswd")) !== 200
  );
  assert(
    "GET /%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd (fully-encoded traversal) never returns 200",
    (await get(port, "/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd")) !== 200
  );
  assert(
    "GET /../pptxdiff-evil/secret.txt (sibling-prefix escape attempt) never returns 200",
    (await get(port, "/../pptxdiff-evil/secret.txt")) !== 200
  );
} finally {
  child.kill();
}

console.log(`path-containment CLI check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All path-containment CLI checks passed (GREEN).");
}
