#!/usr/bin/env node
// Red/Green check for the Homebrew formula (Formula/pptxdiff.rb).
//
// This project's sandbox cannot run real `brew install`/`brew audit`/`brew
// test`: Homebrew refuses to run as root (confirmed here — no override flag
// exists in current Homebrew), and even under an unprivileged user its
// portable-ruby/bottle downloads go through ghcr.io, which this
// environment's outbound proxy blocks with a 403 (confirmed via
// `$HTTPS_PROXY/__agentproxy/status` per the environment's own
// instructions, not assumed). See HANDOFF.md/README.md for the full trail.
//
// Given that wall, this test proves what CAN be proven for real in this
// sandbox, instead of only checking that the formula's Ruby parses:
//   1. Parses Formula/pptxdiff.rb with plain regexes (pure, `parseFormula`)
//      and asserts the fields a Homebrew formula needs are present and
//      well-formed.
//   2. Runs the formula file through real `ruby -c` (valid syntax).
//   3. Downloads the REAL pinned npm tarball and verifies its sha256
//      against the formula's pinned value — the same check `brew` performs
//      before ever running `install`.
//   4. Cross-checks the pinned url/version against the npm registry's own
///     metadata for that version, independently of the formula file.
//   5. Replays the formula's `install` method's actual command
//      (`npm install --global --prefix=<libexec> --verbose --no-progress`,
//      matching Homebrew's `std_npm_install_args`) against the real
//      extracted tarball, then runs the REAL resulting `pptxdiff` binary
//      and curls it — the same functional proof `brew test` would give,
//      just orchestrated by this script instead of `brew` itself.
//
// Run: node src/packages/pptxdiff-brew/test_formula.mjs

import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FORMULA_PATH = path.join(DIR, "Formula", "pptxdiff.rb");

let failures = [];
let checks = 0;
function assert(label, cond) {
  checks++;
  if (!cond) failures.push(label);
}

// Pure: extracts the fields a Homebrew formula needs from its Ruby source
// via plain regexes — deliberately not a real Ruby parse (no new
// dependency), just enough structure to catch the mistakes that matter
// (wrong/missing url, sha256, depends_on, install/test wiring).
export function parseFormula(rubySource) {
  const url = rubySource.match(/^\s*url\s+"([^"]+)"/m)?.[1] ?? null;
  const sha256 = rubySource.match(/^\s*sha256\s+"([^"]+)"/m)?.[1] ?? null;
  const license = rubySource.match(/^\s*license\s+"([^"]+)"/m)?.[1] ?? null;
  const homepage = rubySource.match(/^\s*homepage\s+"([^"]+)"/m)?.[1] ?? null;
  const version = url?.match(/pptxdiff-(\d+\.\d+\.\d+)\.tgz$/)?.[1] ?? null;
  return {
    url,
    sha256,
    license,
    homepage,
    version,
    dependsOnNode: /depends_on\s+"node"/.test(rubySource),
    hasStdNpmInstall: /system\s+"npm",\s*"install",\s*\*std_npm_install_args\(libexec\)/.test(rubySource),
    hasBinInstallSymlink: /bin\.install_symlink\s+Dir\[/.test(rubySource),
    hasTestBlock: /\btest\s+do\b/.test(rubySource),
    hasLivecheckNpm: /livecheck\s+do[\s\S]*?strategy\s+:npm/.test(rubySource),
  };
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "user-agent": "pptxdiff-brew-test" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(fetch(res.headers.location));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`GET ${url} -> ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

function sha256hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  const rubySource = fs.readFileSync(FORMULA_PATH, "utf8");

  console.log("1. Formula structure (pure regex checks)");
  const f = parseFormula(rubySource);
  assert("has a url pinned to a real pptxdiff-<version>.tgz tarball", !!f.url && !!f.version);
  assert("has a sha256 pin", !!f.sha256 && /^[0-9a-f]{64}$/.test(f.sha256));
  assert("has a license", f.license === "Apache-2.0");
  assert("homepage points at the real repo", f.homepage === "https://github.com/sugatoray/pptxdiff");
  assert('depends_on "node" is declared', f.dependsOnNode);
  assert("install uses std_npm_install_args(libexec)", f.hasStdNpmInstall);
  assert("install symlinks libexec/bin/* into bin", f.hasBinInstallSymlink);
  assert("a test do block exists", f.hasTestBlock);
  assert("livecheck uses the npm strategy", f.hasLivecheckNpm);

  console.log("2. `ruby -c` — the formula is valid Ruby");
  let rubyOk = false;
  try {
    execFileSync("ruby", ["-c", FORMULA_PATH], { stdio: "pipe" });
    rubyOk = true;
  } catch (e) {
    rubyOk = false;
  }
  assert("ruby -c exits 0", rubyOk);

  console.log(`3. Downloading the real pinned tarball (${f.url}) and verifying sha256`);
  const tarball = await fetch(f.url);
  const actualSha256 = sha256hex(tarball);
  assert(
    `downloaded tarball's real sha256 matches the formula's pin (got ${actualSha256})`,
    actualSha256 === f.sha256
  );

  console.log("4. Cross-checking against the npm registry's own metadata for this version");
  const registryMeta = JSON.parse(
    (await fetch(`https://registry.npmjs.org/pptxdiff/${f.version}`)).toString("utf8")
  );
  assert("registry's dist.tarball matches the formula's pinned url", registryMeta.dist?.tarball === f.url);
  assert(
    "registry has zero runtime dependencies for this version (why no `resource` blocks are needed)",
    !registryMeta.dependencies || Object.keys(registryMeta.dependencies).length === 0
  );
  assert(
    "registry's bin field maps pptxdiff -> bin/cli.js, matching bin.install_symlink's expectation",
    registryMeta.bin?.pptxdiff === "bin/cli.js"
  );

  console.log("5. Replaying the formula's own install step against the real tarball, then running it");
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "pptxdiff-brew-test-"));
  const tarballPath = path.join(workDir, "pptxdiff.tgz");
  fs.writeFileSync(tarballPath, tarball);
  const srcDir = path.join(workDir, "src");
  fs.mkdirSync(srcDir);
  execFileSync("tar", ["xzf", tarballPath, "--strip-components=1", "-C", srcDir]);

  const libexec = path.join(workDir, "libexec");
  // Mirrors `system "npm", "install", *std_npm_install_args(libexec)` from
  // the formula's `install` method exactly: run inside the extracted
  // package (matching Homebrew's build-directory cwd during `install`),
  // globally installing it into a `--prefix`, which is what actually
  // produces `<prefix>/bin/pptxdiff`.
  execFileSync("npm", ["install", "--global", `--prefix=${libexec}`, "--verbose", "--no-progress"], {
    cwd: srcDir,
    stdio: "pipe",
  });
  const installedBin = path.join(libexec, "bin", "pptxdiff");
  assert("npm install produced libexec/bin/pptxdiff", fs.existsSync(installedBin));

  // Mirrors `bin.install_symlink Dir["#{libexec}/bin/*"]`.
  const fakeBin = path.join(workDir, "bin");
  fs.mkdirSync(fakeBin);
  const symlinkPath = path.join(fakeBin, "pptxdiff");
  fs.symlinkSync(installedBin, symlinkPath);
  assert("the symlinked bin/pptxdiff resolves to a real file", fs.existsSync(symlinkPath));

  console.log("6. Running the real installed binary and curling it (mirrors the formula's own `test do`)");
  const child = spawn(symlinkPath, [], { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let serverUrl = null;
  try {
    serverUrl = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no server URL in output within 15s: ${stdout}`)), 15000);
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
        const m = stdout.match(/http:\/\/localhost:\d+/);
        if (m) {
          clearTimeout(timer);
          resolve(m[0]);
        }
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
  } catch (e) {
    assert(`pptxdiff prints its server URL on start (${e.message})`, false);
  }

  if (serverUrl) {
    assert("pptxdiff prints its server URL on start", true);
    const body = await new Promise((resolve) => {
      http
        .get(serverUrl, (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        })
        .on("error", () => resolve(""));
    });
    assert("curling the real running server returns real HTML", /<html/i.test(body));
  }

  child.kill("SIGTERM");
  fs.rmSync(workDir, { recursive: true, force: true });

  console.log(`test_formula check: ${checks - failures.length}/${checks} passed`);
  if (failures.length) {
    console.error("FAILED:");
    for (const f of failures) console.error(" - " + f);
    process.exit(1);
  } else {
    console.log("All test_formula checks passed (GREEN).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
