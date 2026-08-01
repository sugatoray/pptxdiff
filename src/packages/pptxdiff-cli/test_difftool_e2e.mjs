#!/usr/bin/env node
// Red/Green end-to-end check for lib/automation.js's openDifftool() — the
// piece behind `pptxdiff-cli difftool <local> <remote>` (git integration:
// the `difftool.pptxdiff.cmd` config git invokes per changed file). Unlike
// diff/checksum/textconv, this launches a REAL, VISIBLE (non-headless)
// browser window pre-loaded with both files for a human to look at, and
// is meant to block until they close it — matching git's own difftool
// contract (it waits for the configured command to exit before moving to
// the next file). There is no meaningful "headless" version of this
// feature to test instead; it genuinely needs a display.
//
// In a display-less sandbox/CI environment, wrap with `xvfb-run -a` to
// provide a virtual display — this is a sandbox testing detail, not
// something an end user on a real desktop ever needs:
//
//   PPTXDIFF_CHROME_PATH=/path/to/chrome xvfb-run -a node test_difftool_e2e.mjs
//
// Run: node src/packages/pptxdiff-cli/test_difftool_e2e.mjs

import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(DIR, "..", "..", "..");
const SAMPLE_BEFORE = path.join(REPO_ROOT, "docs", "assets", "sample_before.pptx");
const SAMPLE_AFTER = path.join(REPO_ROOT, "docs", "assets", "sample_after.pptx");

const automation = await import(`file://${path.join(DIR, "lib", "automation.js")}`);
const { openDifftool } = automation.default || automation;

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
  else console.log(`  ok — ${label}`);
}

console.log("1. openDifftool launches a real visible browser with both files loaded");
const handle = await openDifftool(SAMPLE_BEFORE, SAMPLE_AFTER);
assert("returns a handle with a real, connected browser", handle.browser.isConnected());
assert("returns a waitUntilClosed() function", typeof handle.waitUntilClosed === "function");

console.log("2. the browser actually shows both uploaded decks, not just launched blank");
const bodyText = await handle.browser.contexts()[0].pages()[0].locator("body").innerText();
assert("shows the real before deck's name", bodyText.includes("sample_before.pptx"));
assert("shows the real after deck's name", bodyText.includes("sample_after.pptx"));

console.log("3. waitUntilClosed() resolves once the browser is closed (simulating the user closing it)");
let resolved = false;
const waitPromise = handle.waitUntilClosed().then(() => {
  resolved = true;
});
await new Promise((r) => setTimeout(r, 500));
assert("waitUntilClosed() has NOT resolved yet while the browser is still open", resolved === false);

await handle.browser.close(); // simulates the user closing the window
await waitPromise;
assert("waitUntilClosed() resolved after the browser closed", resolved === true);

console.log(`difftool-e2e check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All difftool-e2e checks passed (GREEN).");
}
