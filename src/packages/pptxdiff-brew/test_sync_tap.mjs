#!/usr/bin/env node
// Red/Green check for sync-tap.mjs's pure logic — `updateFormulaPin`
// (lib.mjs) and `parseArgs` (sync-tap.mjs). Deliberately no network here;
// sync-tap.mjs's own real-download/write behavior is exercised directly
// against a real target file as part of `.github/workflows/sync-homebrew-tap.yml`
// (and was verified by hand against the real npm registry while writing it
// — see HANDOFF.md), not re-proven with a mocked network in this file.
//
// Run: node src/packages/pptxdiff-brew/test_sync_tap.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { updateFormulaPin } from "./lib.mjs";
import { parseArgs } from "./sync-tap.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const REAL_FORMULA = fs.readFileSync(path.join(DIR, "Formula", "pptxdiff.rb"), "utf8");

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
}

console.log("1. updateFormulaPin — replaces url/sha256, leaves everything else untouched");
{
  const updated = updateFormulaPin(REAL_FORMULA, {
    url: "https://registry.npmjs.org/pptxdiff/-/pptxdiff-9.9.9.tgz",
    sha256: "f".repeat(64),
  });
  assert("new url is present", updated.includes('url "https://registry.npmjs.org/pptxdiff/-/pptxdiff-9.9.9.tgz"'));
  assert("new sha256 is present", updated.includes(`sha256 "${"f".repeat(64)}"`));
  assert("old url is gone", !updated.includes("pptxdiff-0.7.0.tgz"));
  assert(
    "every other line is byte-identical to the original (install/test/caveats/license/homepage untouched)",
    updated
      .split("\n")
      .filter((l) => !/^\s*(url|sha256)\s+"/.test(l))
      .join("\n") ===
      REAL_FORMULA.split("\n")
        .filter((l) => !/^\s*(url|sha256)\s+"/.test(l))
        .join("\n")
  );
}

console.log("2. updateFormulaPin — idempotent: same values in, byte-identical output");
{
  const urlMatch = REAL_FORMULA.match(/^\s*url\s+"([^"]+)"/m)[1];
  const sha256Match = REAL_FORMULA.match(/^\s*sha256\s+"([^"]+)"/m)[1];
  const reapplied = updateFormulaPin(REAL_FORMULA, { url: urlMatch, sha256: sha256Match });
  assert("reapplying the current values changes nothing", reapplied === REAL_FORMULA);
}

console.log("3. parseArgs — defaults and overrides");
{
  const defaults = parseArgs([]);
  assert("default file ends in Formula/pptxdiff.rb", defaults.file.endsWith(path.join("Formula", "pptxdiff.rb")));
  assert('default version is "latest"', defaults.version === "latest");

  const withFile = parseArgs(["--file", "/tmp/some/other.rb"]);
  assert("--file overrides the target path", withFile.file === "/tmp/some/other.rb");
  assert("--version still defaults when only --file is given", withFile.version === "latest");

  const withBoth = parseArgs(["--file", "/tmp/x.rb", "--version", "1.2.3"]);
  assert("--file + --version both apply", withBoth.file === "/tmp/x.rb" && withBoth.version === "1.2.3");

  let threw = false;
  try {
    parseArgs(["--bogus"]);
  } catch (e) {
    threw = true;
  }
  assert("an unknown flag throws instead of being silently ignored", threw);
}

console.log(`test_sync_tap check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All test_sync_tap checks passed (GREEN).");
}
