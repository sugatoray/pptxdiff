#!/usr/bin/env node
// Red/Green regression check for bin/cli.js's exported startServer().
//
// bin/cli.js was refactored to export a reusable startServer() (see WISDOM.md
// entry on this session) so other packages (pptxdiff-cli, @pptxdiff/server)
// can reuse the exact same hardened static server instead of growing a
// second copy — the mistake already made once with pptxdiff-vscode's
// extension.js. This test asserts the export exists, resolves a real
// listening server on loopback with a usable URL, actually serves
// index.html through it, and that the require.main-guarded CLI entry
// point's own behavior (stdout format, binding) is unaffected — the
// existing test_loopback_bind_cli.mjs / test_security_headers_cli.mjs /
// test_path_containment_cli.mjs already re-verify that end-to-end; this
// file covers the NEW programmatic entry point specifically.
//
// Run: node src/pptxdiff/test_start_server_export_cli.mjs

import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(DIR, "..", "..", "bin", "cli.js");

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
}

const mod = await import(`file://${CLI}`);

assert("module exports startServer", typeof mod.startServer === "function");

const { server, port, url } = await mod.startServer();
assert("resolves a numeric port", Number.isInteger(port) && port > 0);
assert("resolves a loopback URL for that port", url === `http://localhost:${port}`);

const body = await new Promise((resolve, reject) => {
  http.get(`${url}/index.html`, (res) => {
    let data = "";
    res.on("data", (c) => (data += c));
    res.on("end", () => resolve({ status: res.statusCode, data }));
  }).on("error", reject);
});
assert("serves index.html with 200 through the started server", body.status === 200);
assert("served content looks like the real app", body.data.includes("Component extends DCLogic"));

// A second independent call must not collide (each gets its own OS-assigned port).
const second = await mod.startServer();
assert("a second startServer() call gets an independent port", second.port !== port);

server.close();
second.server.close();

console.log(`startServer-export CLI check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All startServer-export CLI checks passed (GREEN).");
}
