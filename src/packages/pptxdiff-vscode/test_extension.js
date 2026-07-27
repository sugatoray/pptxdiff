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

        // index.html loads these from ./vendor/ by default (offline-first) —
        // if build.js stops vendoring them, the packaged extension boots blank.
        http.get(`http://localhost:${port}/vendor/react.production.min.js`, (res4) => {
          assert.strictEqual(res4.statusCode, 200, "vendor/react.production.min.js should be vendored and served");

          http.get(`http://localhost:${port}/vendor/fonts/spectral.css`, (res5) => {
            assert.strictEqual(res5.statusCode, 200, "vendor/fonts/spectral.css should be vendored and served");
            assert.match(res5.headers["content-type"], /text\/css/, "spectral.css must serve as text/css or the browser won't apply it");
            deactivate();
            require("node:fs").unlinkSync(path.join(__dirname, "__fake-vscode.js"));
            console.log("test_extension.js: all checks passed");
          });
        });
      });
    });
  });
});
