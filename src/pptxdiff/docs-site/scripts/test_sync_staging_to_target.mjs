#!/usr/bin/env node
// Red/Green regression check for syncStagedFileToTarget() -- the function
// that decides whether a freshly staged screenshot should overwrite the
// committed one in docs-site/docs/assets/img/. Exercises the REAL
// compare_images.py (via a Pillow subprocess), not a mock, against small
// synthetic fixture PNGs -- fast (no Playwright/browser/server needed) and,
// per this project's convention (see test_gen-sample-pptx.py,
// test_offline_capable.mjs), a real dependency is worth a couple seconds of
// subprocess overhead over a mock that could silently drift from what
// compare_images.py actually does.
//
// Run: node src/pptxdiff/docs-site/scripts/test_sync_staging_to_target.mjs

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { syncStagedFileToTarget } from "./capture_screenshots.mjs";

function makePng(filePath, rgb, { optimize = false } = {}) {
  const [r, g, b] = rgb;
  const script = `from PIL import Image; Image.new("RGB", (12, 10), (${r},${g},${b})).save("${filePath}", optimize=${optimize ? "True" : "False"})`;
  const result = spawnSync("uv", ["run", "--no-project", "--with", "pillow", "python3", "-c", script], { stdio: "pipe", encoding: "utf8" });
  if (result.status !== 0) throw new Error(`fixture generation failed: ${result.stderr}`);
}

async function withTempDirs(fn) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "pptxdiff-sync-test-"));
  const staging = path.join(root, "staging");
  const target = path.join(root, "target");
  await fsp.mkdir(staging, { recursive: true });
  await fsp.mkdir(target, { recursive: true });
  try {
    await fn({ staging, target });
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
}

async function check_target_missing_is_created(t) {
  await withTempDirs(async ({ staging, target }) => {
    const stagingPath = path.join(staging, "a.png");
    const targetPath = path.join(target, "a.png");
    makePng(stagingPath, [10, 20, 30]);

    const result = syncStagedFileToTarget({ stagingPath, targetPath });
    if (result.action !== "created") throw new Error(`expected action "created", got "${result.action}"`);
    if (!result.changed) throw new Error("expected changed=true");
    if (!fs.existsSync(targetPath)) throw new Error("target file was not created");
    if (!fs.readFileSync(stagingPath).equals(fs.readFileSync(targetPath))) throw new Error("target bytes don't match staged bytes");
  });
  t.ok("missing target -> created, target now holds the staged file");
}

async function check_pixel_identical_but_different_bytes_is_unchanged(t) {
  await withTempDirs(async ({ staging, target }) => {
    const stagingPath = path.join(staging, "a.png");
    const targetPath = path.join(target, "a.png");
    makePng(stagingPath, [80, 160, 240], { optimize: false });
    makePng(targetPath, [80, 160, 240], { optimize: true }); // same pixels, different encoder settings
    const targetBytesBefore = fs.readFileSync(targetPath);
    if (targetBytesBefore.equals(fs.readFileSync(stagingPath))) {
      throw new Error("test setup should have produced different bytes for the same pixels");
    }

    const result = syncStagedFileToTarget({ stagingPath, targetPath });
    if (result.action !== "unchanged") throw new Error(`expected action "unchanged", got "${result.action}"`);
    if (result.changed) throw new Error("expected changed=false");
    if (!fs.readFileSync(targetPath).equals(targetBytesBefore)) {
      throw new Error("target was overwritten even though pixels matched -- this is the whole point of pixel-level comparison");
    }
  });
  t.ok("pixel-identical, byte-different (re-encoded) -> unchanged, target left untouched");
}

async function check_different_pixels_is_updated(t) {
  await withTempDirs(async ({ staging, target }) => {
    const stagingPath = path.join(staging, "a.png");
    const targetPath = path.join(target, "a.png");
    makePng(stagingPath, [255, 0, 0]);
    makePng(targetPath, [0, 255, 0]);

    const result = syncStagedFileToTarget({ stagingPath, targetPath });
    if (result.action !== "updated") throw new Error(`expected action "updated", got "${result.action}"`);
    if (!result.changed) throw new Error("expected changed=true");
    if (!fs.readFileSync(stagingPath).equals(fs.readFileSync(targetPath))) throw new Error("target bytes don't match staged bytes after promotion");
  });
  t.ok("genuinely different pixels -> updated, target now equals staged content");
}

async function check_dry_run_never_writes(t) {
  await withTempDirs(async ({ staging, target }) => {
    const stagingPath = path.join(staging, "a.png");
    const targetPath = path.join(target, "a.png");
    makePng(stagingPath, [255, 0, 0]);
    makePng(targetPath, [0, 255, 0]);
    const targetBytesBefore = fs.readFileSync(targetPath);

    const result = syncStagedFileToTarget({ stagingPath, targetPath, check: true });
    if (result.action !== "updated") throw new Error(`expected action "updated" (reported, not applied), got "${result.action}"`);
    if (!result.changed) throw new Error("expected changed=true even in dry-run mode (it's a report of what WOULD happen)");
    if (!fs.readFileSync(targetPath).equals(targetBytesBefore)) throw new Error("check:true must never write to target");
  });
  t.ok("check:true on a real mismatch -> reports 'updated' but never writes target");
}

async function check_dry_run_on_missing_target_never_creates(t) {
  await withTempDirs(async ({ staging, target }) => {
    const stagingPath = path.join(staging, "a.png");
    const targetPath = path.join(target, "a.png");
    makePng(stagingPath, [10, 20, 30]);

    const result = syncStagedFileToTarget({ stagingPath, targetPath, check: true });
    if (result.action !== "created") throw new Error(`expected action "created" (reported), got "${result.action}"`);
    if (fs.existsSync(targetPath)) throw new Error("check:true must never create target");
  });
  t.ok("check:true on a missing target -> reports 'created' but never creates it");
}

async function check_missing_staging_file_throws(t) {
  await withTempDirs(async ({ staging, target }) => {
    const stagingPath = path.join(staging, "does-not-exist.png");
    const targetPath = path.join(target, "a.png");
    let threw = false;
    try {
      syncStagedFileToTarget({ stagingPath, targetPath });
    } catch {
      threw = true;
    }
    if (!threw) throw new Error("expected syncStagedFileToTarget to throw when the staged file doesn't exist");
  });
  t.ok("missing staged file throws rather than silently doing nothing");
}

async function main() {
  const checks = [
    check_target_missing_is_created,
    check_pixel_identical_but_different_bytes_is_unchanged,
    check_different_pixels_is_updated,
    check_dry_run_never_writes,
    check_dry_run_on_missing_target_never_creates,
    check_missing_staging_file_throws,
  ];
  const failures = [];
  const t = { ok: (msg) => console.log(`  [OK] ${msg}`) };

  for (const check of checks) {
    try {
      await check(t);
    } catch (e) {
      failures.push(`${check.name}: ${e.message}`);
      console.log(`  [FAIL] ${check.name}: ${e.message}`);
    }
  }

  console.log(`\nsync-staging-to-target check: ${checks.length - failures.length}/${checks.length} passed`);
  if (failures.length) {
    console.log("FAILURES:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("All sync-staging-to-target checks passed (GREEN).");
}

main();
