#!/usr/bin/env node
// Red/Green end-to-end check for lib/git-integration.js's
// installGitIntegration() — genuinely runs `git init` in a real temp
// directory, runs the real function against it (real `git config`/
// `git rev-parse` calls, real .gitattributes file), and inspects the
// actual resulting repo state. No browser needed for any of this, unlike
// every other command in this package.
//
// Run: node src/packages/pptxdiff-cli/test_git_integration_e2e.mjs

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const { installGitIntegration } = await import(`file://${path.join(DIR, "lib", "git-integration.js")}`);

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
  else console.log(`  ok — ${label}`);
}

function makeTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pptxdiff-git-integration-test-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  // A repo-local identity avoids relying on (or polluting) any global
  // git config in this sandbox/CI environment.
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
  return dir;
}

console.log("1. a fresh repo with no .gitattributes gets one created, and git config set");
{
  const repo = makeTempRepo();
  const code = installGitIntegration({ cwd: repo });
  assert("exits 0", code === 0);

  const attrPath = path.join(repo, ".gitattributes");
  assert(".gitattributes was created", fs.existsSync(attrPath));
  assert(".gitattributes has the real pptxdiff line", fs.readFileSync(attrPath, "utf8").includes("*.pptx diff=pptxdiff"));

  const textconv = execFileSync("git", ["config", "diff.pptxdiff.textconv"], { cwd: repo, encoding: "utf8" }).trim();
  assert("git config set diff.pptxdiff.textconv for real", textconv === "pptxdiff-cli textconv");
  const difftoolCmd = execFileSync("git", ["config", "difftool.pptxdiff.cmd"], { cwd: repo, encoding: "utf8" }).trim();
  assert("git config set difftool.pptxdiff.cmd for real", difftoolCmd === 'pptxdiff-cli difftool "$LOCAL" "$REMOTE"');

  fs.rmSync(repo, { recursive: true, force: true });
}

console.log("2. running it TWICE (a real teammate re-running it, or a fresh clone with .gitattributes already committed) is idempotent");
{
  const repo = makeTempRepo();
  installGitIntegration({ cwd: repo });
  const attrPath = path.join(repo, ".gitattributes");
  const afterFirst = fs.readFileSync(attrPath, "utf8");

  installGitIntegration({ cwd: repo });
  const afterSecond = fs.readFileSync(attrPath, "utf8");
  assert("running twice doesn't duplicate the .gitattributes line", afterFirst === afterSecond);
  assert("the file has exactly one pptxdiff line, not two", afterSecond.split("\n").filter((l) => l.trim() === "*.pptx diff=pptxdiff").length === 1);

  fs.rmSync(repo, { recursive: true, force: true });
}

console.log("3. an existing .gitattributes with unrelated content is preserved, not overwritten");
{
  const repo = makeTempRepo();
  fs.writeFileSync(path.join(repo, ".gitattributes"), "*.png binary\n*.psd binary\n");
  installGitIntegration({ cwd: repo });
  const content = fs.readFileSync(path.join(repo, ".gitattributes"), "utf8");
  assert("pre-existing lines survive", content.includes("*.png binary") && content.includes("*.psd binary"));
  assert("the new pptxdiff line was appended", content.includes("*.pptx diff=pptxdiff"));

  fs.rmSync(repo, { recursive: true, force: true });
}

console.log("4. --global sets global git config instead of local (using a temp HOME so this sandbox's real ~/.gitconfig is never touched)");
{
  const repo = makeTempRepo();
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "pptxdiff-fake-home-"));
  const envWithFakeHome = { ...process.env, HOME: fakeHome };
  const execFileSyncWithFakeHome = (cmd, args, opts = {}) => execFileSync(cmd, args, { ...opts, env: envWithFakeHome });

  const code = installGitIntegration({ cwd: repo, global: true }, { execFileSyncFn: execFileSyncWithFakeHome });
  assert("exits 0", code === 0);

  let localTextconv = null;
  try {
    localTextconv = execFileSync("git", ["config", "--local", "diff.pptxdiff.textconv"], { cwd: repo, encoding: "utf8" }).trim();
  } catch (e) {
    // git config exits non-zero when the key isn't set — that's the expected/passing case here.
  }
  assert("did NOT set it in the repo's local config", localTextconv === null);

  const globalTextconv = execFileSync("git", ["config", "--global", "diff.pptxdiff.textconv"], { cwd: repo, env: envWithFakeHome, encoding: "utf8" }).trim();
  assert("DID set it in the (fake, isolated) global config", globalTextconv === "pptxdiff-cli textconv");

  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(fakeHome, { recursive: true, force: true });
}

console.log("5. running outside any git repo fails clearly, not with a confusing crash");
{
  const notARepo = fs.mkdtempSync(path.join(os.tmpdir(), "pptxdiff-not-a-repo-"));
  let stderrText = "";
  const code = installGitIntegration({ cwd: notARepo }, { errOut: { write: (s) => (stderrText += s) } });
  assert("exits 2", code === 2);
  assert("explains that this isn't a git repo", /not inside a git repository/i.test(stderrText));
  fs.rmSync(notARepo, { recursive: true, force: true });
}

console.log(`git-integration-e2e check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All git-integration-e2e checks passed (GREEN).");
}
