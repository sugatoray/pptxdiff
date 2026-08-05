#!/usr/bin/env node
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");

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

// Applied to every response: nosniff blocks MIME-sniffing-based attacks on
// served content, and no-store keeps a local dev server from letting a
// browser cache a copy of a file that may have been edited on disk since
// the last request.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

function parseArgs(argv) {
  const options = { browser: "default" };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--browser") {
      options.browser = argv[++i];
    } else if (arg.startsWith("--browser=")) {
      options.browser = arg.slice("--browser=".length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!["default", "chrome", "msedge"].includes(options.browser)) {
    throw new Error(
      `Unsupported --browser value: ${options.browser || "(empty)"}. Use default, chrome, or msedge.`
    );
  }

  return options;
}

// Pure: decides how to launch a browser for `url` on `platform`, with the
// url passed as its own argv element rather than shell-interpolated into a
// command string. `start` is a cmd.exe built-in, not a standalone
// executable, so Windows routes through cmd.exe; the leading `""` preserves
// `start`'s own quirk of treating the first quoted argument as a window
// title.
function buildBrowserOpenCommand(platform, url, browser = "default") {
  if (browser === "chrome") {
    if (platform === "darwin") return { command: "open", args: ["-a", "Google Chrome", url] };
    if (platform === "win32") return { command: "cmd.exe", args: ["/c", "start", "", "chrome", url] };
    return { command: "google-chrome", args: [url] };
  }

  if (browser === "msedge") {
    if (platform === "darwin") return { command: "open", args: ["-a", "Microsoft Edge", url] };
    if (platform === "win32") return { command: "cmd.exe", args: ["/c", "start", "", "msedge", url] };
    return { command: "microsoft-edge", args: [url] };
  }

  if (platform === "darwin") return { command: "open", args: [url] };
  if (platform === "win32") return { command: "cmd.exe", args: ["/c", "start", "", url] };
  return { command: "xdg-open", args: [url] };
}

// Pure: true if `candidate` resolves to `root` itself, or somewhere
// strictly inside it. path.relative()-based rather than a raw string-prefix
// check (`candidate.startsWith(root)`), which has two known weaknesses: (a)
// it's fooled by a sibling directory that merely shares root's prefix
// (e.g. root=/app/pptxdiff vs. candidate=/app/pptxdiff-evil/secret — a
// prefix check wrongly calls this contained), and (b) it says nothing about
// symlinks. path.relative()/path.resolve() fix (a); neither fixes (b) —
// path.resolve() does not canonicalize symlinks, so a symlink inside root
// that points outside it can still escape. That residual gap is
// documented, not something this function (or a test) can close.
function isPathContained(root, candidate) {
  const relative = path.relative(root, path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

// Starts the static file server on an OS-assigned loopback port. Extracted
// from the require.main block below so other packages in this repo
// (currently `pptxdiff-cli`, via a `pptxdiff` dependency) can reuse this
// exact server — same path containment, same security headers, same
// binding — instead of growing a second, drift-prone copy. See WISDOM.md's
// existing trap about `pptxdiff-vscode/extension.js` carrying its own
// independent (and once out-of-sync) copy of this same server; new
// consumers should import this function rather than repeat that mistake.
// Resolves to { server, port, url } once listening; the caller decides
// what to do with the URL (print it, open a browser, hand it to Playwright).
function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
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

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port, url: `http://localhost:${port}` });
    });
  });
}

if (require.main === module) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e && e.message ? e.message : e);
    process.exit(2);
  }

  startServer().then(({ url: baseUrl }) => {
    const url = `${baseUrl}${LITE_MODE ? "/?lite=1" : ""}`;
    console.log(`pptxdiff running at ${url}`);
    if (LITE_MODE) {
      console.log("PPTXDIFF_LITE_MODE is set — loading React/ReactDOM/Babel/JSZip/pptx-renderer/fonts from their original CDNs instead of the vendored local copies.");
    }

    const { command, args } = buildBrowserOpenCommand(process.platform, url, options.browser);
    execFile(command, args, () => {}); // ignore failure (e.g. headless/no GUI) — URL is printed above regardless
  }).catch((e) => {
    console.error(e && e.message ? e.message : e);
    process.exitCode = 1;
  });
}

module.exports = { buildBrowserOpenCommand, isPathContained, parseArgs, startServer };
