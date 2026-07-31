"use strict";

const vscode = require("vscode");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

// Serves the static pptxdiff app vendored into ./media by build.js (self-
// contained for a packaged .vsix) — same static server bin/cli.js uses.
const ROOT = path.join(__dirname, "media");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
};

// Applied to every response: nosniff blocks MIME-sniffing-based attacks on
// served content, and no-store keeps the local server from letting a
// browser cache a copy of a file that may have been edited on disk since
// the last request. Mirrors bin/cli.js's hardening.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

// Pure: true if `candidate` resolves to `root` itself, or somewhere
// strictly inside it. path.relative()-based rather than a raw string-prefix
// check (`candidate.startsWith(root)`), which is fooled by a sibling
// directory that merely shares root's prefix. Mirrors bin/cli.js's
// isPathContained.
function isPathContained(root, candidate) {
  const relative = path.relative(root, path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

let server;

function ensureServer() {
  if (server) return Promise.resolve(server.address().port);
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const reqPath = decodeURIComponent(req.url.split("?")[0]);
      const filePath = path.join(ROOT, path.normalize(reqPath === "/" ? "/index.html" : reqPath));
      if (!isPathContained(ROOT, filePath)) {
        res.writeHead(403, SECURITY_HEADERS);
        res.end("Forbidden");
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, SECURITY_HEADERS);
          res.end("Not found");
          return;
        }
        res.writeHead(200, {
          ...SECURITY_HEADERS,
          "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
        });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("pptxdiff.open", async () => {
      const port = await ensureServer();
      vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}`));
    })
  );
  context.subscriptions.push({ dispose: () => server && server.close() });
}

function deactivate() {
  if (server) server.close();
}

module.exports = { activate, deactivate, ensureServer, isPathContained };
