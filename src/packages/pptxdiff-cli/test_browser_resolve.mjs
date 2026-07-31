#!/usr/bin/env node
// Red/Green regression check for lib/browser.js's resolveBrowserExecutable().
//
// Context (see docs/.scrolls/CLI_and_API.md): the CLI must not force a
// ~130-300MB Chromium download on every install. Instead it prefers an
// already-installed system browser (Chrome/Chromium/Edge), with an explicit
// PPTXDIFF_CHROME_PATH escape hatch, and only falls back to letting
// playwright-core try its own managed-browser resolution (which works for
// free in environments like this dev sandbox where PLAYWRIGHT_BROWSERS_PATH
// already points at a real installed Chromium) when nothing else matches.
//
// resolveBrowserExecutable is a pure function — env/platform/existsSync are
// all injected — so this test never touches the real filesystem or a real
// platform, and is fully deterministic.
//
// Run: node src/packages/pptxdiff-cli/test_browser_resolve.mjs

import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const { resolveBrowserExecutable } = await import(`file://${path.join(DIR, "lib", "browser.js")}`);

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
}

// 1. Explicit override always wins, verbatim, regardless of platform/existsSync.
assert(
  "PPTXDIFF_CHROME_PATH override is returned verbatim",
  resolveBrowserExecutable({
    env: { PPTXDIFF_CHROME_PATH: "/custom/path/to/chrome" },
    platform: "linux",
    existsSync: () => false,
  }) === "/custom/path/to/chrome"
);
assert(
  "override wins even when a platform candidate also exists",
  resolveBrowserExecutable({
    env: { PPTXDIFF_CHROME_PATH: "/custom/chrome" },
    platform: "linux",
    existsSync: () => true,
  }) === "/custom/chrome"
);

// 2. No override: search platform-specific candidate paths, first existing one wins.
assert(
  "darwin: finds Google Chrome when it's the only one that exists",
  resolveBrowserExecutable({
    env: {},
    platform: "darwin",
    existsSync: (p) => p === "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  }) === "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
);
assert(
  "linux: finds google-chrome when chromium doesn't exist but google-chrome does",
  resolveBrowserExecutable({
    env: {},
    platform: "linux",
    existsSync: (p) => p === "/usr/bin/google-chrome",
  }) === "/usr/bin/google-chrome"
);
assert(
  "linux: falls through to chromium when google-chrome doesn't exist",
  resolveBrowserExecutable({
    env: {},
    platform: "linux",
    existsSync: (p) => p === "/usr/bin/chromium",
  }) === "/usr/bin/chromium"
);
assert(
  "win32: finds a Program Files chrome.exe candidate",
  resolveBrowserExecutable({
    env: {},
    platform: "win32",
    existsSync: (p) => p === "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  }) === "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
);

// 3. Nothing found anywhere → null, meaning "let playwright-core try its own
//    managed-browser resolution" (not an error at this layer).
assert(
  "no override, nothing exists → null (defer to playwright-core's own resolution)",
  resolveBrowserExecutable({ env: {}, platform: "linux", existsSync: () => false }) === null
);
assert(
  "unrecognized platform with nothing found → null, not a throw",
  resolveBrowserExecutable({ env: {}, platform: "freebsd", existsSync: () => false }) === null
);

// 4. Empty-string override is treated as unset, not a literal empty path.
assert(
  "empty-string PPTXDIFF_CHROME_PATH is treated as unset",
  resolveBrowserExecutable({
    env: { PPTXDIFF_CHROME_PATH: "" },
    platform: "linux",
    existsSync: () => false,
  }) === null
);

console.log(`browser-resolve check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All browser-resolve checks passed (GREEN).");
}
