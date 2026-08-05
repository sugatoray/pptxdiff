"use strict";

// Entry point bundled (via esbuild) into a single CommonJS file and then
// embedded into a copy of the Node executable via Node's Single Executable
// Applications feature (`--experimental-sea-config` + `postject`) — see
// build.mjs. Requiring "../../../bin/cli.js" is resolved by esbuild at
// BUILD time (it inlines the file's contents into the bundle); nothing in
// the packaged binary does a runtime `require()` of a path outside itself.
const path = require("node:path");
const { execFile } = require("node:child_process");
const { startServer, buildBrowserOpenCommand } = require("../../../bin/cli.js");

// A packaged single-executable binary has no meaningful sibling files of
// its own (bin/cli.js's module-level `ROOT`, computed from its *build-time*
// `__dirname`, is unused here on purpose — see startServer()'s `root`
// param). build.mjs copies this project's static app files into an
// "assets" folder placed next to the built executable; resolving from
// `process.execPath` (where THIS binary actually lives on disk right now)
// is the only location that's true regardless of where a user unzips it.
const ROOT = path.join(path.dirname(process.execPath), "assets");

const LITE_MODE = ["1", "y", "yes", "true"].includes(
  String(process.env.PPTXDIFF_LITE_MODE || "").trim().toLowerCase()
);

startServer(ROOT)
  .then(({ url: baseUrl }) => {
    const url = `${baseUrl}${LITE_MODE ? "/?lite=1" : ""}`;
    console.log(`pptxdiff running at ${url}`);
    if (LITE_MODE) {
      console.log("PPTXDIFF_LITE_MODE is set — loading React/ReactDOM/Babel/JSZip/pptx-renderer/fonts from their original CDNs instead of the vendored local copies.");
    }
    const { command, args } = buildBrowserOpenCommand(process.platform, url);
    execFile(command, args, () => {}); // ignore failure (e.g. headless/no GUI) — URL is printed above regardless
  })
  .catch((e) => {
    console.error(e && e.message ? e.message : e);
    process.exitCode = 1;
  });
