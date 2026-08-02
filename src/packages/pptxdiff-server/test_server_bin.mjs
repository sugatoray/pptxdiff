#!/usr/bin/env node
// Red/Green regression check for bin/pptxdiff-server.js itself — its pure
// parseArgs() (unit-level) AND a real spawn of the actual entrypoint as a
// child process (proving the full wiring: argv -> startServer() -> a real
// listening server -> the printed URL -> a real HTTP request against it).
// Before this file, bin/pptxdiff-server.js had ZERO test coverage —
// test_server_unit.mjs/test_server_e2e.mjs only ever imported lib/server.js
// directly, never the bin/ entrypoint that's actually what a user runs.
//
// Run: node src/packages/pptxdiff-server/test_server_bin.mjs

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(DIR, "bin", "pptxdiff-server.js");
const { parseArgs, USAGE } = await import(`file://${BIN}`);

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
  else console.log(`  ok — ${label}`);
}

console.log("1. parseArgs (pure)");
{
  const defaults = parseArgs([]);
  assert("defaults to port 0 (OS-assigned) and host 127.0.0.1", defaults.port === 0 && defaults.host === "127.0.0.1");
  assert("parses --port", parseArgs(["--port", "5000"]).port === 5000);
  assert("parses --host", parseArgs(["--host", "0.0.0.0"]).host === "0.0.0.0");
  assert("rejects a non-numeric --port", !!parseArgs(["--port", "nope"]).error);
  assert("rejects a negative --port", !!parseArgs(["--port", "-1"]).error);
  assert("rejects an unknown flag", !!parseArgs(["--bogus"]).error);
  assert("--help sets the help flag", parseArgs(["--help"]).help === true);
  assert("-h is a synonym for --help", parseArgs(["-h"]).help === true);
  assert("USAGE mentions --host and --port", USAGE.includes("--host") && USAGE.includes("--port"));
}

function run(args, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], { env: process.env });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`timed out waiting for bin/pptxdiff-server.js (args: ${JSON.stringify(args)})`));
    }, timeoutMs);
    child.stdout.on("data", (c) => (stdout += c));
    child.stderr.on("data", (c) => (stderr += c));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    resolve.child = child;
  });
}

function runUntilListening() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN], { env: process.env });
    let out = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("timed out waiting for pptxdiff-server to print its URL"));
    }, 8000);
    child.stdout.on("data", (chunk) => {
      out += chunk.toString();
      const m = out.match(/pptxdiff-server listening at (http:\/\/127\.0\.0\.1:\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ child, url: m[1] });
      }
    });
    child.on("error", reject);
  });
}

console.log("2. real spawn: starts, prints its URL, serves health and docs routes");
{
  const { child, url } = await runUntilListening();
  try {
    const r = await fetch(`${url}/v1/health`);
    assert("the real spawned server answers /v1/health with 200", r.status === 200);
    const body = await r.json();
    assert("health body reports ok status", body.status === "ok");

    const specRes = await fetch(`${url}/openapi.json`);
    assert("the real spawned server answers /openapi.json with 200", specRes.status === 200);
    const spec = await specRes.json();
    assert("spawned openapi spec includes /docs", !!(spec.paths && spec.paths["/docs"]));

    const docsRes = await fetch(`${url}/docs`);
    assert("the real spawned server answers /docs with 200", docsRes.status === 200);
    const html = await docsRes.text();
    assert("spawned docs page references /openapi.json", html.includes("/openapi.json"));
  } finally {
    child.kill();
  }
}

console.log("3. real spawn: --help exits cleanly without starting a server");
{
  const r = await run(["--help"]);
  assert("--help exits 0", r.code === 0);
  assert("--help prints usage", r.stdout.includes("pptxdiff-server"));
}

console.log("4. real spawn: an invalid flag exits 2 without starting a server");
{
  const r = await run(["--bogus"]);
  assert("an unknown flag exits 2", r.code === 2);
  assert("stderr names the bad flag", r.stderr.includes("--bogus"));
}

console.log(`server-bin check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All server-bin checks passed (GREEN).");
}
