"use strict";

const fs = require("node:fs");
const { chromium } = require("playwright-core");
const { startServer } = require("pptxdiff/bin/cli.js");
const { resolveBrowserExecutable } = require("./browser.js");

// The app's error banner (index.html's errorMsg panel) is written as
// `style="background:#FBEFEC;..."` in the template source, but React
// applies inline styles via the DOM `style` PROPERTY (CSSStyleDeclaration),
// not by writing an HTML `style="..."` ATTRIBUTE string — confirmed
// directly: `element.getAttribute('style')` on the rendered banner returns
// null. That means a `div[style*="#FBEFEC"]` CSS attribute selector can
// NEVER match anything in this app, for any inline-styled element, not
// just this one — found the hard way debugging a false "no error banner"
// result that turned out to be a broken detector, not a real app bug (the
// error WAS being set correctly the whole time — see git history for the
// full trace). getComputedStyle().backgroundColor is the reliable check;
// browsers normalize it to `rgb(r, g, b)` regardless of how the color was
// specified, so this function (used inside page.evaluate/waitForFunction,
// hence written as a plain in-page function rather than a Node-side
// constant) is the one true way to find this banner.
function findErrorBannerText() {
  const el = Array.from(document.querySelectorAll("div")).find(
    (d) => getComputedStyle(d).backgroundColor === "rgb(251, 239, 236)"
  );
  return el ? el.textContent : null;
}
const FIND_ERROR_BANNER_TEXT_SRC = findErrorBannerText.toString();

const DEFAULT_TIMEOUT_MS = 30000;
const HASH_RE = "[0-9a-f]{64}";

class BrowserUnavailableError extends Error {}
class PptxParseError extends Error {}

// Pure: extracts the "Before"/"After" content-checksum hex string (SPEC.md
// §29) from the app's own rendered page text, or null if it's not a
// settled hash yet (still "computing…", or "unavailable"). Exported mainly
// so it's independently testable without a real browser.
function extractChecksumLabel(bodyText, prefix) {
  const m = bodyText.match(new RegExp(`${prefix}:\\s*(${HASH_RE})`, "i"));
  return m ? m[1] : null;
}

// Impure: launches a real headless browser against a freshly-started local
// copy of the pptxdiff app, and returns a handle to drive it. This is the
// ONE place browser/server lifecycle is managed — every automation function
// below goes through this, per CLI_API_DESIGN.md's "shared automation shim"
// decision (built once, reused by both the CLI and the Web API).
//
// The app boots with a default sample deck already loading on BOTH sides
// (componentDidMount()'s buildSample() call — see index.html), and the
// "Differences (N)" panel header can render from the constructor's initial
// EMPTY state before that load even starts (found via a genuine RED test
// failure — see test_automation_e2e.mjs's history and WISDOM.md — waiting
// on that text alone was not a reliable "finished loading" signal). The
// content-checksum labels are: each side's checksum is computed as the
// LAST step of that side's own ingest() call and lands in the SAME setState
// as everything else about that side (name, slides, decision-reset — see
// ingest() in index.html), so "both checksum labels show a real 64-hex
// value" is an atomic, race-proof "this side's data is fully settled"
// signal — used both here (initial boot) and in uploadDeck (a new file).
async function launchApp({ env = process.env, platform = process.platform, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const { server, url } = await startServer();
  const executablePath = resolveBrowserExecutable({ env, platform }) || undefined;

  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless: true });
  } catch (e) {
    server.close();
    throw new BrowserUnavailableError(
      "Could not launch a browser to drive pptxdiff.\n" +
      "Set PPTXDIFF_CHROME_PATH to a Chrome/Chromium/Edge executable, or run `npx playwright install chromium`.\n" +
      "Underlying error: " + (e && e.message ? e.message : String(e))
    );
  }

  const page = await browser.newPage();
  // Installed before any navigation (and re-installed automatically on any
  // future one) so window.__pptxdiffFindErrorBanner is available for every
  // waitForFunction/evaluate call below — see findErrorBannerText's own
  // comment for why this specific detection approach is necessary.
  await page.addInitScript(`window.__pptxdiffFindErrorBanner = ${FIND_ERROR_BANNER_TEXT_SRC};`);
  await page.goto(url);

  try {
    await page.waitForFunction(
      (hashRe) => new RegExp(`Before:\\s*${hashRe}`, "i").test(document.body.innerText) && new RegExp(`After:\\s*${hashRe}`, "i").test(document.body.innerText),
      HASH_RE,
      { timeout: timeoutMs }
    );
  } catch (e) {
    await browser.close().catch(() => {});
    server.close();
    throw new Error(`Timed out after ${timeoutMs}ms waiting for pptxdiff's own default sample deck to finish loading.`);
  }

  return {
    page,
    timeoutMs,
    async close() {
      await browser.close().catch(() => {});
      server.close();
    },
  };
}

// Impure: sets one side's file input and waits until that side has fully
// re-settled — either its own content checksum changes to a new value
// (proving a brand new ingest() completed end-to-end for this file, not
// just that the name updated — see launchApp's comment on why the
// checksum label specifically is the reliable signal), or the app's error
// banner appears (the file couldn't be parsed at all, so no new checksum
// will ever land). `input` is either a file path (string) or
// `{ name, buffer }` for in-memory content (used by @pptxdiff/server,
// which receives uploaded bytes, not a path on disk). The two upload-bar
// file inputs are always rendered in this fixed order (Before, then After
// — see index.html's `uploaders` array in renderVals()), so index 0/1 is a
// stable way to target them without relying on visible label text.
async function uploadDeck(page, side, input, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const idx = side === "before" ? 0 : 1;
  const prefix = side === "before" ? "Before" : "After";
  const locator = page.locator('input[type="file"][accept=".pptx"]:not([multiple])').nth(idx);

  const priorText = await page.locator("body").innerText();
  const priorHash = extractChecksumLabel(priorText, prefix);

  if (typeof input === "string") {
    await locator.setInputFiles(input);
  } else {
    await locator.setInputFiles({
      name: input.name || (side === "before" ? "before.pptx" : "after.pptx"),
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      buffer: input.buffer,
    });
  }

  try {
    await page.waitForFunction(
      ({ hashRe, prefix, priorHash }) => {
        if (window.__pptxdiffFindErrorBanner()) return true;
        const m = document.body.innerText.match(new RegExp(`${prefix}:\\s*(${hashRe})`, "i"));
        return !!m && m[1] !== priorHash;
      },
      { hashRe: HASH_RE, prefix, priorHash },
      { timeout: timeoutMs }
    );
  } catch (e) {
    throw new Error(`Timed out after ${timeoutMs}ms waiting for the ${side} file to finish uploading.`);
  }

  const bannerText = await page.evaluate(() => window.__pptxdiffFindErrorBanner());
  if (bannerText) {
    throw new PptxParseError(`pptxdiff could not read the ${side} file: ${bannerText.trim()}`);
  }
}

// Impure: drives the real "Export ▾ → JSON report" menu path and captures
// the resulting download — the exact same code path a human clicking the
// button exercises (buildJsonReport()/downloadBlob()), so the CLI/API can
// never silently disagree with what the GUI would show for the same files.
async function exportJsonReport(page) {
  await page.locator('summary:has-text("Export")').click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator('button:has-text("JSON report")').click();
  const download = await downloadPromise;
  const filePath = await download.path();
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

// Diffs two decks end-to-end and returns the same JSON report shape the
// GUI's "Export → JSON report" button produces (see buildJsonReport() in
// index.html): { deckBefore, deckAfter, contentChecksum, presentationDiffs,
// slides: [{ key, label, decision, reviewerVotes, comments, differences }],
// history, uiState }.
async function diffDecks(beforeInput, afterInput, opts = {}) {
  const app = await launchApp(opts);
  try {
    await uploadDeck(app.page, "before", beforeInput, { timeoutMs: app.timeoutMs });
    await uploadDeck(app.page, "after", afterInput, { timeoutMs: app.timeoutMs });
    return await exportJsonReport(app.page);
  } finally {
    await app.close();
  }
}

// Computes just one deck's parser-independent SHA-256 content checksum
// (SPEC.md §29) without needing a second file — the app already boots with
// a default deck loaded on the other side, so only the "before" slot needs
// replacing.
async function computeChecksum(input, opts = {}) {
  const app = await launchApp(opts);
  try {
    await uploadDeck(app.page, "before", input, { timeoutMs: app.timeoutMs });
    const bodyText = await app.page.locator("body").innerText();
    const hash = extractChecksumLabel(bodyText, "Before");
    if (!hash) throw new Error('Could not read the "Before" content checksum from the app.');
    return { algorithm: "SHA-256", hash };
  } finally {
    await app.close();
  }
}

module.exports = {
  BrowserUnavailableError,
  PptxParseError,
  extractChecksumLabel,
  launchApp,
  uploadDeck,
  exportJsonReport,
  diffDecks,
  computeChecksum,
};
