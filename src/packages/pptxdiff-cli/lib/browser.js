"use strict";

const fs = require("node:fs");

// Per-platform candidate paths for an already-installed Chrome/Chromium/Edge,
// checked in order — first one that exists wins. Kept deliberately short and
// well-known rather than exhaustive: this is a convenience fast path, not the
// only way to find a browser (playwright-core's own managed-browser
// resolution is the fallback when nothing here matches — see
// resolveBrowserExecutable's final branch).
const CANDIDATES = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
    "/snap/bin/chromium",
  ],
};

// Pure: decides which browser executable path (if any) the automation layer
// should hand to playwright-core's `executablePath` launch option.
//   1. PPTXDIFF_CHROME_PATH, if set to a non-empty string, always wins —
//      trusted verbatim, same as this project's existing PPTXDIFF_LITE_MODE
//      env-var convention (see bin/cli.js).
//   2. Otherwise, search this platform's well-known install locations
//      (falling back to the `linux` list for any platform not explicitly
//      listed — most non-Windows/non-macOS platforms share Linux-style
//      install paths) and return the first one that exists.
//   3. If nothing matches, return null — this is NOT an error at this layer;
//      it means "let playwright-core try its own managed-browser resolution"
//      (which works for free wherever PLAYWRIGHT_BROWSERS_PATH already
//      points at an installed browser, or after a one-time
//      `playwright install chromium`). The caller decides how to react if
//      that also fails.
function resolveBrowserExecutable({ env = process.env, platform = process.platform, existsSync = fs.existsSync } = {}) {
  const override = env.PPTXDIFF_CHROME_PATH;
  if (override) return override;

  const candidates = CANDIDATES[platform] || CANDIDATES.linux;
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

module.exports = { resolveBrowserExecutable, CANDIDATES };
