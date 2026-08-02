"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const GITATTRIBUTES_LINE = "*.pptx diff=pptxdiff";

// Pure: decides the new .gitattributes content given its current content
// (or null if the file doesn't exist yet) and the line pptxdiff needs
// present. Idempotent by design — installGitIntegration() is meant to be
// safe to run more than once (e.g. a fresh clone, or a teammate who
// already has it configured), so this never appends a duplicate.
function computeGitAttributesUpdate(existing, line) {
  if (existing == null) {
    return { content: line + "\n", changed: true };
  }
  const alreadyPresent = existing.split("\n").some((l) => l.trim() === line);
  if (alreadyPresent) {
    return { content: existing, changed: false };
  }
  const sep = existing === "" || existing.endsWith("\n") ? "" : "\n";
  return { content: existing + sep + line + "\n", changed: true };
}

// Pure: the exact `git config` argv lists to run for a given scope — never
// executed here, just decided, so the decision is independently testable
// without a real git repo. `difftool.pptxdiff.cmd`'s value is a literal
// shell-command STRING containing `$LOCAL`/`$REMOTE` — those are expanded
// by git's own shell invocation when difftool later runs the command, not
// by us now (we call `git config` via execFile, never a shell, so no
// escaping of our own is needed — the literal string is exactly what git
// should store).
function buildGitConfigCommands(scope) {
  // `--global` is a flag to the `config` subcommand (`git config --global
  // key value`), not a top-level `git` flag (`git --global config ...` is
  // a genuinely invalid invocation, rejected by git itself with "unknown
  // option: --global" — found via a real RED test failure running this
  // against an actual git repo, not assumed from reading git's docs cold).
  const globalFlag = scope === "global" ? ["--global"] : [];
  return [
    ["config", ...globalFlag, "diff.pptxdiff.textconv", "pptxdiff-cli textconv"],
    ["config", ...globalFlag, "difftool.pptxdiff.cmd", 'pptxdiff-cli difftool "$LOCAL" "$REMOTE"'],
  ];
}

// Impure: wires pptxdiff into git for `*.pptx` files — writes/updates
// `.gitattributes` at the repo root (always repo-local; there's no global
// equivalent asked for) and sets the `diff.pptxdiff.textconv`/
// `difftool.pptxdiff.cmd` git config (local by default, `--global` only
// with that explicit flag — per CLI_API_DESIGN.md §7's "never write
// ~/.gitconfig without an explicit flag" requirement, the flag itself IS
// the consent; this is a non-interactive, scriptable tool, so it doesn't
// add a TTY confirmation prompt on top of that).
function installGitIntegration({ global = false, cwd = process.cwd() } = {}, io = {}) {
  const {
    execFileSyncFn = execFileSync,
    existsSync = fs.existsSync,
    readFileSync = fs.readFileSync,
    writeFileSync = fs.writeFileSync,
    out = process.stdout,
    errOut = process.stderr,
  } = io;

  let repoRoot;
  try {
    repoRoot = execFileSyncFn("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }).trim();
  } catch (e) {
    errOut.write("Not inside a git repository (`git rev-parse --show-toplevel` failed). Run this from inside a git repo.\n");
    return 2;
  }

  const attrPath = path.join(repoRoot, ".gitattributes");
  const existing = existsSync(attrPath) ? readFileSync(attrPath, "utf8") : null;
  const update = computeGitAttributesUpdate(existing, GITATTRIBUTES_LINE);
  if (update.changed) {
    writeFileSync(attrPath, update.content);
    out.write(`Updated ${attrPath}\n`);
  } else {
    out.write(`${attrPath} already configured.\n`);
  }

  try {
    for (const args of buildGitConfigCommands(global ? "global" : "local")) {
      execFileSyncFn("git", args, { cwd: repoRoot });
    }
  } catch (e) {
    errOut.write(`Failed to set git config: ${(e && e.message) || String(e)}\n`);
    return 2;
  }

  out.write(`Configured ${global ? "--global" : "local"} git diff/difftool driver "pptxdiff" for *.pptx.\n`);
  if (global) {
    out.write("NOTE: --global changes apply to EVERY repository on this machine, not just this one.\n");
  }

  return 0;
}

module.exports = { GITATTRIBUTES_LINE, computeGitAttributesUpdate, buildGitConfigCommands, installGitIntegration };
