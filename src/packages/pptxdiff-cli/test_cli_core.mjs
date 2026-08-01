#!/usr/bin/env node
// Red/Green regression check for lib/cli-core.js — the CLI's argument
// parsing and command logic, kept separate from bin/pptxdiff-cli.js (the
// shebang entrypoint) so it's testable with INJECTED diffDecks/
// computeChecksum functions instead of a real browser. The real browser
// path is covered separately and for real by test_automation_e2e.mjs and
// test_diff_checksum_cli.mjs (which spawns the actual bin/ script).
//
// Run: node src/packages/pptxdiff-cli/test_cli_core.mjs

import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const { parseArgs, runDiff, runChecksum, runTextconv, runDifftool, main } = await import(`file://${path.join(DIR, "lib", "cli-core.js")}`);

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
}

// --- parseArgs ---
assert(
  "parses a basic diff command",
  JSON.stringify(parseArgs(["diff", "a.pptx", "b.pptx"])) ===
    JSON.stringify({ command: "diff", positional: ["a.pptx", "b.pptx"], flags: { json: false, quiet: false, help: false, version: false, out: null, timeoutMs: null, global: false } })
);
assert(
  "parses --json and --quiet flags",
  (() => {
    const r = parseArgs(["diff", "a.pptx", "b.pptx", "--json", "--quiet"]);
    return r.flags.json === true && r.flags.quiet === true;
  })()
);
assert(
  "parses --out with its value",
  parseArgs(["diff", "a.pptx", "b.pptx", "--out", "report.json"]).flags.out === "report.json"
);
assert(
  "parses --timeout as a number",
  parseArgs(["diff", "a.pptx", "b.pptx", "--timeout", "5000"]).flags.timeoutMs === 5000
);
assert("rejects a non-numeric --timeout instead of producing NaN", !!parseArgs(["diff", "a.pptx", "b.pptx", "--timeout", "soon"]).error);
assert("parses --global", parseArgs(["install-git-integration", "--global"]).flags.global === true);
assert("--global defaults to false", parseArgs(["install-git-integration"]).flags.global === false);
assert("rejects an unknown flag", !!parseArgs(["diff", "--nope"]).error);
assert("--help works with no command", parseArgs(["--help"]).flags.help === true);
assert("-h is a synonym for --help", parseArgs(["-h"]).flags.help === true);
assert("--version works with no command", parseArgs(["--version"]).flags.version === true);

// --- runDiff (injected diffDecks, no real browser) ---
const IDENTICAL_REPORT = { deckBefore: "a.pptx", deckAfter: "a.pptx", presentationDiffs: [], slides: [{ key: "a0:b0", label: "Slide 1", differences: [] }] };
const CHANGED_REPORT = { deckBefore: "a.pptx", deckAfter: "b.pptx", presentationDiffs: [], slides: [{ key: "a0:b0", label: "Slide 1", differences: [{ type: "TEXT", label: "Title", before: "X", after: "Y" }] }] };

function fakeIo() {
  const out = [], err = [];
  return {
    out: { write: (s) => out.push(s) },
    errOut: { write: (s) => err.push(s) },
    writeFile: (() => { const calls = []; const fn = (p, c) => calls.push({ p, c }); fn.calls = calls; return fn; })(),
    existsSync: () => true,
    outLines: out,
    errLines: err,
  };
}

{
  const io = fakeIo();
  const code = await runDiff("a.pptx", "a.pptx", { json: false, quiet: false, out: null, timeoutMs: null }, { diffDecksFn: async () => IDENTICAL_REPORT, ...io });
  assert("runDiff exits 0 when no differences", code === 0);
  assert("runDiff prints the human summary by default", io.outLines.join("").includes("No differences found"));
}
{
  const io = fakeIo();
  const code = await runDiff("a.pptx", "b.pptx", { json: false, quiet: false, out: null, timeoutMs: null }, { diffDecksFn: async () => CHANGED_REPORT, ...io });
  assert("runDiff exits 1 when differences are found (diff(1)-style)", code === 1);
  assert("runDiff's summary mentions the changed slide", io.outLines.join("").includes("Slide 1"));
}
{
  const io = fakeIo();
  const code = await runDiff("a.pptx", "b.pptx", { json: true, quiet: false, out: null, timeoutMs: null }, { diffDecksFn: async () => CHANGED_REPORT, ...io });
  assert("runDiff --json exits 1 too (exit code is independent of output format)", code === 1);
  const parsed = JSON.parse(io.outLines.join(""));
  assert("runDiff --json prints the raw report object", parsed.deckBefore === "a.pptx" && parsed.deckAfter === "b.pptx");
}
{
  const io = fakeIo();
  const code = await runDiff("a.pptx", "b.pptx", { json: false, quiet: true, out: null, timeoutMs: null }, { diffDecksFn: async () => CHANGED_REPORT, ...io });
  assert("runDiff --quiet suppresses stdout but still returns the right exit code", code === 1 && io.outLines.length === 0);
}
{
  const io = fakeIo();
  const code = await runDiff("a.pptx", "b.pptx", { json: true, quiet: false, out: "report.json", timeoutMs: null }, { diffDecksFn: async () => CHANGED_REPORT, ...io });
  assert("runDiff --out writes to a file instead of stdout", io.writeFile.calls.length === 1 && io.writeFile.calls[0].p === "report.json");
  assert("runDiff --out does not also print the report to stdout", io.outLines.length === 0);
  assert("runDiff --out still returns the correct exit code", code === 1);
}
{
  const io = fakeIo();
  io.existsSync = () => false;
  const code = await runDiff("missing.pptx", "b.pptx", {}, { diffDecksFn: async () => IDENTICAL_REPORT, ...io });
  assert("runDiff exits 2 (tool error) when a file doesn't exist", code === 2);
  assert("runDiff reports which file was missing", io.errLines.join("").includes("missing.pptx"));
}
{
  const io = fakeIo();
  const code = await runDiff("a.pptx", "b.pptx", {}, { diffDecksFn: async () => { throw new Error("boom"); }, ...io });
  assert("runDiff exits 2 when the automation layer throws", code === 2);
  assert("runDiff surfaces the underlying error message on stderr", io.errLines.join("").includes("boom"));
}

// --- runChecksum (injected computeChecksum) ---
{
  const io = fakeIo();
  const code = await runChecksum("a.pptx", { json: false, quiet: false, out: null }, { computeChecksumFn: async () => ({ algorithm: "SHA-256", hash: "ab".repeat(32) }), ...io });
  assert("runChecksum exits 0 on success", code === 0);
  assert("runChecksum prints the hash", io.outLines.join("").includes("ab".repeat(32)));
}
{
  const io = fakeIo();
  const code = await runChecksum("a.pptx", { json: true, quiet: false, out: null }, { computeChecksumFn: async () => ({ algorithm: "SHA-256", hash: "cd".repeat(32) }), ...io });
  const parsed = JSON.parse(io.outLines.join(""));
  assert("runChecksum --json prints a parseable {algorithm, hash} object", parsed.algorithm === "SHA-256" && parsed.hash === "cd".repeat(32));
}
{
  const io = fakeIo();
  io.existsSync = () => false;
  const code = await runChecksum("missing.pptx", {}, io);
  assert("runChecksum exits 2 when the file doesn't exist", code === 2);
}

// --- runTextconv (injected extractDeckText) ---
const SAMPLE_SLIDES = [
  { index: 1, shapeTexts: ["Title One", "Body one"], notes: "" },
  { index: 2, shapeTexts: ["Title Two"], notes: "speaker notes" },
];
{
  const io = fakeIo();
  const code = await runTextconv("a.pptx", { json: false, quiet: false, out: null }, { extractDeckTextFn: async () => SAMPLE_SLIDES, ...io });
  assert("runTextconv exits 0 on success (no 'differences found' concept for one file)", code === 0);
  const printed = io.outLines.join("");
  assert("runTextconv prints the formatted deck text", printed.includes("Title One") && printed.includes("Notes: speaker notes"));
  assert("runTextconv's output is not double-newlined", !printed.includes("\n\n\n"));
}
{
  const io = fakeIo();
  const code = await runTextconv("a.pptx", { json: true, quiet: false, out: null }, { extractDeckTextFn: async () => SAMPLE_SLIDES, ...io });
  assert("runTextconv --json exits 0 too", code === 0);
  const parsed = JSON.parse(io.outLines.join(""));
  assert("runTextconv --json prints the raw per-slide array", Array.isArray(parsed) && parsed.length === 2 && parsed[0].shapeTexts[0] === "Title One");
}
{
  const io = fakeIo();
  const code = await runTextconv("a.pptx", { json: false, quiet: false, out: "text.txt" }, { extractDeckTextFn: async () => SAMPLE_SLIDES, ...io });
  assert("runTextconv --out writes to a file instead of stdout", io.writeFile.calls.length === 1 && io.writeFile.calls[0].p === "text.txt");
  assert("runTextconv --out does not also print to stdout", io.outLines.length === 0);
  assert("runTextconv --out still exits 0", code === 0);
}
{
  const io = fakeIo();
  io.existsSync = () => false;
  const code = await runTextconv("missing.pptx", {}, io);
  assert("runTextconv exits 2 when the file doesn't exist", code === 2);
}
{
  const io = fakeIo();
  const code = await runTextconv("a.pptx", {}, { extractDeckTextFn: async () => { throw new Error("boom"); }, ...io });
  assert("runTextconv exits 2 when the automation layer throws", code === 2);
  assert("runTextconv surfaces the underlying error message on stderr", io.errLines.join("").includes("boom"));
}
{
  const io = fakeIo();
  const code = await runTextconv(null, {}, io);
  assert("runTextconv with no file argument exits 2 with a usage message", code === 2 && io.errLines.join("").includes("Usage"));
}

// --- runDifftool (injected openDifftool) ---
{
  const io = fakeIo();
  let waited = false;
  const code = await runDifftool("local.pptx", "remote.pptx", {}, {
    openDifftoolFn: async () => ({ waitUntilClosed: async () => { waited = true; } }),
    ...io,
  });
  assert("runDifftool exits 0 once the browser is closed", code === 0);
  assert("runDifftool actually awaits waitUntilClosed() before returning", waited === true);
  assert("runDifftool prints nothing to stdout (the browser window IS the output)", io.outLines.length === 0);
}
{
  const io = fakeIo();
  io.existsSync = () => false;
  const code = await runDifftool("missing.pptx", "remote.pptx", {}, { openDifftoolFn: async () => ({ waitUntilClosed: async () => {} }), ...io });
  assert("runDifftool exits 2 when a file doesn't exist", code === 2);
  assert("runDifftool reports which file was missing", io.errLines.join("").includes("missing.pptx"));
}
{
  const io = fakeIo();
  const code = await runDifftool("local.pptx", null, {}, io);
  assert("runDifftool with a missing argument exits 2 with a usage message", code === 2 && io.errLines.join("").includes("Usage"));
}
{
  const io = fakeIo();
  const code = await runDifftool("local.pptx", "remote.pptx", {}, { openDifftoolFn: async () => { throw new Error("no display"); }, ...io });
  assert("runDifftool exits 2 when the automation layer throws (e.g. no display available)", code === 2);
  assert("runDifftool surfaces the underlying error message on stderr", io.errLines.join("").includes("no display"));
}

// --- main()'s dispatch of install-git-integration (fast, injected `git` calls — the real,
// no-injection version is separately covered end-to-end by test_install_git_integration_cli.mjs
// against an actual git repo; this just proves argv -> parseArgs -> main()'s switch -> the right
// call, quickly and deterministically) ---
function fakeGitIo(execFileSyncFn) {
  const out = [], err = [];
  return {
    execFileSyncFn,
    existsSync: () => false,
    readFileSync: () => "",
    writeFileSync: () => {},
    out: { write: (s) => out.push(s) },
    errOut: { write: (s) => err.push(s) },
    outLines: out,
    errLines: err,
  };
}
{
  const calls = [];
  const io = fakeGitIo((cmd, args) => { calls.push(args); return args[0] === "rev-parse" ? "/fake/repo\n" : ""; });
  const code = await main(["install-git-integration"], io);
  assert("main() dispatches install-git-integration and exits 0", code === 0);
  assert("without --global, none of the git config calls include --global", !calls.some((a) => a.includes("--global")));
}
{
  const calls = [];
  const io = fakeGitIo((cmd, args) => { calls.push(args); return args[0] === "rev-parse" ? "/fake/repo\n" : ""; });
  const code = await main(["install-git-integration", "--global"], io);
  assert("main() forwards --global through to installGitIntegration", code === 0 && calls.some((a) => a.includes("--global")));
}

console.log(`cli-core check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All cli-core checks passed (GREEN).");
}
