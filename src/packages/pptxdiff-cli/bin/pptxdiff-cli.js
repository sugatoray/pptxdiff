#!/usr/bin/env node
"use strict";

const { main } = require("../lib/cli-core.js");

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((e) => {
      process.stderr.write(`${(e && e.message) || String(e)}\n`);
      process.exitCode = 2;
    });
}

module.exports = { main };
