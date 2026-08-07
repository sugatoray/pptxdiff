#!/usr/bin/env node
// Red/Green regression check for the CLI's browser-launch mechanism.
//
// bin/cli.js used to open the browser via
// `exec(\`${openCmd} "${url}"\`, ...)`, which runs the command through a
// shell. The url is internally generated today (not user input), so this
// isn't exploitable *now* — but shell-interpolating a string is exactly the
// shape that becomes a command-injection bug the moment a user-controlled
// fragment (a custom port flag, a CLI arg) is added later. This test
// asserts:
//   (a) the CLI no longer shell-interpolates a command string into exec(),
//   (b) it launches the browser via execFile() instead, and
//   (c) the pure command-builder function (buildBrowserOpenCommand) passes
//       the url through as a single, untouched argv element for every
//       platform branch — including a url containing shell metacharacters
//       — proving it's fed to execFile's argv array, never concatenated
//       into a shell command string.
//
// Run: node src/pptxdiff/test_execfile_browser_open_cli.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(DIR, "..", "..", "bin", "cli.js");

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
}

const source = readFileSync(CLI_PATH, "utf8");

assert(
  "bin/cli.js requires execFile from node:child_process",
  /require\(["']node:child_process["']\)/.test(source) && /\bexecFile\b/.test(source)
);

assert(
  "bin/cli.js's browser-launch call site does not shell-interpolate a template-string command into exec(...)",
  !/\bexec\(\s*`/.test(source)
);

assert(
  "bin/cli.js does not call the bare, shell-spawning exec() function anywhere",
  !/[^.\w]exec\(/.test(" " + source.replace(/execFile/g, ""))
);

let mod;
let importError = null;
try {
  mod = await import(path.join(DIR, "..", "..", "bin", "cli.js"));
} catch (e) {
  importError = e;
}

assert(
  "bin/cli.js can be imported without starting the server / opening a browser (guards its own execution)",
  importError === null
);

assert(
  "bin/cli.js exports buildBrowserOpenCommand for unit testing",
  !!mod && typeof mod.buildBrowserOpenCommand === "function"
);
assert(
  "bin/cli.js exports parseArgs for unit testing",
  !!mod && typeof mod.parseArgs === "function"
);

if (mod && typeof mod.parseArgs === "function") {
  const { parseArgs } = mod;

  assert("parseArgs defaults to the system browser", parseArgs([]).browser === "default");
  assert(
    "parseArgs supports --browser=chrome",
    parseArgs(["--browser=chrome"]).browser === "chrome"
  );
  assert(
    "parseArgs supports --browser msedge",
    parseArgs(["--browser", "msedge"]).browser === "msedge"
  );

  let invalidBrowser = null;
  try {
    parseArgs(["--browser=firefox"]);
  } catch (e) {
    invalidBrowser = e;
  }
  assert("parseArgs rejects unsupported browser values", invalidBrowser instanceof Error);

  let unknownOption = null;
  try {
    parseArgs(["--wat"]);
  } catch (e) {
    unknownOption = e;
  }
  assert("parseArgs rejects unknown options", unknownOption instanceof Error);
}

if (mod && typeof mod.buildBrowserOpenCommand === "function") {
  const { buildBrowserOpenCommand } = mod;
  const injected = 'http://localhost:12345/?x=1"; touch /tmp/pwned #';

  const mac = buildBrowserOpenCommand("darwin", injected);
  assert("darwin: command is 'open'", mac.command === "open");
  assert(
    "darwin: args is exactly [url], untouched",
    Array.isArray(mac.args) && mac.args.length === 1 && mac.args[0] === injected
  );

  const linux = buildBrowserOpenCommand("linux", injected);
  assert("linux: command is 'xdg-open'", linux.command === "xdg-open");
  assert(
    "linux: args is exactly [url], untouched",
    Array.isArray(linux.args) && linux.args.length === 1 && linux.args[0] === injected
  );

  const win = buildBrowserOpenCommand("win32", injected);
  assert(
    "win32: command is 'cmd.exe' (start is a shell built-in, not directly executable)",
    win.command === "cmd.exe"
  );
  assert(
    "win32: args preserve the '/c start \"\" <url>' empty-title quirk, url untouched",
    Array.isArray(win.args) &&
      win.args.length === 4 &&
      win.args[0] === "/c" &&
      win.args[1] === "start" &&
      win.args[2] === "" &&
      win.args[3] === injected
  );

  const macChrome = buildBrowserOpenCommand("darwin", injected, "chrome");
  assert("darwin chrome: command is 'open'", macChrome.command === "open");
  assert(
    "darwin chrome: opens Google Chrome with url untouched",
    JSON.stringify(macChrome.args) === JSON.stringify(["-a", "Google Chrome", injected])
  );

  const macEdge = buildBrowserOpenCommand("darwin", injected, "msedge");
  assert("darwin msedge: command is 'open'", macEdge.command === "open");
  assert(
    "darwin msedge: opens Microsoft Edge with url untouched",
    JSON.stringify(macEdge.args) === JSON.stringify(["-a", "Microsoft Edge", injected])
  );

  const winChrome = buildBrowserOpenCommand("win32", injected, "chrome");
  assert("win32 chrome: command is 'cmd.exe'", winChrome.command === "cmd.exe");
  assert(
    "win32 chrome: routes start to chrome with url untouched",
    JSON.stringify(winChrome.args) === JSON.stringify(["/c", "start", "", "chrome", injected])
  );

  const winEdge = buildBrowserOpenCommand("win32", injected, "msedge");
  assert("win32 msedge: command is 'cmd.exe'", winEdge.command === "cmd.exe");
  assert(
    "win32 msedge: routes start to msedge with url untouched",
    JSON.stringify(winEdge.args) === JSON.stringify(["/c", "start", "", "msedge", injected])
  );

  const linuxChrome = buildBrowserOpenCommand("linux", injected, "chrome");
  assert("linux chrome: command is 'google-chrome'", linuxChrome.command === "google-chrome");
  assert(
    "linux chrome: args is exactly [url], untouched",
    Array.isArray(linuxChrome.args) && linuxChrome.args.length === 1 && linuxChrome.args[0] === injected
  );

  const linuxEdge = buildBrowserOpenCommand("linux", injected, "msedge");
  assert("linux msedge: command is 'microsoft-edge'", linuxEdge.command === "microsoft-edge");
  assert(
    "linux msedge: args is exactly [url], untouched",
    Array.isArray(linuxEdge.args) && linuxEdge.args.length === 1 && linuxEdge.args[0] === injected
  );
}

console.log(`execFile browser-open CLI check: ${checks - failures.length}/${checks} passed`);
if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
} else {
  console.log("All execFile browser-open CLI checks passed (GREEN).");
}
