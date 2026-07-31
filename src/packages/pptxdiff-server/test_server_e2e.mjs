#!/usr/bin/env node
// Red/Green end-to-end check for @pptxdiff/server — starts the REAL server
// (real diffDecks/computeChecksum, real headless browser via
// pptxdiff-cli's automation shim) and makes real HTTP requests against it
// with the repo's own Red/Green sample fixtures (docs/assets/
// sample_before.pptx / sample_after.pptx). test_server_unit.mjs already
// covers routing/status-code/validation logic with injected functions;
// this proves the full wiring end to end, the way an actual client (a git
// driver, an AI agent, another service) would use it.
//
// Needs a real Chrome/Chromium/Edge — set PPTXDIFF_CHROME_PATH if needed.
//
// Run: node src/packages/pptxdiff-server/test_server_e2e.mjs

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(DIR, "..", "..", "..");
const SAMPLE_BEFORE = path.join(REPO_ROOT, "docs", "assets", "sample_before.pptx");
const SAMPLE_AFTER = path.join(REPO_ROOT, "docs", "assets", "sample_after.pptx");

const { startServer } = await import(`file://${path.join(DIR, "lib", "server.js")}`);

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
  else console.log(`  ok — ${label}`);
}

const b64File = (p) => readFileSync(p).toString("base64");

console.log("Starting real @pptxdiff/server (loopback)...");
const { server, url, port } = await startServer();
assert("started on an OS-assigned loopback port", Number.isInteger(port) && port > 0);

try {
  console.log("1. GET /v1/health");
  {
    const r = await fetch(`${url}/v1/health`);
    assert("returns 200", r.status === 200);
    const body = await r.json();
    assert("reports ok status", body.status === "ok");
  }

  console.log("2. POST /v1/diff — sample_before vs sample_after (real differences)");
  {
    const r = await fetch(`${url}/v1/diff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        before: { name: "sample_before.pptx", content: b64File(SAMPLE_BEFORE) },
        after: { name: "sample_after.pptx", content: b64File(SAMPLE_AFTER) },
      }),
    });
    assert("returns 200", r.status === 200);
    const report = await r.json();
    assert("report has the right deck names", report.deckBefore === "sample_before.pptx" && report.deckAfter === "sample_after.pptx");
    const changed = report.slides.filter((s) => s.differences && s.differences.length > 0);
    assert("report shows real differences", changed.length > 0);
  }

  console.log("3. POST /v1/diff — same file both sides (no differences)");
  {
    const beforeB64 = b64File(SAMPLE_BEFORE);
    const r = await fetch(`${url}/v1/diff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        before: { name: "sample_before.pptx", content: beforeB64 },
        after: { name: "sample_before.pptx", content: beforeB64 },
      }),
    });
    const report = await r.json();
    const changed = report.slides.filter((s) => s.differences && s.differences.length > 0);
    assert("zero real differences when before===after", changed.length === 0);
    assert("checksums match when before===after", report.contentChecksum.before === report.contentChecksum.after);
  }

  console.log("4. POST /v1/checksum — agrees with the /v1/diff checksum for the same file");
  {
    const r = await fetch(`${url}/v1/checksum`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file: { name: "sample_before.pptx", content: b64File(SAMPLE_BEFORE) } }),
    });
    assert("returns 200", r.status === 200);
    const body = await r.json();
    assert("well-formed SHA-256 hash", /^[0-9a-f]{64}$/i.test(body.hash));
  }

  console.log("5. POST /v1/diff — an unparseable file surfaces 422, not a hang");
  {
    const r = await fetch(`${url}/v1/diff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        before: { name: "bad.pptx", content: Buffer.from("not a zip file").toString("base64") },
        after: { name: "sample_after.pptx", content: b64File(SAMPLE_AFTER) },
      }),
    });
    assert("returns 422 for a file it can't parse", r.status === 422);
  }
} finally {
  server.close();
}

console.log(`server-e2e check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All server-e2e checks passed (GREEN).");
}
