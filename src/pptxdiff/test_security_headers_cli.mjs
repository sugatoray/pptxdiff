#!/usr/bin/env node
// Red/Green regression check for the CLI's response security headers.
//
// docs/.scrolls/SECURITY_HARDENING_PLAN.md P0->P1 ticket 4: bin/cli.js's
// server.writeHead(...) calls didn't set X-Content-Type-Options: nosniff
// or any Cache-Control header on any response. This spawns the real CLI
// and asserts every response — a normal 200 file serve, a 403 (blocked
// path-containment), and a 404 (missing file) — carries:
//   - X-Content-Type-Options: nosniff
//   - a non-caching Cache-Control directive (no-store)
//
// Run: node src/pptxdiff/test_security_headers_cli.mjs

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
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers }));
    });
    req.on("error", reject);
  });
}

function assertHardenedHeaders(label, headers) {
  assert(
    `${label}: X-Content-Type-Options: nosniff is set`,
    headers["x-content-type-options"] === "nosniff"
  );
  assert(
    `${label}: Cache-Control is set to a non-caching directive`,
    typeof headers["cache-control"] === "string" &&
      /no-store|no-cache/i.test(headers["cache-control"])
  );
}

const { child, port } = await runCli();

try {
  const ok = await get(port, "/");
  assert("GET / returns 200", ok.status === 200);
  assertHardenedHeaders("GET / (200)", ok.headers);

  const okJs = await get(port, "/support.js");
  assert("GET /support.js returns 200", okJs.status === 200);
  assertHardenedHeaders("GET /support.js (200)", okJs.headers);

  const forbidden = await get(port, "/../../../etc/hostname");
  assertHardenedHeaders(`GET /../../../etc/hostname (${forbidden.status})`, forbidden.headers);

  const notFound = await get(port, "/definitely-does-not-exist.html");
  assert("GET /definitely-does-not-exist.html returns 404", notFound.status === 404);
  assertHardenedHeaders("GET /definitely-does-not-exist.html (404)", notFound.headers);
} finally {
  child.kill();
}

console.log(`security-headers CLI check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All security-headers CLI checks passed (GREEN).");
}
