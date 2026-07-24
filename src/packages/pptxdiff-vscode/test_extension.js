"use strict";

// ponytail: extension.js requires "vscode", which only exists inside the
// extension host — stub it so the one real bit of logic (the static file
// server's path-traversal guard) can be smoke-tested with plain node.
const assert = require("node:assert");
const path = require("node:path");
const Module = require("node:module");

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "vscode") return path.join(__dirname, "__fake-vscode.js");
  return originalResolve.call(this, request, ...rest);
};
require("node:fs").writeFileSync(
  path.join(__dirname, "__fake-vscode.js"),
  "module.exports = { commands: { registerCommand: () => ({ dispose(){} }) }, env: { openExternal(){} }, Uri: { parse: (s) => s } };"
);

const http = require("node:http");
const { ensureServer, deactivate } = require("./extension.js");

ensureServer().then((port) => {
  http.get(`http://localhost:${port}/index.html`, (res) => {
    assert.strictEqual(res.statusCode, 200, "index.html should serve 200");

    http.get(`http://localhost:${port}/../../../../etc/passwd`, (res2) => {
      // path.normalize clamps leading ".." on an absolute path to "/", so this
      // resolves to ROOT/etc/passwd (contained, just missing) — not a 200.
      assert.strictEqual(res2.statusCode, 404, "path traversal must stay contained under ROOT");

      http.get(`http://localhost:${port}/does-not-exist.js`, (res3) => {
        assert.strictEqual(res3.statusCode, 404, "missing file should 404");
        deactivate();
        require("node:fs").unlinkSync(path.join(__dirname, "__fake-vscode.js"));
        console.log("test_extension.js: all checks passed");
      });
    });
  });
});
