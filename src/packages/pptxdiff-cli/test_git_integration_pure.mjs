#!/usr/bin/env node
// Red/Green regression check for lib/git-integration.js's pure decision
// functions — computeGitAttributesUpdate() and buildGitConfigCommands().
// The impure orchestration (installGitIntegration(), which actually shells
// out to `git` and touches a real .gitattributes file) is tested
// separately and for real against a real temp git repo, in
// test_git_integration_e2e.mjs — no browser needed for any of this,
// unlike every other command in this package.
//
// Run: node src/packages/pptxdiff-cli/test_git_integration_pure.mjs

import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const { computeGitAttributesUpdate, buildGitConfigCommands, GITATTRIBUTES_LINE } =
  await import(`file://${path.join(DIR, "lib", "git-integration.js")}`);

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
}

// --- computeGitAttributesUpdate ---
assert(
  "a nonexistent .gitattributes (null) gets created with just the pptxdiff line",
  JSON.stringify(computeGitAttributesUpdate(null, GITATTRIBUTES_LINE)) === JSON.stringify({ content: GITATTRIBUTES_LINE + "\n", changed: true })
);
assert(
  "an empty .gitattributes gets the line appended",
  computeGitAttributesUpdate("", GITATTRIBUTES_LINE).content === GITATTRIBUTES_LINE + "\n"
);
assert(
  "an existing file WITHOUT the pptxdiff line gets it appended, preserving existing content",
  computeGitAttributesUpdate("*.png binary\n", GITATTRIBUTES_LINE).content === "*.png binary\n" + GITATTRIBUTES_LINE + "\n"
);
assert(
  "a file missing a trailing newline still gets a clean new line, not a run-on line",
  computeGitAttributesUpdate("*.png binary", GITATTRIBUTES_LINE).content === "*.png binary\n" + GITATTRIBUTES_LINE + "\n"
);
assert(
  "an existing file that ALREADY has the line is left unchanged (idempotent)",
  (() => {
    const existing = "*.png binary\n" + GITATTRIBUTES_LINE + "\n";
    const r = computeGitAttributesUpdate(existing, GITATTRIBUTES_LINE);
    return r.changed === false && r.content === existing;
  })()
);
assert(
  "idempotency check tolerates surrounding whitespace on the existing line",
  computeGitAttributesUpdate("  " + GITATTRIBUTES_LINE + "  \n", GITATTRIBUTES_LINE).changed === false
);
assert(
  "running twice in a row (fresh file, then its own output) is idempotent",
  (() => {
    const first = computeGitAttributesUpdate(null, GITATTRIBUTES_LINE);
    const second = computeGitAttributesUpdate(first.content, GITATTRIBUTES_LINE);
    return second.changed === false;
  })()
);

// --- buildGitConfigCommands ---
const localCmds = buildGitConfigCommands("local");
assert("local scope produces exactly 2 commands", localCmds.length === 2);
assert("local scope does NOT include --global anywhere", !localCmds.some((c) => c.includes("--global")));
assert(
  "local textconv command is well-formed",
  JSON.stringify(localCmds[0]) === JSON.stringify(["config", "diff.pptxdiff.textconv", "pptxdiff-cli textconv"])
);
assert(
  "local difftool command uses git's own $LOCAL/$REMOTE shell-expansion syntax literally",
  localCmds[1][1] === "difftool.pptxdiff.cmd" && localCmds[1][2].includes('"$LOCAL"') && localCmds[1][2].includes('"$REMOTE"')
);

const globalCmds = buildGitConfigCommands("global");
assert("global scope produces exactly 2 commands", globalCmds.length === 2);
assert(
  "global scope commands all start with 'config', THEN --global — git rejects `git --global config ...` as an unknown top-level option",
  globalCmds.every((c) => c[0] === "config" && c[1] === "--global")
);
assert(
  "global textconv command has the same config key/value, with --global inserted right after 'config'",
  JSON.stringify(globalCmds[0]) === JSON.stringify(["config", "--global", "diff.pptxdiff.textconv", "pptxdiff-cli textconv"])
);

console.log(`git-integration-pure check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All git-integration-pure checks passed (GREEN).");
}
