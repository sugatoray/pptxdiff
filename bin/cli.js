#!/usr/bin/env node
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { exec } = require("node:child_process");

const ROOT = path.join(__dirname, "..", "src", "pptxdiff");
const LITE_MODE = ["1", "y", "yes", "true"].includes(
  String(process.env.PPTXDIFF_LITE_MODE || "").trim().toLowerCase()
);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
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

server.listen(0, () => {
  const { port } = server.address();
  const url = `http://localhost:${port}${LITE_MODE ? "/?lite=1" : ""}`;
  console.log(`pptxdiff running at ${url}`);
  if (LITE_MODE) {
    console.log("PPTXDIFF_LITE_MODE is set — loading React/ReactDOM/Babel/JSZip/pptx-renderer/fonts from their original CDNs instead of the vendored local copies.");
  }

  const openCmd =
    process.platform === "darwin" ? "open" :
    process.platform === "win32" ? 'start ""' :
    "xdg-open";
  exec(`${openCmd} "${url}"`, () => {}); // ignore failure (e.g. headless/no GUI) — URL is printed above regardless
});
