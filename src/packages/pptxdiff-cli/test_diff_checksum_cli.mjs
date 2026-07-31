#!/usr/bin/env node
// Red/Green end-to-end check for bin/pptxdiff-cli.js itself — spawns the
// REAL compiled entrypoint as a child process (not just lib/cli-core.js's
// injected-function unit tests in test_cli_core.mjs) against the repo's own
// Red/Green sample fixtures (docs/assets/sample_before.pptx /
// sample_after.pptx — SPEC.md §22), proving the full wiring: argv parsing
// -> real browser automation -> exit code -> stdout/stderr, exactly as an
// end user or a git diff driver would invoke it.
//
// Needs a real Chrome/Chromium/Edge — set PPTXDIFF_CHROME_PATH if needed
// (see README.md).
//
// Run: node src/packages/pptxdiff-cli/test_diff_checksum_cli.mjs

import { spawn } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(DIR, "bin", "pptxdiff-cli.js");
const REPO_ROOT = path.join(DIR, "..", "..", "..");
const SAMPLE_BEFORE = path.join(REPO_ROOT, "docs", "assets", "sample_before.pptx");
const SAMPLE_AFTER = path.join(REPO_ROOT, "docs", "assets", "sample_after.pptx");
const PKG_VERSION = JSON.parse(readFileSync(path.join(DIR, "package.json"), "utf8")).version;

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], { env: process.env });
    let stdout = "", stderr = "";
    child.stdout.on("data", (c) => (stdout += c));
    child.stderr.on("data", (c) => (stderr += c));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
  else console.log(`  ok — ${label}`);
}

console.log("1. diff sample_before vs sample_after — real differences");
{
  const r = await run(["diff", SAMPLE_BEFORE, SAMPLE_AFTER]);
  assert("exits 1 (differences found)", r.code === 1);
  assert("stdout summarizes both deck names", r.stdout.includes("sample_before.pptx") && r.stdout.includes("sample_after.pptx"));
  assert("stdout lists at least one slide pair as differing", /slide pair\(s\) differ/i.test(r.stdout));
}

console.log("2. diff sample_before vs itself — no differences");
{
  const r = await run(["diff", SAMPLE_BEFORE, SAMPLE_BEFORE]);
  assert("exits 0 (no differences)", r.code === 0);
  assert("stdout says so", /no differences found/i.test(r.stdout));
}

console.log("3. diff --json — machine-readable report, correct exit code");
{
  const r = await run(["diff", SAMPLE_BEFORE, SAMPLE_AFTER, "--json"]);
  assert("exits 1 even in --json mode", r.code === 1);
  let parsed = null;
  try { parsed = JSON.parse(r.stdout); } catch (e) {}
  assert("stdout is valid, parseable JSON", parsed !== null);
  assert("parsed report has the expected deck names", parsed && parsed.deckBefore === "sample_before.pptx" && parsed.deckAfter === "sample_after.pptx");
}

console.log("4. checksum sample_before.pptx");
{
  const r = await run(["checksum", SAMPLE_BEFORE]);
  assert("exits 0", r.code === 0);
  assert("stdout has a well-formed SHA-256 line", /SHA-256:\s*[0-9a-f]{64}/i.test(r.stdout));
}

console.log("5. diff with a missing file — tool error, not a hang");
{
  const r = await run(["diff", path.join(DIR, "does-not-exist.pptx"), SAMPLE_AFTER]);
  assert("exits 2 (tool error)", r.code === 2);
  assert("stderr names the missing file", r.stderr.includes("does-not-exist.pptx"));
}

console.log("6. --help / --version / unknown command");
{
  const help = await run(["--help"]);
  assert("--help exits 0", help.code === 0);
  assert("--help lists the commands", help.stdout.includes("Commands:"));

  const version = await run(["--version"]);
  assert("--version exits 0", version.code === 0);
  assert("--version prints the package.json version", version.stdout.trim() === PKG_VERSION);

  const unknown = await run(["frobnicate"]);
  assert("an unknown command exits 2", unknown.code === 2);
}

console.log("7. --out writes a real file on disk instead of stdout");
{
  const outFile = path.join(os.tmpdir(), `pptxdiff-cli-test-out-${process.pid}-${Date.now()}.json`);
  try {
    const r = await run(["diff", SAMPLE_BEFORE, SAMPLE_AFTER, "--json", "--out", outFile]);
    assert("exits 1 (differences found) even with --out", r.code === 1);
    assert("--out does not also print the report to stdout", r.stdout.trim() === "");
    assert("stderr confirms where the file was written", r.stderr.includes(outFile));
    let written = null;
    try { written = JSON.parse(readFileSync(outFile, "utf8")); } catch (e) {}
    assert("the real file on disk contains the parseable report", written !== null);
    assert("the written report has the expected deck names", written && written.deckBefore === "sample_before.pptx" && written.deckAfter === "sample_after.pptx");
  } finally {
    rmSync(outFile, { force: true });
  }
}

console.log("8. --quiet suppresses real stdout but keeps the real exit code");
{
  const r = await run(["diff", SAMPLE_BEFORE, SAMPLE_AFTER, "--quiet"]);
  assert("exits 1 even when quiet", r.code === 1);
  assert("stdout is empty", r.stdout.trim() === "");
}

console.log("9. --timeout: accepted for a real run, rejected when invalid");
{
  const ok = await run(["diff", SAMPLE_BEFORE, SAMPLE_BEFORE, "--timeout", "60000"]);
  assert("a generous --timeout still completes normally (exit 0, no diffs)", ok.code === 0);

  const bad = await run(["diff", SAMPLE_BEFORE, SAMPLE_AFTER, "--timeout", "not-a-number"]);
  assert("a non-numeric --timeout exits 2 without ever launching a browser", bad.code === 2);
  assert("stderr explains the bad --timeout value", /--timeout/.test(bad.stderr));
}

console.log(`diff-checksum-cli check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All diff-checksum-cli checks passed (GREEN).");
}
