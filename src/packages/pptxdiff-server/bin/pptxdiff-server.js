#!/usr/bin/env node
"use strict";

const { startServer } = require("../lib/server.js");

// Pure: no I/O, argv in, parsed options out — mirrors pptxdiff-cli's own
// parseArgs() convention so both binaries feel the same to use.
function parseArgs(argv) {
  const opts = { port: 0, host: "127.0.0.1" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 0) return { error: `--port must be a non-negative number (got "${argv[i]}")` };
      opts.port = n;
      continue;
    }
    if (a === "--host") {
      opts.host = argv[++i];
      continue;
    }
    if (a === "--help" || a === "-h") {
      opts.help = true;
      continue;
    }
    return { error: `Unknown flag: ${a}` };
  }
  return opts;
}

const USAGE = [
  "pptxdiff-server [options]",
  "",
  "Starts the pptxdiff Web API. Binds to 127.0.0.1 by default — pass",
  "--host to bind elsewhere (only do this behind your own auth/proxy;",
  "this server has none of its own yet).",
  "",
  "Options:",
  "  --port <n>   Port to listen on (default: an OS-assigned free port).",
  "  --host <h>   Host to bind to (default: 127.0.0.1).",
  "  --help, -h   Show this help.",
].join("\n");

if (require.main === module) {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.error) {
    console.error(`${opts.error}\n\n${USAGE}`);
    process.exitCode = 2;
  } else if (opts.help) {
    console.log(USAGE);
  } else {
    startServer(opts)
      .then(({ url }) => {
        console.log(`pptxdiff-server listening at ${url}`);
        if (opts.host !== "127.0.0.1" && opts.host !== "localhost") {
          console.log("WARNING: bound to a non-loopback host with no built-in authentication — only do this behind your own auth/proxy.");
        }
      })
      .catch((e) => {
        console.error((e && e.message) || String(e));
        process.exitCode = 1;
      });
  }
}

module.exports = { parseArgs, USAGE };
