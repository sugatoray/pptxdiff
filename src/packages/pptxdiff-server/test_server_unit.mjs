#!/usr/bin/env node
// Red/Green regression check for lib/server.js's request-handling logic,
// using INJECTED diffDecks/computeChecksum functions (no real browser) so
// this covers routing, status codes, and body validation quickly and
// deterministically. The real automation path (real browser, real sample
// fixtures) is covered separately by test_server_e2e.mjs, which starts an
// actual server and makes real HTTP requests against it — matching
// pptxdiff-cli's own two-layer testing split (test_cli_core.mjs vs.
// test_diff_checksum_cli.mjs).
//
// Run: node src/packages/pptxdiff-server/test_server_unit.mjs

import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const { createServer } = await import(`file://${path.join(DIR, "lib", "server.js")}`);

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
}

function withServer(opts, fn) {
  return new Promise((resolve, reject) => {
    const server = createServer(opts);
    server.listen(0, "127.0.0.1", async () => {
      const { port } = server.address();
      try {
        await fn(`http://127.0.0.1:${port}`);
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        server.close();
      }
    });
  });
}

const REPORT = { deckBefore: "a.pptx", deckAfter: "b.pptx", presentationDiffs: [], slides: [{ key: "a0:b0", label: "Slide 1", differences: [] }] };
const b64 = (s) => Buffer.from(s).toString("base64");

await withServer({}, async (base) => {
  const r = await fetch(`${base}/v1/health`);
  assert("GET /v1/health returns 200", r.status === 200);
  const body = await r.json();
  assert("health body reports ok status", body.status === "ok");
});

await withServer({ diffDecksFn: async () => REPORT }, async (base) => {
  const r = await fetch(`${base}/v1/diff`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ before: { name: "a.pptx", content: b64("x") }, after: { name: "b.pptx", content: b64("y") } }),
  });
  assert("POST /v1/diff with valid body returns 200", r.status === 200);
  const body = await r.json();
  assert("response body is the report object itself", body.deckBefore === "a.pptx" && body.deckAfter === "b.pptx");
});

await withServer({ diffDecksFn: async () => REPORT }, async (base) => {
  const r = await fetch(`${base}/v1/diff`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ before: { name: "a.pptx", content: b64("x") } }), // missing "after"
  });
  assert("POST /v1/diff missing a required field returns 400", r.status === 400);
  const body = await r.json();
  assert("400 response names the problem", /after/i.test(body.error || ""));
});

await withServer({}, async (base) => {
  const r = await fetch(`${base}/v1/diff`, { method: "POST", headers: { "content-type": "application/json" }, body: "not json" });
  assert("malformed JSON body returns 400, not a crash", r.status === 400);
});

{
  const ParseErrorClass = class extends Error {};
  await withServer({ diffDecksFn: async () => { throw new ParseErrorClass("could not parse"); }, PptxParseErrorClass: ParseErrorClass }, async (base) => {
    const r = await fetch(`${base}/v1/diff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ before: { name: "a.pptx", content: b64("x") }, after: { name: "b.pptx", content: b64("y") } }),
    });
    assert("a PptxParseError from the automation layer maps to 422", r.status === 422);
  });
}

{
  const BrowserErrorClass = class extends Error {};
  await withServer({ diffDecksFn: async () => { throw new BrowserErrorClass("no browser"); }, BrowserUnavailableErrorClass: BrowserErrorClass }, async (base) => {
    const r = await fetch(`${base}/v1/diff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ before: { name: "a.pptx", content: b64("x") }, after: { name: "b.pptx", content: b64("y") } }),
    });
    assert("a BrowserUnavailableError from the automation layer maps to 503", r.status === 503);
  });
}

await withServer({ computeChecksumFn: async () => ({ algorithm: "SHA-256", hash: "ab".repeat(32) }) }, async (base) => {
  const r = await fetch(`${base}/v1/checksum`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ file: { name: "a.pptx", content: b64("x") } }),
  });
  assert("POST /v1/checksum with a valid body returns 200", r.status === 200);
  const body = await r.json();
  assert("checksum response has the expected shape", body.algorithm === "SHA-256" && body.hash === "ab".repeat(32));
});

await withServer({}, async (base) => {
  const r = await fetch(`${base}/v1/nope`);
  assert("an unknown route returns 404", r.status === 404);
});

await withServer({ maxBodyBytes: 64 }, async (base) => {
  const bigContent = b64("x".repeat(1000));
  const r = await fetch(`${base}/v1/checksum`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ file: { name: "a.pptx", content: bigContent } }),
  });
  assert("a request body over maxBodyBytes returns 413", r.status === 413);
});

console.log(`server-unit check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All server-unit checks passed (GREEN).");
}
