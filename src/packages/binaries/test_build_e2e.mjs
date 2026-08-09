#!/usr/bin/env node
"use strict";

// Real, slow, current-platform-only end-to-end check: actually calls
// buildOne() for the CURRENT host's OS (the same code `node build.mjs`
// runs), then spawns the REAL resulting single-file executable and drives
// it over real HTTP. Deliberately kept out of the default `npm test` (a
// real pkg build downloads/uses a base binary and takes a while) — run via
// `npm run test:e2e`, same split as pptxdiff-cli's `test:difftool`.
//
// Only exercises the CURRENT host's own platform+arch target — every other
// target is structurally identical (same buildOne(), only the mac
// codesign branch differs) but only actually built-and-run by CI's
// linux+win / macos-specific jobs (see .github/workflows/binaries.yml and
// build.mjs's header comment for why neither mac target is cross-built
// there). Picks the `-arm64` variant of whatever OS it's running on when
// the HOST's actual `os.arch()` is arm64, so an Apple-Silicon macOS
// runner (GitHub's macos-latest, as of 2024) or an arm64 Linux/Windows
// runner genuinely exercises the native build, not the x64 one.
//
// Run: node test_build_e2e.mjs

import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildOne, resolveTarget } from "./build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function hostOsKey() {
  const isArm64 = os.arch() === "arm64";
  if (process.platform === "win32") return isArm64 ? "win-arm64" : "win";
  if (process.platform === "linux") return isArm64 ? "linux-arm64" : "linux";
  if (process.platform === "darwin") return isArm64 ? "mac-arm64" : "mac";
  return null;
}

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
  const osKey = hostOsKey();
  const target = osKey && resolveTarget(osKey);
  if (!target) {
    console.error(`No target mapping for process.platform=${process.platform}/${os.arch()} — nothing to e2e-test here.`);
    process.exitCode = 1;
    return;
  }

  console.log(`Building a real ${osKey} binary via @yao-pkg/pkg (this takes a while, downloads a base binary on first run)...`);
  const binPath = await buildOne(osKey, target);

  assert("build produced the binary file", fs.existsSync(binPath));
  assert("no separate assets/ folder needed (pkg embeds them in the one file)", !fs.existsSync(path.join(path.dirname(binPath), "assets")));
  if (!target.binName.endsWith(".exe")) {
    const mode = fs.statSync(binPath).mode;
    assert("binary is executable (owner +x bit set)", Boolean(mode & 0o100));
  }

  // Actually run the packaged binary and talk to it over real HTTP — proves
  // pkg's snapshot filesystem genuinely satisfies bin/cli.js's UNMODIFIED
  // `ROOT = path.join(__dirname, "..", "src", "pptxdiff")` resolution, not
  // just that files exist somewhere inside the binary.
  const child = execFile(binPath, { cwd: os.tmpdir(), env: {} });
  let urlMatch;
  try {
    urlMatch = await waitForLine(child, /pptxdiff running at (http:\/\/localhost:\d+)/, 20000);
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
    assert("GET /vendor/react.production.min.js returns 200 (embedded vendor/ assets are actually being served)", vendorFile.status === 200);

    const traversal = await fetchText(`${baseUrl}/../../../etc/passwd`);
    assert("path traversal against the packaged binary is rejected (never 200)", traversal.status !== 200);
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
    // Clean up the built binary afterward — this test's job is to prove
    // the build+run path works, not to leave a ~70MB+ binary lying around.
    // Only removes the binary itself, never the tracked README.md/
    // CHANGELOG.md that live in the same per-OS folder.
    fs.rmSync(binPath, { force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
