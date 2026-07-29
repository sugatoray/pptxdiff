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

let server;

function ensureServer() {
  if (server) return Promise.resolve(server.address().port);
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const reqPath = decodeURIComponent(req.url.split("?")[0]);
      const filePath = path.join(ROOT, path.normalize(reqPath === "/" ? "/index.html" : reqPath));
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, () => resolve(server.address().port));
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

module.exports = { activate, deactivate, ensureServer };
