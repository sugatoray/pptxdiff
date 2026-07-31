"use strict";

const fs = require("node:fs");
const { diffDecks, computeChecksum, extractDeckText } = require("./automation.js");
const { hasDifferences, formatDiffSummary } = require("./format.js");
const { formatDeckText } = require("./textconv.js");

const USAGE = [
  "pptxdiff-cli <command> [options]",
  "",
  "Commands:",
  "  diff <before.pptx> <after.pptx>   Diff two decks. Exit 0 = no differences,",
  "                                    1 = differences found, 2 = error.",
  "  checksum <file.pptx>              Print the file's parser-independent",
  "                                    SHA-256 content checksum.",
  "  textconv <file.pptx>              Print the deck's text content, for use",
  "                                    as a git textconv driver (see README).",
  "",
  "Options:",
  "  --json           Print the full JSON report instead of a summary.",
  "  --out <file>      Write the output to a file instead of stdout.",
  "  --quiet, -q       Suppress stdout output (exit code still reflects the result).",
  "  --timeout <ms>    Override the default browser-automation timeout.",
  "  --help, -h        Show this help.",
  "  --version, -v     Show the installed version.",
].join("\n");

// Pure: no I/O, no defaults pulled from process.argv — argv is always an
// explicit array in, a parsed result (or {error}) out. This is what makes
// every flag-handling behavior below independently testable without
// spawning a real process.
function parseArgs(argv) {
  const flags = { json: false, quiet: false, help: false, version: false, out: null, timeoutMs: null };
  const positional = [];
  let command = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") { flags.help = true; continue; }
    if (a === "--version" || a === "-v") { flags.version = true; continue; }
    if (a === "--json") { flags.json = true; continue; }
    if (a === "--quiet" || a === "-q") { flags.quiet = true; continue; }
    if (a === "--out") { flags.out = argv[++i]; continue; }
    if (a === "--timeout") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n <= 0) return { error: `--timeout must be a positive number of milliseconds (got "${argv[i]}")` };
      flags.timeoutMs = n;
      continue;
    }
    if (a.startsWith("-")) return { error: `Unknown flag: ${a}` };
    if (!command) { command = a; continue; }
    positional.push(a);
  }

  return { command, positional, flags };
}

function automationOpts(flags) {
  return flags.timeoutMs ? { timeoutMs: flags.timeoutMs } : {};
}

// Emits `text` to stdout (default) or `flags.out` (a file, with a short
// stderr confirmation instead) — never both, so a script piping stdout
// never sees duplicated output just because --out was also passed.
function emit(text, flags, { out, errOut, writeFile }) {
  if (flags.out) {
    writeFile(flags.out, text + "\n");
    errOut.write(`Wrote output to ${flags.out}\n`);
  } else if (!flags.quiet) {
    out.write(text + "\n");
  }
}

async function runDiff(beforePath, afterPath, flags, io = {}) {
  const {
    diffDecksFn = diffDecks,
    out = process.stdout,
    errOut = process.stderr,
    writeFile = fs.writeFileSync,
    existsSync = fs.existsSync,
  } = io;

  if (!beforePath || !afterPath) {
    errOut.write("Usage: pptxdiff-cli diff <before.pptx> <after.pptx> [--json] [--out <file>] [--quiet]\n");
    return 2;
  }
  for (const p of [beforePath, afterPath]) {
    if (!existsSync(p)) {
      errOut.write(`File not found: ${p}\n`);
      return 2;
    }
  }

  let report;
  try {
    report = await diffDecksFn(beforePath, afterPath, automationOpts(flags));
  } catch (e) {
    errOut.write(`${(e && e.message) || String(e)}\n`);
    return 2;
  }

  const text = flags.json ? JSON.stringify(report, null, 2) : formatDiffSummary(report);
  emit(text, flags, { out, errOut, writeFile });
  return hasDifferences(report) ? 1 : 0;
}

async function runChecksum(filePath, flags, io = {}) {
  const {
    computeChecksumFn = computeChecksum,
    out = process.stdout,
    errOut = process.stderr,
    writeFile = fs.writeFileSync,
    existsSync = fs.existsSync,
  } = io;

  if (!filePath) {
    errOut.write("Usage: pptxdiff-cli checksum <file.pptx> [--json] [--out <file>]\n");
    return 2;
  }
  if (!existsSync(filePath)) {
    errOut.write(`File not found: ${filePath}\n`);
    return 2;
  }

  let result;
  try {
    result = await computeChecksumFn(filePath, automationOpts(flags));
  } catch (e) {
    errOut.write(`${(e && e.message) || String(e)}\n`);
    return 2;
  }

  const text = flags.json ? JSON.stringify(result, null, 2) : `${result.algorithm}: ${result.hash}`;
  emit(text, flags, { out, errOut, writeFile });
  return 0;
}

// A git textconv driver: renders ONE deck's plain-text content so `git
// diff`/`git log -p` can line-diff it, rather than pptxdiff's own semantic
// diff (which needs two decks — see runDiff). Always exits 0 on success
// (there's no "differences found" concept for a single file) or 2 on error.
async function runTextconv(filePath, flags, io = {}) {
  const {
    extractDeckTextFn = extractDeckText,
    out = process.stdout,
    errOut = process.stderr,
    writeFile = fs.writeFileSync,
    existsSync = fs.existsSync,
  } = io;

  if (!filePath) {
    errOut.write("Usage: pptxdiff-cli textconv <file.pptx> [--json] [--out <file>]\n");
    return 2;
  }
  if (!existsSync(filePath)) {
    errOut.write(`File not found: ${filePath}\n`);
    return 2;
  }

  let slides;
  try {
    slides = await extractDeckTextFn(filePath, automationOpts(flags));
  } catch (e) {
    errOut.write(`${(e && e.message) || String(e)}\n`);
    return 2;
  }

  // formatDeckText() already ends with its own trailing newline; strip it
  // before handing to emit() (which adds its own) so output isn't
  // double-newlined.
  const text = flags.json ? JSON.stringify(slides, null, 2) : formatDeckText(slides).replace(/\n$/, "");
  emit(text, flags, { out, errOut, writeFile });
  return 0;
}

async function main(argv, io = {}) {
  const { out = process.stdout, errOut = process.stderr } = io;
  const parsed = parseArgs(argv);

  if (parsed.error) {
    errOut.write(`${parsed.error}\n\n${USAGE}\n`);
    return 2;
  }
  if (parsed.flags.help || parsed.command === "help") {
    out.write(`${USAGE}\n`);
    return 0;
  }
  if (parsed.flags.version) {
    out.write(`${require("../package.json").version}\n`);
    return 0;
  }

  switch (parsed.command) {
    case "diff":
      return runDiff(parsed.positional[0], parsed.positional[1], parsed.flags, io);
    case "checksum":
      return runChecksum(parsed.positional[0], parsed.flags, io);
    case "textconv":
      return runTextconv(parsed.positional[0], parsed.flags, io);
    default:
      errOut.write(`Unknown command: ${parsed.command || "(none)"}\n\n${USAGE}\n`);
      return 2;
  }
}

module.exports = { USAGE, parseArgs, runDiff, runChecksum, runTextconv, main };
