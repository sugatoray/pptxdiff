#!/usr/bin/env node
// Red/Green regression check locking capture_screenshots.mjs's SCENARIOS
// metadata (resolution, crop mode, GIF frame rate) against a committed
// baseline (scenario-manifest.json).
//
// This is the test the user asked for directly: the staging -> target
// promotion workflow is only trustworthy if "all other parameters (sequence
// of steps, crop dimensions, dark/light/offline activations, resolution)
// remain unchanged" -- a silent edit to a scenario's viewport or fullPage
// setting would make two runs produce genuinely different images for a
// reason that has nothing to do with the app itself, and syncStagedFileToTarget
// would (correctly, but misleadingly) report that as a real change. This
// test doesn't verify the run() steps line-by-line (that's what actually
// exercising the scenario against a live app proves, done manually/by hand
// for this script -- see DOCS.md), but it does catch the specific class of
// silent-parameter-drift the user was worried about.
//
// Run: node src/pptxdiff/docs-site/scripts/test_scenario_manifest.mjs
// Regenerate the baseline after a deliberate scenario change:
//   node src/pptxdiff/docs-site/scripts/test_scenario_manifest.mjs --write

import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { scenarioMetadata } from "./capture_screenshots.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(DIR, "scenario-manifest.json");

function main() {
  const current = scenarioMetadata();
  const write = process.argv.includes("--write");

  if (write) {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(current, null, 2) + "\n");
    console.log(`Wrote ${current.length} scenario(s) to ${path.relative(process.cwd(), MANIFEST_PATH)}`);
    return;
  }

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`scenario-manifest.json does not exist yet at ${MANIFEST_PATH}`);
    console.error("Run with --write to create it from the current SCENARIOS.");
    process.exit(1);
  }

  const baseline = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const failures = [];

  const byId = new Map(current.map((m) => [m.id, m]));
  const baselineIds = new Set(baseline.map((m) => m.id));

  for (const b of baseline) {
    const c = byId.get(b.id);
    if (!c) {
      failures.push(`scenario "${b.id}" is in the baseline but no longer exists in SCENARIOS`);
      continue;
    }
    for (const key of Object.keys(b)) {
      const bv = JSON.stringify(b[key]);
      const cv = JSON.stringify(c[key]);
      if (bv !== cv) {
        failures.push(`scenario "${b.id}": ${key} changed (baseline ${bv} -> current ${cv})`);
      }
    }
  }
  for (const c of current) {
    if (!baselineIds.has(c.id)) {
      failures.push(`scenario "${c.id}" exists in SCENARIOS but is missing from the baseline (run --write)`);
    }
  }

  console.log(`scenario-manifest check: ${current.length - failures.length}/${current.length} scenario(s) match baseline`);
  if (failures.length) {
    console.log("FAILURES:");
    for (const f of failures) console.log(`  - ${f}`);
    console.log("\nIf this drift is deliberate, re-run with --write to update the baseline.");
    process.exit(1);
  }
  console.log("All scenario parameters match the committed baseline (GREEN).");
}

main();
