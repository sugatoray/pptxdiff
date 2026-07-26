#!/usr/bin/env node
// Regenerates pptxdiff's docs-site screenshots/GIFs by driving the REAL served
// app with Playwright — the same technique used by hand to produce the
// current docs/assets/img/pptxdiff_*.{png,gif} files. See
// docs/.scrolls/DOCS.md ("real screenshots/GIF" section) and
// docs/.scrolls/WISDOM.md ("capturing real screenshots/GIFs" addendum) for
// the lessons this script encodes (full-page over fragile ancestor crops,
// the `multiple` attribute being stripped by the DC runtime so file inputs
// must be found via their <label> text, and the ffmpeg-has-no-gif-encoder
// workaround for the animated scenario).
//
// Requires the `playwright` npm package. It is deliberately NOT a
// package.json dependency (adding it there would make every `npm install`
// download a Chromium build for a script most contributors never run) —
// install it yourself first, e.g.:
//   npm install --no-save playwright && npx playwright install chromium
// (In a sandbox where `playwright` is already installed globally, point
// NODE_PATH at its global node_modules instead, e.g.
// `NODE_PATH=/opt/node22/lib/node_modules node docs-site/scripts/capture_screenshots.mjs`.)
//
// Usage (from the repo root):
//   node src/pptxdiff/docs-site/scripts/capture_screenshots.mjs [options]
//
// Options:
//   --list             Print scenario ids and exit, capturing nothing.
//   --only a,b,c        Comma-separated scenario ids to run (default: all).
//   --out-dir DIR       Where to write output files (default: docs-site/docs/assets/img).
//   --headed            Launch a visible browser (default: headless).
//   --keep-gif-frames   Don't delete the intermediate PNG frame sequence for GIF scenarios.

// `playwright` is resolved lazily via requirePlaywright() (CJS require, so
// NODE_PATH is honored) rather than a static ESM import, since ESM import
// resolution ignores NODE_PATH and this package is intentionally not a
// package.json dependency (see header comment above).
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(DIR, "..", "..", "..", ".."); // scripts -> docs-site -> pptxdiff -> src -> repo root
const CLI_JS = path.join(REPO_ROOT, "bin", "cli.js");
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, "src/pptxdiff/docs-site/docs/assets/img");
const FIXTURE_BEFORE = path.join(REPO_ROOT, "docs/assets/sample_before.pptx");
const FIXTURE_AFTER = path.join(REPO_ROOT, "docs/assets/sample_after.pptx");
const VIEWPORT = { width: 1280, height: 900 };

function requirePlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require("playwright");
  } catch (e) {
    if (e.code !== "MODULE_NOT_FOUND") throw e;
    console.error(
      "Could not resolve the `playwright` package.\n" +
        "Install it first: npm install --no-save playwright && npx playwright install chromium\n" +
        "(or set NODE_PATH to a location that already has it installed globally)."
    );
    process.exit(1);
  }
}

/* ---------- app-driving helpers ---------- */

async function waitForSampleDeckLoaded(page) {
  // The sample deck loads automatically and diffs itself with no user
  // action; wait for the diff-count summary text (only rendered once both
  // decks are parsed and diffed) rather than a fixed sleep.
  await page.getByText(/differences?$/).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(400); // let the SVG slide renders visually settle
}

async function resetToLightMode(page) {
  const btn = page.getByRole("button", { name: /^(Dark|Light) mode$/ });
  const label = await btn.textContent();
  if (label && label.trim() === "Light mode") {
    // Currently dark (button offers to switch to light) — no, wait: button
    // TEXT is what clicking it will switch TO, so "Light mode" means we're
    // currently dark and need one click to reach light.
    await btn.click();
    await page.waitForTimeout(300);
  }
}

/* ---------- scenarios ---------- */

const SCENARIOS = [
  {
    id: "single-pair-view",
    file: "pptxdiff_single-pair-view.png",
    kind: "png",
    fullPage: false,
    async run(page) {
      await waitForSampleDeckLoaded(page);
    },
  },
  {
    id: "diff-list",
    file: "pptxdiff_diff-list.png",
    kind: "png",
    fullPage: true,
    async run(page) {
      await waitForSampleDeckLoaded(page);
    },
  },
  {
    id: "all-pairs-view",
    file: "pptxdiff_all-pairs-view.png",
    kind: "png",
    fullPage: false,
    async run(page) {
      await waitForSampleDeckLoaded(page);
      await page.getByRole("button", { name: /All pairs/ }).click();
      await page.waitForTimeout(300);
    },
  },
  {
    id: "reviewer-workflow",
    file: "pptxdiff_reviewer-workflow.png",
    kind: "png",
    fullPage: true,
    async run(page) {
      await waitForSampleDeckLoaded(page);
      await page.getByPlaceholder("@handle or email").fill("alice");
      await page.getByPlaceholder("Name (optional)").fill("Alice");
      await page.getByRole("button", { name: "Add reviewer" }).click();
      const approveDiff = page.locator('[aria-label="Approve this difference"]').first();
      if (await approveDiff.count()) {
        await approveDiff.click();
        await page.waitForTimeout(200);
      }
    },
  },
  {
    id: "export-menu",
    file: "pptxdiff_export-menu.png",
    kind: "png",
    fullPage: false,
    async run(page) {
      await waitForSampleDeckLoaded(page);
      await page.getByText("Export ▾", { exact: true }).click();
      await page.waitForTimeout(200);
    },
  },
  {
    id: "merge-preview",
    file: "pptxdiff_merge-preview.png",
    kind: "png",
    fullPage: true,
    async run(page) {
      await waitForSampleDeckLoaded(page);
      await page.getByText("Export ▾", { exact: true }).click();
      await page.getByText("Preview merge winners…", { exact: true }).click();
      await page.waitForTimeout(300);
    },
  },
  {
    id: "self-tests",
    file: "pptxdiff_self-tests.png",
    kind: "png",
    fullPage: false,
    async run(page) {
      await waitForSampleDeckLoaded(page);
      await page.getByRole("button", { name: "Run self-tests" }).click();
      await page.getByText(/\/ \d+ passed/).waitFor({ timeout: 15000 });
    },
    // Tight element crop when possible; falls back to full page if the
    // locator doesn't resolve cleanly (see WISDOM.md on fragile ancestor crops).
    async locateCropTarget(page) {
      // Note: the browser normalizes the style attribute (space after each
      // colon) when serialized back out, regardless of how it's written in
      // index.html's source — match against that normalized form.
      const panel = page
        .getByText("Regression self-tests", { exact: false })
        .locator("xpath=ancestor::div[contains(@style,'border-radius: 12px')][1]");
      return (await panel.count()) === 1 ? panel : null;
    },
  },
  {
    id: "batch-results",
    file: "pptxdiff_batch-results.png",
    kind: "png",
    fullPage: false,
    async run(page) {
      await waitForSampleDeckLoaded(page);
      await page.getByRole("button", { name: "Batch", exact: true }).click();
      await page
        .locator('label:has-text("Before files") input[type="file"]')
        .setInputFiles(FIXTURE_BEFORE);
      await page
        .locator('label:has-text("After files") input[type="file"]')
        .setInputFiles(FIXTURE_AFTER);
      await page.getByRole("button", { name: "Compare batch" }).click();
      await page.getByRole("button", { name: "Batch report → CSV" }).waitFor({ timeout: 20000 });
    },
  },
  {
    id: "dark-mode-toggle",
    file: "pptxdiff_dark-mode-toggle.gif",
    kind: "gif",
    fps: 8,
    // Header only, not the full page -- keeps the GIF focused on the actual
    // toggle + immediate visual feedback (title/background contrast) and
    // the file size reasonable for a git-tracked docs asset.
    viewport: { width: 900, height: 240 },
    async run(page) {
      await waitForSampleDeckLoaded(page);
      await resetToLightMode(page);
      await page.waitForTimeout(300); // idle beat so the GIF isn't just the click frame
      await page.getByRole("button", { name: "Dark mode", exact: true }).click();
      await page.waitForTimeout(900); // cover the theme CSS transition
    },
  },
];

/* ---------- ffmpeg (Playwright-bundled) resolution ---------- */

function findBundledFfmpeg() {
  const browsersDir =
    process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== "0"
      ? process.env.PLAYWRIGHT_BROWSERS_PATH
      : path.join(os.homedir(), ".cache", "ms-playwright");
  if (!fs.existsSync(browsersDir)) return null;
  const ffmpegDir = fs.readdirSync(browsersDir).find((d) => d.startsWith("ffmpeg-"));
  if (!ffmpegDir) return null;
  const dirPath = path.join(browsersDir, ffmpegDir);
  const skip = new Set(["COPYING.LGPLv2.1", "DEPENDENCIES_VALIDATED", "INSTALLATION_COMPLETE"]);
  const bin = fs.readdirSync(dirPath).find((f) => !skip.has(f) && f.startsWith("ffmpeg"));
  return bin ? path.join(dirPath, bin) : null;
}

async function webmToGif({ webmPath, outPath, fps, width, keepFrames }) {
  const ffmpeg = findBundledFfmpeg();
  if (!ffmpeg) {
    console.warn(`  [skip] no bundled Playwright ffmpeg found — leaving ${path.basename(outPath)} unchanged`);
    return false;
  }
  const framesDir = await fsp.mkdtemp(path.join(os.tmpdir(), "pptxdiff-gif-frames-"));
  try {
    // Playwright's bundled ffmpeg build has no gif muxer and no fps/palettegen
    // filters — it can only decode + scale + emit a raw PNG sequence at a
    // fixed output frame rate. See WISDOM.md.
    const extract = spawnSync(
      ffmpeg,
      ["-y", "-i", webmPath, "-vf", `scale=${width}:-1`, "-r", String(fps), path.join(framesDir, "frame-%04d.png")],
      { stdio: "pipe" }
    );
    if (extract.status !== 0) {
      console.warn(`  [skip] ffmpeg frame extraction failed for ${path.basename(outPath)}:\n${extract.stderr}`);
      return false;
    }
    const frameCount = fs.readdirSync(framesDir).filter((f) => f.endsWith(".png")).length;
    if (frameCount === 0) {
      console.warn(`  [skip] ffmpeg produced no frames for ${path.basename(outPath)}`);
      return false;
    }
    const gifScript = path.join(DIR, "webm_to_gif.py");
    const assemble = spawnSync(
      "uv",
      ["run", "--no-project", "--with", "pillow", "python3", gifScript, framesDir, outPath, String(fps)],
      { stdio: "inherit" }
    );
    if (assemble.status !== 0) {
      console.warn(`  [skip] Pillow GIF assembly failed for ${path.basename(outPath)}`);
      return false;
    }
    return true;
  } finally {
    if (!keepFrames) await fsp.rm(framesDir, { recursive: true, force: true });
    else console.log(`  kept frames at ${framesDir}`);
  }
}

/* ---------- server lifecycle ---------- */

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_JS], { env: process.env });
    let out = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("timed out waiting for bin/cli.js to print its URL"));
    }, 8000);
    child.stdout.on("data", (chunk) => {
      out += chunk.toString();
      const m = out.match(/pptxdiff running at (\S+)/);
      if (m) {
        clearTimeout(timeout);
        resolve({ url: m[1], child });
      }
    });
    child.stderr.on("data", () => {});
    child.on("error", (e) => {
      clearTimeout(timeout);
      reject(e);
    });
  });
}

/* ---------- CLI ---------- */

function parseArgs(argv) {
  const args = { only: null, outDir: DEFAULT_OUT_DIR, headed: false, list: false, keepGifFrames: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") args.list = true;
    else if (a === "--only") args.only = argv[++i].split(",").map((s) => s.trim());
    else if (a === "--out-dir") args.outDir = path.resolve(argv[++i]);
    else if (a === "--headed") args.headed = true;
    else if (a === "--keep-gif-frames") args.keepGifFrames = true;
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    for (const s of SCENARIOS) console.log(`${s.id}\t${s.kind}\t${s.file}`);
    return;
  }

  const scenarios = args.only ? SCENARIOS.filter((s) => args.only.includes(s.id)) : SCENARIOS;
  if (args.only) {
    const missing = args.only.filter((id) => !SCENARIOS.some((s) => s.id === id));
    if (missing.length) {
      console.error(`Unknown scenario id(s): ${missing.join(", ")}`);
      console.error(`Known ids: ${SCENARIOS.map((s) => s.id).join(", ")}`);
      process.exit(2);
    }
  }

  await fsp.mkdir(args.outDir, { recursive: true });

  const pw = requirePlaywright();
  console.log("Starting bin/cli.js...");
  const { url, child: serverProcess } = await startServer();
  console.log(`Server up at ${url}`);

  const browser = await pw.chromium.launch({ headless: !args.headed });
  const results = [];

  try {
    for (const scenario of scenarios) {
      process.stdout.write(`Capturing ${scenario.id}... `);
      try {
        const viewport = scenario.viewport || VIEWPORT;
        if (scenario.kind === "png") {
          const context = await browser.newContext({ viewport });
          const page = await context.newPage();
          await page.goto(url);
          await scenario.run(page);
          const outPath = path.join(args.outDir, scenario.file);
          let target = page;
          if (scenario.locateCropTarget) {
            const cropped = await scenario.locateCropTarget(page);
            if (cropped) target = cropped;
          }
          await target.screenshot({ path: outPath, fullPage: scenario.fullPage ?? false });
          await context.close();
          console.log(`done -> ${path.relative(REPO_ROOT, outPath)}`);
          results.push({ id: scenario.id, ok: true, file: outPath });
        } else if (scenario.kind === "gif") {
          const videoDir = await fsp.mkdtemp(path.join(os.tmpdir(), "pptxdiff-gif-video-"));
          const context = await browser.newContext({ viewport, recordVideo: { dir: videoDir, size: viewport } });
          const page = await context.newPage();
          await page.goto(url);
          await scenario.run(page);
          await context.close(); // finalizes the .webm
          const video = await page.video().path();
          const outPath = path.join(args.outDir, scenario.file);
          const ok = await webmToGif({ webmPath: video, outPath, fps: scenario.fps, width: viewport.width, keepFrames: args.keepGifFrames });
          await fsp.rm(videoDir, { recursive: true, force: true });
          if (ok) {
            console.log(`done -> ${path.relative(REPO_ROOT, outPath)}`);
            results.push({ id: scenario.id, ok: true, file: outPath });
          } else {
            console.log("skipped (see warning above)");
            results.push({ id: scenario.id, ok: false });
          }
        }
      } catch (e) {
        console.log(`FAILED: ${e.message}`);
        results.push({ id: scenario.id, ok: false, error: e.message });
      }
    }
  } finally {
    await browser.close();
    serverProcess.kill();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} scenarios captured.`);
  if (failed.length) {
    console.log(`Not captured: ${failed.map((f) => f.id).join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
