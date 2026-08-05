#!/usr/bin/env node
"use strict";

// Real, slow, current-platform-only end-to-end check: actually runs
// buildBinary() (the same code `node build.mjs` runs), then spawns the
// REAL packaged executable it produced and drives it over real HTTP —
// same spirit as pptxdiff-cli's *_e2e.mjs files (real browser, real
// spawned process) rather than mocking any of this. Deliberately kept out
// of the default `npm test` (this alone takes well over a minute and
// produces a ~100MB+ binary) — run explicitly via `npm run test:e2e`,
// mirroring pptxdiff-cli's `test:difftool` split for the same reason
// (a slow/heavy check that needs real platform resources).
//
// Only exercises the CURRENT host's platform branch (Node SEA has no
// cross-platform build mode — see build.mjs's header comment) — the other
// two OS branches are structurally identical but only really exercised by
// CI's 3-OS matrix (.github/workflows/binaries.yml).
//
// Run: node test_build_e2e.mjs

import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildBinary, resolveTarget } from "./build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pass = 0;
let fail = 0;
function assert(name, cond) {
  if (cond) {
    pass++;
    console.log(`ok - ${name}`);
  } else {
    fail++;
    console.error(`FAIL: ${name}`);
  }
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      })
      .on("error", reject);
  });
}

function waitForLine(child, matcher, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buf = "";
    const onData = (chunk) => {
      buf += chunk.toString();
      const m = buf.match(matcher);
      if (m) {
        cleanup();
        resolve(m);
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${matcher} in output:\n${buf}`));
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      child.stdout.off("data", onData);
    }
    child.stdout.on("data", onData);
  });
}

async function main() {
  const target = resolveTarget(process.platform);
  if (!target) {
    console.error(`No SEA build mapping for process.platform=${process.platform} — nothing to e2e-test here.`);
    process.exitCode = 1;
    return;
  }

  console.log(`Building a real ${target.osKey} binary (this takes a while)...`);
  const { outDir, binPath, zipPath } = await buildBinary(target);

  assert("build produced the binary file", fs.existsSync(binPath));
  assert("build produced the assets folder", fs.existsSync(path.join(outDir, "assets", "index.html")));
  assert("build produced the zip artifact", fs.existsSync(zipPath));
  if (!target.isWin) {
    const mode = fs.statSync(binPath).mode;
    assert("binary is executable (owner +x bit set)", Boolean(mode & 0o100));
  }

  // Actually run the packaged binary and talk to it over real HTTP —
  // proves the assets/-folder-next-to-the-executable resolution (sea-entry.cjs's
  // `path.dirname(process.execPath)` logic) genuinely works, not just that
  // the files exist on disk in the right place.
  const child = execFile(binPath, { cwd: outDir, env: {} });
  let urlMatch;
  try {
    urlMatch = await waitForLine(child, /pptxdiff running at (http:\/\/localhost:\d+)/, 15000);
  } catch (e) {
    console.error("Binary never printed its startup line:", e.message);
    child.kill();
    fail++;
    reportAndExit();
    return;
  }
  const baseUrl = urlMatch[1];
  assert("binary printed a startup URL", Boolean(baseUrl));

  try {
    const index = await fetchText(`${baseUrl}/`);
    assert("GET / returns 200", index.status === 200);
    assert("GET / body looks like the real app shell", index.body.includes("<x-dc>") && index.body.includes('src="./support.js"'));

    const supportJs = await fetchText(`${baseUrl}/support.js`);
    assert("GET /support.js returns 200", supportJs.status === 200);
    assert("GET /support.js has JS content-type", (supportJs.headers["content-type"] || "").includes("javascript"));

    const vendorFile = await fetchText(`${baseUrl}/vendor/react.production.min.js`);
    assert("GET /vendor/react.production.min.js returns 200 (assets/ folder is actually being served)", vendorFile.status === 200);

    // Path-containment regression check against THIS root (assets/), not
    // just bin/cli.js's default ROOT — a different `root` value is exactly
    // what this whole feature changed, so re-prove isPathContained still
    // applies to it rather than assuming it does because it's "the same
    // function."
    const traversal = await fetchText(`${baseUrl}/../../../etc/passwd`);
    assert("path traversal against the packaged binary's assets root is rejected (403 or 404, never 200)", traversal.status !== 200);
  } finally {
    child.kill();
  }

  reportAndExit();

  function reportAndExit() {
    console.log(`build-e2e check: ${pass}/${pass + fail} passed`);
    if (fail > 0) {
      console.error(`${fail} check(s) FAILED (RED).`);
      process.exitCode = 1;
    } else {
      console.log("All build-e2e checks passed (GREEN).");
    }
    // Clean up the built artifact afterward — this test's job is to prove
    // the build+run path works, not to leave a ~100MB+ binary lying around.
    // Only removes what THIS build generated (binary/assets/zip), not the
    // whole outDir — that folder also holds the tracked README.md/
    // CHANGELOG.md, which a blind `rm -rf` would delete too.
    fs.rmSync(binPath, { force: true });
    fs.rmSync(path.join(outDir, "assets"), { recursive: true, force: true });
    for (const entry of fs.readdirSync(outDir)) {
      if (entry.endsWith(".zip")) fs.rmSync(path.join(outDir, entry), { force: true });
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
