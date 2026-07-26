#!/usr/bin/env node
// Red/Green regression check for PPTXDIFF_LITE_MODE.
//
// bin/cli.js should append `?lite=1` to the URL it prints (and opens) only
// when PPTXDIFF_LITE_MODE is set to a truthy value (1/y/yes/true, case
// insensitive). Spawns the real CLI as a child process (killing it as soon
// as the URL line is seen) rather than importing it, since it's a
// self-executing script with side effects (starts a server, tries to open
// a browser).
//
// Run: node src/pptxdiff/test_lite_mode_cli.mjs

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(DIR, "..", "..", "bin", "cli.js");

function runCli(envValue) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    if (envValue === undefined) delete env.PPTXDIFF_LITE_MODE;
    else env.PPTXDIFF_LITE_MODE = envValue;

    const child = spawn(process.execPath, [CLI], { env });
    let out = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("timed out waiting for CLI to print its URL"));
    }, 8000);

    child.stdout.on("data", (chunk) => {
      out += chunk.toString();
      const m = out.match(/pptxdiff running at (\S+)/);
      if (m) {
        clearTimeout(timeout);
        child.kill();
        resolve(m[1]);
      }
    });
    child.stderr.on("data", () => {});
    child.on("error", (e) => {
      clearTimeout(timeout);
      reject(e);
    });
  });
}

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
}

const cases = [
  { label: "unset", value: undefined, expectLite: false },
  { label: "1", value: "1", expectLite: true },
  { label: "y", value: "y", expectLite: true },
  { label: "Y", value: "Y", expectLite: true },
  { label: "yes", value: "yes", expectLite: true },
  { label: "true", value: "true", expectLite: true },
  { label: "TRUE", value: "TRUE", expectLite: true },
  { label: "0", value: "0", expectLite: false },
  { label: "false", value: "false", expectLite: false },
  { label: "garbage", value: "banana", expectLite: false },
];

for (const c of cases) {
  const url = await runCli(c.value);
  const hasLiteParam = /[?&]lite=1\b/.test(url);
  assert(
    `PPTXDIFF_LITE_MODE=${JSON.stringify(c.value)} -> URL ${c.expectLite ? "should" : "should NOT"} contain ?lite=1 (got: ${url})`,
    hasLiteParam === c.expectLite
  );
}

console.log(`lite-mode CLI check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All lite-mode CLI checks passed (GREEN).");
}
