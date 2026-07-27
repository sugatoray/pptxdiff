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
//   --list              Print scenario ids and exit, capturing nothing.
//   --only a,b,c        Comma-separated scenario ids to run (default: all).
//   --staging-dir DIR   Where captures are written first (default: <target-dir>/.staging).
//   --target-dir DIR    The committed image directory (default: docs-site/docs/assets/img).
//   --check             Dry run: report what would change, don't touch --target-dir.
//   --headed            Launch a visible browser (default: headless).
//   --keep-gif-frames   Don't delete the intermediate PNG frame sequence for GIF scenarios.
//
// Every capture lands in --staging-dir first, never directly in --target-dir.
// Each staged file is then compared PIXEL-BY-PIXEL (compare_images.py, not a
// byte/hash diff — see its header comment for why) against the same-named
// file already in --target-dir; --target-dir is only written to for files
// that are new or whose pixels actually changed. This keeps the capture
// PARAMETERS (viewport, crop, fullPage, fps, the run() steps themselves —
// see SCENARIOS below) completely unchanged from a plain capture; only the
// destination and the promotion decision are different. See
// test_scenario_manifest.mjs, which locks those parameters against
// accidental drift, and test_sync_staging_to_target.mjs, which covers the
// promotion logic itself.

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
const DEFAULT_TARGET_DIR = path.join(REPO_ROOT, "src/pptxdiff/docs-site/docs/assets/img");
const DEFAULT_STAGING_DIR = path.join(DEFAULT_TARGET_DIR, ".staging");
const COMPARE_SCRIPT = path.join(DIR, "compare_images.py");
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

export const SCENARIOS = [
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

/* ---------- scenario metadata (for test_scenario_manifest.mjs) ---------- */

// Plain-data projection of SCENARIOS -- deliberately excludes the run()/
// locateCropTarget() function bodies (comparing function source would be
// brittle to any harmless refactor); this is exactly the set of knobs the
// staging workflow promises to leave alone: resolution (viewport), crop mode
// (fullPage vs a located element), and GIF frame rate. Used both by the CLI
// (--list) and by test_scenario_manifest.mjs to lock these against silent
// drift.
export function scenarioMetadata() {
  return SCENARIOS.map((s) => ({
    id: s.id,
    file: s.file,
    kind: s.kind,
    viewport: s.viewport || VIEWPORT,
    fullPage: s.kind === "png" ? !!s.fullPage : undefined,
    fps: s.kind === "gif" ? s.fps : undefined,
    hasCropTarget: !!s.locateCropTarget,
  }));
}

/* ---------- staging -> target promotion (pixel-level, not byte-level) ---------- */

// Compares stagingPath against targetPath with compare_images.py (decoded
// pixels, not file bytes -- see that script's header for why) and copies
// staging over target only when they differ (or target doesn't exist yet).
// Synchronous and side-effect-free when check=true, which is what makes it
// cheaply unit-testable in test_sync_staging_to_target.mjs without a browser.
export function syncStagedFileToTarget({ stagingPath, targetPath, check = false }) {
  if (!fs.existsSync(stagingPath)) {
    throw new Error(`staged file not found: ${stagingPath}`);
  }
  const targetExists = fs.existsSync(targetPath);
  let matches = false;
  if (targetExists) {
    const result = spawnSync(
      "uv",
      ["run", "--no-project", "--with", "pillow", "python3", COMPARE_SCRIPT, stagingPath, targetPath],
      { stdio: "pipe", encoding: "utf8" }
    );
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(`compare_images.py failed (exit ${result.status}): ${result.stderr}`);
    }
    matches = result.status === 0;
  }
  const action = !targetExists ? "created" : matches ? "unchanged" : "updated";
  const changed = action !== "unchanged";
  if (changed && !check) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(stagingPath, targetPath);
  }
  return { action, changed };
}

/* ---------- ffmpeg (Playwright-bundled) resolution ---------- */

export function findBundledFfmpeg() {
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

export function parseArgs(argv) {
  const args = {
    only: null,
    stagingDir: DEFAULT_STAGING_DIR,
    targetDir: DEFAULT_TARGET_DIR,
    headed: false,
    list: false,
    check: false,
    keepGifFrames: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") args.list = true;
    else if (a === "--only") args.only = argv[++i].split(",").map((s) => s.trim());
    else if (a === "--staging-dir") args.stagingDir = path.resolve(argv[++i]);
    else if (a === "--target-dir") args.targetDir = path.resolve(argv[++i]);
    else if (a === "--check") args.check = true;
    else if (a === "--headed") args.headed = true;
    else if (a === "--keep-gif-frames") args.keepGifFrames = true;
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    for (const m of scenarioMetadata()) {
      const size = `${m.viewport.width}x${m.viewport.height}`;
      const mode = m.kind === "gif" ? `${m.fps}fps` : m.fullPage ? "fullPage" : "viewport";
      console.log(`${m.id}\t${m.kind}\t${size}\t${mode}\t${m.file}`);
    }
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

  await fsp.mkdir(args.stagingDir, { recursive: true });
  if (!args.check) await fsp.mkdir(args.targetDir, { recursive: true });

  const pw = requirePlaywright();
  console.log("Starting bin/cli.js...");
  const { url, child: serverProcess } = await startServer();
  console.log(`Server up at ${url}`);
  if (args.check) console.log("--check: staging only, target-dir will not be modified");

  const browser = await pw.chromium.launch({ headless: !args.headed });
  const results = [];

  try {
    for (const scenario of scenarios) {
      process.stdout.write(`Capturing ${scenario.id}... `);
      try {
        const viewport = scenario.viewport || VIEWPORT;
        const stagingPath = path.join(args.stagingDir, scenario.file);
        const targetPath = path.join(args.targetDir, scenario.file);

        if (scenario.kind === "png") {
          const context = await browser.newContext({ viewport });
          const page = await context.newPage();
          await page.goto(url);
          await scenario.run(page);
          let target = page;
          if (scenario.locateCropTarget) {
            const cropped = await scenario.locateCropTarget(page);
            if (cropped) target = cropped;
          }
          await target.screenshot({ path: stagingPath, fullPage: scenario.fullPage ?? false });
          await context.close();
        } else if (scenario.kind === "gif") {
          const videoDir = await fsp.mkdtemp(path.join(os.tmpdir(), "pptxdiff-gif-video-"));
          const context = await browser.newContext({ viewport, recordVideo: { dir: videoDir, size: viewport } });
          const page = await context.newPage();
          await page.goto(url);
          await scenario.run(page);
          await context.close(); // finalizes the .webm
          const video = await page.video().path();
          const ok = await webmToGif({ webmPath: video, outPath: stagingPath, fps: scenario.fps, width: viewport.width, keepFrames: args.keepGifFrames });
          await fsp.rm(videoDir, { recursive: true, force: true });
          if (!ok) {
            console.log("skipped (see warning above)");
            results.push({ id: scenario.id, ok: false });
            continue;
          }
        }

        const { action, changed } = syncStagedFileToTarget({ stagingPath, targetPath, check: args.check });
        const verb = args.check
          ? { created: "would create", updated: "would update", unchanged: "unchanged" }[action]
          : { created: "created", updated: "updated", unchanged: "unchanged" }[action];
        console.log(`${verb} -> ${path.relative(REPO_ROOT, targetPath)}`);
        results.push({ id: scenario.id, ok: true, action, changed });
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
  const changed = results.filter((r) => r.ok && r.changed);
  console.log(`\n${results.length - failed.length}/${results.length} scenarios captured.`);
  console.log(`${changed.length} target file(s) ${args.check ? "would change" : "changed"}: ${changed.map((r) => r.id).join(", ") || "(none)"}`);
  if (failed.length) {
    console.log(`Not captured: ${failed.map((f) => f.id).join(", ")}`);
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
