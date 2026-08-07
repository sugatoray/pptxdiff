#!/usr/bin/env node
// Bumps a Homebrew formula's `url`/`sha256` pin to a target `pptxdiff` npm
// version — the same two-line edit README.md's "Bumping the version"
// section describes doing by hand, automated so it can run against BOTH
// this repo's own `Formula/pptxdiff.rb` (source of truth) and, in CI, a
// checked-out copy of the separate `sugatoray/homebrew-pptxdiff` tap repo's
// `Formula/pptxdiff.rb` — see .github/workflows/sync-homebrew-tap.yml.
//
// Usage:
//   node sync-tap.mjs [--file <path-to-formula.rb>] [--version <x.y.z>|latest]
//
// --file defaults to this package's own Formula/pptxdiff.rb.
// --version defaults to "latest" (npm's dist-tags.latest for `pptxdiff`).
//
// Exits 0 whether or not a change was made — this is designed to run
// unconditionally on a schedule/dispatch; the caller checks stdout's
// "changed=" line (also written to $GITHUB_OUTPUT when running in Actions)
// to decide whether to commit/open a PR.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetch, parseFormula, resolveNpmVersion, sha256hex, updateFormulaPin } from "./lib.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));

export function parseArgs(argv) {
  const args = { file: path.join(DIR, "Formula", "pptxdiff.rb"), version: "latest" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--file") args.file = argv[++i];
    else if (argv[i] === "--version") args.version = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return args;
}

function writeGithubOutput(name, value) {
  const outFile = process.env.GITHUB_OUTPUT;
  if (!outFile) return;
  fs.appendFileSync(outFile, `${name}=${value}\n`);
}

async function main() {
  const { file, version: requestedVersion } = parseArgs(process.argv.slice(2));

  const currentSource = fs.readFileSync(file, "utf8");
  const current = parseFormula(currentSource);

  const { version, meta } = await resolveNpmVersion("pptxdiff", requestedVersion);
  const newUrl = meta.dist.tarball;

  console.log(`pptxdiff@${version}: downloading ${newUrl} to compute its real sha256...`);
  const tarball = await fetch(newUrl);
  const newSha256 = sha256hex(tarball);

  if (current.url === newUrl && current.sha256 === newSha256) {
    console.log(`${file} is already up to date with pptxdiff@${version}.`);
    writeGithubOutput("changed", "false");
    writeGithubOutput("version", version);
    return;
  }

  const updatedSource = updateFormulaPin(currentSource, { url: newUrl, sha256: newSha256 });
  fs.writeFileSync(file, updatedSource);

  console.log(`Updated ${file}:`);
  console.log(`  url:    ${current.url} -> ${newUrl}`);
  console.log(`  sha256: ${current.sha256} -> ${newSha256}`);
  writeGithubOutput("changed", "true");
  writeGithubOutput("version", version);
}

// Guarded so `test_sync_tap.mjs` can import `parseArgs` without triggering
// a real network call as a side effect of the import.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
