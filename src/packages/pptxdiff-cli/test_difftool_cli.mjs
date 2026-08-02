#!/usr/bin/env node
// Red/Green smoke check for the real, spawned `bin/pptxdiff-cli.js
// difftool <local> <remote>` — proves the full wiring (argv -> real
// headed browser -> real uploads -> blocking) works as a real process,
// complementing test_difftool_e2e.mjs (which tests lib/automation.js's
// openDifftool() directly and proves the close-detection mechanism) and
// test_cli_core.mjs (which unit-tests runDifftool()'s argument handling
// with an injected function). This test does NOT try to simulate a human
// closing a real browser window it doesn't otherwise control — it confirms
// the process launches, actually loads both real decks, and is correctly
// BLOCKING (still alive, not crashed/exited early) before being torn down.
//
// Needs a real Chrome/Chromium/Edge AND a display — wrap with `xvfb-run -a`
// in a display-less sandbox/CI environment:
//
//   PPTXDIFF_CHROME_PATH=/path/to/chrome xvfb-run -a node test_difftool_cli.mjs
//
// Run: node src/packages/pptxdiff-cli/test_difftool_cli.mjs

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(DIR, "bin", "pptxdiff-cli.js");
const REPO_ROOT = path.join(DIR, "..", "..", "..");
const SAMPLE_BEFORE = path.join(REPO_ROOT, "docs", "assets", "sample_before.pptx");
const SAMPLE_AFTER = path.join(REPO_ROOT, "docs", "assets", "sample_after.pptx");

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
  else console.log(`  ok — ${label}`);
}

console.log("1. difftool launches, loads both real decks, and blocks (doesn't exit early)");
const child = spawn(process.execPath, [BIN, "difftool", SAMPLE_BEFORE, SAMPLE_AFTER], { env: process.env });
let stderr = "";
let exitedEarly = false;
child.stderr.on("data", (c) => (stderr += c));
child.on("exit", () => {
  exitedEarly = true;
});

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("timed out waiting for the ready message on stderr")), 15000);
  const check = setInterval(() => {
    if (stderr.includes("close it to continue")) {
      clearInterval(check);
      clearTimeout(timer);
      resolve();
    }
  }, 200);
});

assert("printed the ready message once both decks loaded", stderr.includes("close it to continue"));
assert("did NOT exit early — it's correctly blocking, waiting for the browser to close", exitedEarly === false);

child.kill("SIGTERM");
await new Promise((resolve) => child.on("exit", resolve));

console.log(`difftool-cli check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All difftool-cli checks passed (GREEN).");
}
