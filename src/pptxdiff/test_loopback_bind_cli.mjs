#!/usr/bin/env node
// Red/Green regression check for the CLI's static server binding.
//
// bin/cli.js's `server.listen(0, ...)` must bind explicitly to the loopback
// interface (127.0.0.1) rather than leaving the host unspecified — an
// unspecified host can make Node bind to all interfaces on some
// Node/platform combinations, exposing the local file server to other
// hosts on the same network. Spawns the real CLI as a child process
// (rather than importing it, since it's a self-executing script with side
// effects) and asserts: (a) a plain TCP connection to 127.0.0.1 on the
// printed port succeeds, and (b) a plain TCP connection to any other
// non-loopback IPv4 address of this machine on the same port is refused.
//
// Run: node src/pptxdiff/test_loopback_bind_cli.mjs

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(DIR, "..", "..", "bin", "cli.js");

function runCli() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI], { env: process.env });
    let out = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("timed out waiting for CLI to print its URL"));
    }, 8000);

    child.stdout.on("data", (chunk) => {
      out += chunk.toString();
      const m = out.match(/pptxdiff running at http:\/\/localhost:(\d+)/);
      if (m) {
        clearTimeout(timeout);
        resolve({ child, port: Number(m[1]) });
      }
    });
    child.stderr.on("data", () => {});
    child.on("error", (e) => {
      clearTimeout(timeout);
      reject(e);
    });
  });
}

// Resolves true if a TCP connection to host:port is accepted, false if it
// is refused/reset/times out.
function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 2000 });
    socket.on("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
  });
}

function nonLoopbackAddresses() {
  const addrs = [];
  for (const ifaceList of Object.values(os.networkInterfaces())) {
    for (const iface of ifaceList || []) {
      if (iface.family === "IPv4" && !iface.internal) addrs.push(iface.address);
    }
  }
  return addrs;
}

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
}

const { child, port } = await runCli();

assert(
  `127.0.0.1:${port} should accept connections (loopback)`,
  await canConnect("127.0.0.1", port)
);

const externalAddrs = nonLoopbackAddresses();
if (externalAddrs.length === 0) {
  console.log("(no non-loopback IPv4 interface found on this machine — skipping external-bind check)");
} else {
  for (const addr of externalAddrs) {
    assert(
      `${addr}:${port} should refuse connections (server must be loopback-only, not bound to all interfaces)`,
      !(await canConnect(addr, port))
    );
  }
}

child.kill();

console.log(`loopback-bind CLI check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All loopback-bind CLI checks passed (GREEN).");
}
