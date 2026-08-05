// Shared pure/low-level helpers for this package's own tooling
// (test_formula.mjs, sync-tap.mjs) — kept in one place so both stay in sync
// with the same formula-parsing/network logic instead of each growing a
// slightly different copy.

import { createHash } from "node:crypto";
import https from "node:https";

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

// Pure: returns `rubySource` with only its `url` and `sha256` lines
// replaced by `newUrl`/`newSha256` — every other line (comments, license,
// install/test blocks) is untouched. Idempotent: calling it again with the
// same values that are already present returns the input unchanged
// (byte-for-byte), which is what lets the sync CLI treat "no diff" as
// "already up to date" instead of always rewriting the file.
export function updateFormulaPin(rubySource, { url: newUrl, sha256: newSha256 }) {
  return rubySource
    .replace(/^(\s*url\s+)"[^"]+"/m, `$1"${newUrl}"`)
    .replace(/^(\s*sha256\s+)"[^"]+"/m, `$1"${newSha256}"`);
}

export function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "user-agent": "pptxdiff-brew-tooling" } }, (res) => {
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

export function sha256hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

// Fetches npm registry metadata for `version` ("latest" resolves via
// dist-tags first), returning {version, tarball, sha256Note}. Network I/O,
// not pure — kept here so both test_formula.mjs and sync-tap.mjs resolve
// "what does npm say about this version" identically.
export async function resolveNpmVersion(packageName, version) {
  if (version === "latest") {
    const root = JSON.parse((await fetch(`https://registry.npmjs.org/${packageName}`)).toString("utf8"));
    version = root["dist-tags"]?.latest;
    if (!version) throw new Error(`registry.npmjs.org/${packageName} has no dist-tags.latest`);
  }
  const meta = JSON.parse((await fetch(`https://registry.npmjs.org/${packageName}/${version}`)).toString("utf8"));
  if (!meta?.dist?.tarball) throw new Error(`registry.npmjs.org/${packageName}/${version} has no dist.tarball`);
  return { version, meta };
}
