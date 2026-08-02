#!/usr/bin/env node
// Red/Green end-to-end check for the real, spawned
// `bin/pptxdiff-cli.js install-git-integration [--global]` — proves the
// full wiring (argv -> parseArgs -> main()'s dispatch -> the real
// installGitIntegration()) against a real temp git repo, complementing
// test_git_integration_pure.mjs (pure decision functions) and
// test_git_integration_e2e.mjs (installGitIntegration() called directly,
// not through the CLI's argv parsing/dispatch layer — that layer is what
// this file covers, and nothing else did before it existed).
//
// Run: node src/packages/pptxdiff-cli/test_install_git_integration_cli.mjs

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(DIR, "bin", "pptxdiff-cli.js");

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
  else console.log(`  ok — ${label}`);
}

function makeTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pptxdiff-install-git-integration-cli-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
  return dir;
}

function run(args, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], { env: process.env, ...opts });
    let stdout = "", stderr = "";
    child.stdout.on("data", (c) => (stdout += c));
    child.stderr.on("data", (c) => (stderr += c));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

console.log("1. install-git-integration, run as the real spawned CLI against a real repo");
{
  const repo = makeTempRepo();
  const r = await run(["install-git-integration"], { cwd: repo });
  assert("exits 0", r.code === 0);

  const attrPath = path.join(repo, ".gitattributes");
  assert(".gitattributes was really created on disk", fs.existsSync(attrPath));
  assert(".gitattributes has the real pptxdiff line", fs.readFileSync(attrPath, "utf8").includes("*.pptx diff=pptxdiff"));

  const textconv = execFileSync("git", ["config", "diff.pptxdiff.textconv"], { cwd: repo, encoding: "utf8" }).trim();
  assert("git config diff.pptxdiff.textconv was really set", textconv === "pptxdiff-cli textconv");

  fs.rmSync(repo, { recursive: true, force: true });
}

console.log("2. install-git-integration --global, via real argv parsing, isolated to a fake HOME");
{
  const repo = makeTempRepo();
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "pptxdiff-fake-home-cli-"));
  const r = await run(["install-git-integration", "--global"], { cwd: repo, env: { ...process.env, HOME: fakeHome } });
  assert("exits 0", r.code === 0);

  const globalTextconv = execFileSync("git", ["config", "--global", "diff.pptxdiff.textconv"], { env: { ...process.env, HOME: fakeHome }, encoding: "utf8" }).trim();
  assert("--global on the real CLI actually wrote the (fake, isolated) global git config", globalTextconv === "pptxdiff-cli textconv");

  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(fakeHome, { recursive: true, force: true });
}

console.log("3. install-git-integration outside a git repo fails clearly");
{
  const notARepo = fs.mkdtempSync(path.join(os.tmpdir(), "pptxdiff-not-a-repo-cli-"));
  const r = await run(["install-git-integration"], { cwd: notARepo });
  assert("exits 2", r.code === 2);
  assert("stderr explains this isn't a git repo", /not inside a git repository/i.test(r.stderr));
  fs.rmSync(notARepo, { recursive: true, force: true });
}

console.log(`install-git-integration-cli check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All install-git-integration-cli checks passed (GREEN).");
}
