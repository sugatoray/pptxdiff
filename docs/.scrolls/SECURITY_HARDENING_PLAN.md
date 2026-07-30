# SECURITY_HARDENING_PLAN.md — Hardening Backlog from SECURITY_ANALYSIS.md

Ticketed, prioritized plan derived from `docs/.scrolls/SECURITY_ANALYSIS.md`'s 2026-07-27
review of the `pptxdiff` npm package. Same status convention as `PLAN.md`: `[ ]` open,
`[x]` done. Read `SECURITY_ANALYSIS.md` first for the full reasoning behind each item —
this file only carries the actionable backlog, not the analysis itself.

Scope note: the review's bottom line was "reasonable to use after manual review, no
malware/exfiltration/supply-chain compromise found" — everything below is *hardening*
(reducing blast radius, making scanners' job easier, closing theoretical gaps), not
incident response. Nothing here is urgent in the sense of an active vulnerability.

## P0 — CLI server hardening (`bin/cli.js`)

1. **[x] Bind the static server explicitly to loopback.**
   `server.listen(0, ...)` (`bin/cli.js:42`) omits the host, which on some Node/platform
   combinations can bind more broadly than `127.0.0.1`. Change to
   `server.listen(0, "127.0.0.1", () => { ... })`. This is a one-line change; verify with
   `netstat`/`lsof` (or `server.address()`) that the bound address is `127.0.0.1`, not
   `0.0.0.0` or `::`, on at least Linux and macOS.
   **Done** (2026-07-29): fixed in `bin/cli.js:42`. Red/Green regression test added:
   `src/pptxdiff/test_loopback_bind_cli.mjs` — spawns the real CLI and asserts a TCP
   connection to `127.0.0.1:<port>` succeeds while a connection to any other
   non-loopback IPv4 address on this machine is refused. Confirmed RED (1/2, external
   connection unexpectedly succeeded) against the pre-fix code, GREEN (2/2) after.
   Verified independently via `lsof -p <pid> -a -iTCP`, showing `TCP 127.0.0.1:<port>
   (LISTEN)` (Linux, this sandbox) — not `0.0.0.0`/`*`. Not verified on macOS/Windows in
   this sandbox.

2. **[x] Replace `exec()` browser launch with `execFile()`.**
   `exec(\`${openCmd} "${url}"\`, ...)` (`bin/cli.js:54`) runs through a shell. The `url`
   is internally generated (`http://localhost:${port}...`) and not user input today, so
   this isn't exploitable *now*, but `exec` + string interpolation is exactly the shape
   that becomes a command-injection bug the moment someone adds a user-controlled
   fragment later (a custom port flag, a CLI arg, etc.). Switch to
   `execFile(openCmd, [url], ...)` (or `execFile("open"/"start"/"xdg-open", [url])` per
   platform) so arguments are passed as an argv array, never shell-interpolated. Note:
   `"start"` on Windows needs its `""` empty-title-argument quirk preserved — confirm the
   `execFile` form still opens the browser correctly on Windows (or document that this
   wasn't verified on Windows in this sandbox, per this project's honesty convention).
   **Done** (2026-07-30): `bin/cli.js` now imports `execFile` (not `exec`) and adds a
   pure `buildBrowserOpenCommand(platform, url)` helper: `darwin` → `open [url]`,
   `win32` → `cmd.exe /c start "" [url]` (routes through `cmd.exe` since `start` is a
   shell built-in, not a standalone executable — `""` empty-title quirk preserved as its
   own argv element), everything else → `xdg-open [url]`. `url` is always passed as its
   own argv array element, never interpolated into a command string, so no shell is
   invoked at all. The whole server-start/browser-open block is now guarded behind
   `if (require.main === module)` so `buildBrowserOpenCommand` can be imported and unit
   tested without the side effect of starting a real server. Red/Green regression test:
   `src/pptxdiff/test_execfile_browser_open_cli.mjs` — RED (1/5) against the pre-fix
   code (no `execFile`, no exported builder, still shell-interpolated `exec(`); GREEN
   (11/11) after, including a shell-metacharacter-laden URL
   (`"; touch /tmp/pwned #`) asserted to survive as a single, untouched argv element on
   every platform branch. No regressions: `test_loopback_bind_cli.mjs` (2/2),
   `test_lite_mode_cli.mjs` (10/10), `test_offline_capable.mjs` (22/22) all still pass;
   manually re-verified the CLI still serves `/` and `/support.js` with `200` after the
   refactor. Only verified on Linux (this sandbox) — the Windows `cmd.exe /c start`
   branch is exercised by the unit test's pure-function assertions only, not against a
   real Windows browser launch, per this project's honesty convention.

3. **[x] Replace `startsWith(ROOT)` path containment with `path.relative()`-based
   containment.**
   `filePath.startsWith(ROOT)` (`bin/cli.js:25`) has two known weaknesses: (a) it's a
   raw string prefix check, so a sibling directory sharing `ROOT`'s prefix (e.g. `ROOT`
   = `/app/src/pptxdiff` and an attacker-reachable `/app/src/pptxdiff-evil`) would pass
   containment despite not being inside `ROOT`; (b) `path.normalize()` alone does not
   canonicalize symlinks. Replace with:
   ```js
   const resolved = path.resolve(filePath);
   const relative = path.relative(ROOT, resolved);
   const contained = relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
   ```
   Add regression tests (this project has no test runner for `bin/cli.js` yet — a small
   Node script in the style of `test_lite_mode_cli.mjs`, spawning the real CLI and making
   HTTP requests, is the established pattern) covering: ordinary `../` traversal
   (existing behavior, must still block), URL-encoded traversal (`%2e%2e%2f`), a
   sibling-prefix path, and (documented-only, not necessarily testable cross-platform) a
   symlink escaping `ROOT`.
   **Done** (2026-07-30): `bin/cli.js` now has a pure, exported `isPathContained(root,
   candidate)` helper implementing exactly the `path.relative()`-based check above,
   replacing the `filePath.startsWith(ROOT)` call site. Red/Green regression test:
   `src/pptxdiff/test_path_containment_cli.mjs` — RED (8/9, missing export) against the
   pre-fix code; GREEN (17/17) after. Covers: `isPathContained` unit assertions (root
   itself, ordinary subpath, nested subpath, internal `..` normalizing back into root —
   all contained; a sibling directory sharing `ROOT`'s prefix with and without a
   separator, the parent directory, an unrelated absolute path — all correctly rejected,
   which is the exact case a raw `startsWith()` check gets wrong) plus spawned-real-CLI
   HTTP checks (`/`, `/support.js`, `/sample-pptx.js` still 200; ordinary `../`
   traversal, URL-encoded `%2e%2e%2f` traversal, and a sibling-prefix escape attempt
   never return 200).
   **Investigation note worth keeping**: traced through `path.normalize()` +
   `path.join()`'s actual behavior before writing the HTTP-level assertions and found
   the pre-fix code already returned `404` (never `403`, never `200`) for every `../`
   traversal payload tried here — `path.normalize()` clamps `..` at the leading `/` of
   an already-absolute request path, and `path.join(ROOT, alreadyNormalizedAbsoluteish
   String)` does not treat a leading `/` as an absolute-path reset (unlike
   `path.resolve()`), so this specific call site's construction already prevented
   `../`-style escape by construction, independent of which containment check gated it.
   The HTTP-level traversal tests therefore assert "never leaks a 200," not "returns
   403" — the real, meaningful startsWith()-vs-path.relative() divergence this ticket
   closes is the sibling-prefix case, which is only reachable/testable by calling
   `isPathContained()` directly with a crafted sibling path (the HTTP layer can't
   produce one through `path.join(ROOT, ...)`'s construction). Symlink escape remains
   documented-only, not tested, per the ticket's own carve-out — `path.resolve()` does
   not canonicalize symlinks.
   No regressions: `test_execfile_browser_open_cli.mjs` (11/11), `test_loopback_bind_cli.mjs`
   (2/2), `test_lite_mode_cli.mjs` (10/10), `test_offline_capable.mjs` (22/22) all still
   pass.

## P1 — Response hygiene and provenance

4. **[x] Add `X-Content-Type-Options: nosniff` and a conservative `Cache-Control` header**
   to every response in `bin/cli.js`'s `server.writeHead(...)` call (`bin/cli.js:37`).
   Low-risk, mechanical change — bundle it with ticket 3 above since both touch the same
   `fs.readFile` callback.
   **Done** (2026-07-30): added a `SECURITY_HEADERS` constant
   (`X-Content-Type-Options: nosniff`, `Cache-Control: no-store`) applied to all three
   `writeHead` call sites (200 file serve, 403 blocked-path, 404 not-found). Red/Green
   regression test: `src/pptxdiff/test_security_headers_cli.mjs` — RED (3/11) against
   the pre-fix code, GREEN (11/11) after, spawning the real CLI and checking headers on
   a 200, a 403 (blocked traversal), and a 404 response. No regressions across the other
   4 `bin/cli.js` test files.

5. **[x] Add a `SECURITY.md`** (repo root, the conventional location GitHub surfaces in
   the "Security" tab) covering: the local-first/no-cloud-upload model, no npm lifecycle
   scripts, zero production dependencies, the optional `PPTXDIFF_LITE_MODE` CDN escape
   hatch and why it's opt-in, the `exec`/shell-opener behavior (post-hardening, note it's
   `execFile` now), live-push credential handling (opt-in localStorage, separate key,
   no default persistence), and a short explanation of why a Socket "AI detected
   potential security risk" scan may false-positive on this package (link back to
   `SECURITY_ANALYSIS.md`'s reasoning, don't restate it in full). Include a
   vulnerability-reporting contact/process (even if just "open a GitHub issue" or an
   email).
   **Done** (2026-07-30): added `SECURITY.md` at the repo root covering every point
   above, plus the P0 hardening already shipped (loopback binding, `execFile`,
   `path.relative()` containment, response headers) and a pointer to the new vendor
   provenance docs (ticket 6, below). Documentation-only — no TDD applicable.

6. **[x] Document and automate vendored-dependency provenance.**
   `src/pptxdiff/vendor/` (React, ReactDOM, Babel standalone, JSZip,
   `@aiden0z/pptx-renderer`, Spectral font) currently has its provenance scattered across
   `HANDOFF.md`/`WISDOM.md` history rather than a single checked-in, machine-checkable
   record. Add a `vendor/PROVENANCE.md` (or a `vendor/manifest.json`) listing, per
   vendored file: upstream package name + exact version, source URL it was fetched from,
   a SHA-384/SHA-256 integrity hash, and license. Add a small verification script
   (`scripts/verify_vendor.mjs` or similar) that re-fetches or re-derives each hash and
   diffs it against the manifest — this turns "the SRI hashes already in `support.js`
   happen to prove React/ReactDOM are byte-identical" (currently a one-off manual check,
   per `WISDOM.md`'s vendoring addendum) into a repeatable, CI-runnable check covering
   *all* vendored files, not just the two that already had SRI hashes for an unrelated
   reason.
   **Done** (2026-07-30): added both, per the ticket's "either" option — `manifest.json`
   (machine-checkable source of truth: file, upstream package, version, source URL,
   sha256, license, per vendored file) and `PROVENANCE.md` (human-readable, same data
   plus rebuild recipes/context, in `src/pptxdiff/vendor/`). New
   `scripts/verify_vendor.mjs`: re-derives each file's sha256 and checks it against
   `manifest.json`; asserts `manifest.json`'s hash strings also appear in
   `PROVENANCE.md` (catches doc/manifest drift); and automates the exact manual
   React/ReactDOM sha384-vs-`support.js`-SRI cross-check `WISDOM.md`'s vendoring
   addendum previously did by hand. Genuine Red/Green demonstrated twice: (1) corrupted
   one hash in `manifest.json` — caught (both the hash-mismatch and the doc-drift
   checks fired), restored, clean again; (2) flipped one byte in the real
   `vendor/react.production.min.js` on disk — caught by both the sha256-vs-manifest
   check AND the sha384-vs-support.js cross-check, restored (`git status` confirmed
   byte-identical to the tracked copy afterward), clean again. Clean run: 35/35.

## P2 — CI / static analysis

7. **[ ] Add a lightweight static security check to CI** (or a pre-commit/local script if
   this project has no CI wiring yet — check `.github/workflows/` before assuming) that
   flags: any `preinstall`/`install`/`postinstall`/`prepare` script appearing in
   `package.json` (currently absent — this check keeps it that way), any new
   `dependencies` entry in `package.json` (the "zero production dependencies" claim is
   load-bearing for the SECURITY_ANALYSIS.md verdict — a new one should be a deliberate,
   reviewed decision, not a silent addition), and newly introduced `child_process`,
   `eval(`, or `new Function(` call sites outside the already-known, reviewed ones
   (`bin/cli.js`'s browser opener, `support.js`'s DC-runtime `new Function` — see
   `WISDOM.md`'s Constraints section for why the latter is intentional and must stay
   restricted to trusted packaged/local content). A simple `grep`-based script is
   sufficient; this doesn't need a real static-analysis engine.

8. **[ ] Live-push credential UX hardening.**
   Per `SECURITY_ANALYSIS.md`'s concern and this project's own existing
   `WISDOM.md` rule ("never persist credentials without an explicit user ask, call it
   out in the UI"): audit the live-push modal's copy to make sure it explicitly says
   persisted fields are stored in `localStorage` (plaintext, readable by any script
   running on the page) — not just that persistence is opt-in. Add a single "Clear all
   live-push credentials" action (distinct from the existing per-field
   remember/forget-all toggles) so a user who opted in and later wants to fully purge
   stored credentials has one obvious place to do it, rather than unchecking N per-field
   boxes individually. Follow this project's existing per-field-persistence code path
   (`buildCredsPayload`/`persistCredsIfOptedIn`, see `HANDOFF.md`) rather than inventing a
   new one.

## P3 — Longer-horizon / roadmap only

9. **[ ] CSP roadmap document (not an implementation yet).**
   The app's inline templates and `new Function`-based DC/component runtime make a
   strict `Content-Security-Policy` a real refactor, not a header you can bolt on. Rather
   than attempt a strict CSP now, write down (in `SECURITY.md` or a dedicated section
   here) what a CSP would need to relax (`'unsafe-inline'` for style, some accommodation
   for the runtime `new Function` eval path) and what the eventual tightening path could
   look like (e.g. nonce-based inline styles if the DC authoring model ever changes) —
   this is a "know what we'd need to do" placeholder, not a scoped implementation ticket.
   Do not start implementation without an explicit ask; this is exactly the kind of
   "substantial, standalone effort" `PLAN.md` asks to scope deliberately before touching.

## Explicitly out of scope (per SECURITY_ANALYSIS.md's own framing)

- Removing `PPTXDIFF_LITE_MODE`/CDN mode entirely — it's already opt-in, documented,
  version-pinned; the analysis's ask was to *keep* it opt-in, not remove it.
- Building a real backend-proxied CORS workaround for Notion/Confluence live push —
  unrelated to this security review; tracked separately in `PLAN.md`/`GAP_ANALYSIS.md`.
- Any change to `support.js`'s `new Function` DC runtime itself — it's flagged as
  "intentional and local," not a defect; the action item is keeping it that way (ticket
  7's static check), not modifying it.

## When picking up a ticket here

Follow this project's existing conventions: Red/Green test the change where a test
harness pattern already exists for the touched file (`test_lite_mode_cli.mjs`-style
spawn-the-real-CLI-and-assert for `bin/cli.js` changes); update `GAP_ANALYSIS.md` /
`WISDOM.md` if the work surfaces a new trap or closes a documented gap; update this
file's `[ ]`/`[x]` status and add a short note to `HANDOFF.md` per the usual end-of-session
rule.
