# Security

`pptxdiff` is a local-first PowerPoint diff/review tool: a single static HTML/JS
app (`src/pptxdiff/index.html` + `support.js`) served by a small stdlib-only CLI
(`bin/cli.js`), or usable directly as a static file with no server at all. This
document explains the app's security model, what hardening has already been
done, and how to report a vulnerability.

## Reporting a vulnerability

Please open a [GitHub issue](https://github.com/sugatoray/pptxdiff/issues) or
email the maintainer (see `package.json`'s `author` field) with details. There
is no bug bounty; this is a small open-source tool maintained on a
best-effort basis, but reports are read and acted on.

## Local-first, no cloud upload

The app's core comparison workflow — parsing two `.pptx` files, diffing them,
rendering fidelity previews, exporting reports — runs entirely client-side in
the browser. Files you select are read locally; nothing is uploaded to a
server by default. The only features that make outbound network calls are
ones you explicitly opt into (see "Live push" below) or the offline-mode
escape hatch (see "CDN / lite mode" below).

## No npm lifecycle scripts, zero production dependencies

`package.json` has no `preinstall`/`install`/`postinstall`/`prepare` script —
installing the npm package does not execute any package code. It also has no
production `dependencies` (only `devDependencies`, used for building/testing
this repo, never installed alongside the published package). Both of these
are load-bearing invariants for this package's security posture; a future
change that adds either should be a deliberate, reviewed decision.

## The CLI (`bin/cli.js`)

Running `pptxdiff` starts a small static file server and opens a browser tab.
Hardening applied so far (see `docs/.scrolls/SECURITY_HARDENING_PLAN.md` for
the full ticketed history):

- **Loopback-only binding.** The server listens explicitly on `127.0.0.1`,
  not an unspecified host that could bind more broadly on some
  Node/platform combinations.
- **No shell execution.** The browser-launch step uses `execFile()` (an
  `open`/`xdg-open`/`cmd.exe` invocation with an argv array), never `exec()`
  with a shell-interpolated command string. The launched URL is always
  internally generated (`http://localhost:<port>...`), never user input.
- **Path containment via `path.relative()`.** Requested file paths are
  resolved and checked with a `path.relative()`-based containment function,
  not a raw string-prefix check — this correctly rejects a sibling directory
  that merely shares the served root's prefix, a case a naive
  `startsWith()` check gets wrong. (Symlinks are not separately
  canonicalized; see the hardening plan's ticket 3 for the reasoning.)
- **Response headers.** Every response sets `X-Content-Type-Options: nosniff`
  and `Cache-Control: no-store`.

The server only ever serves this package's own bundled app directory
(`src/pptxdiff/`) — it is not a general-purpose file server.

## Browser-side `new Function` (design-component runtime)

`support.js` (the packaged app's runtime) uses `new Function` to evaluate the
app's own bundled template/logic code. This is intentional and scoped to
trusted, packaged/local content shipped in this repository — it does not
evaluate anything fetched from a remote or user-controlled source. Keep it
that way: this runtime should never be pointed at untrusted remote component
sources.

## CDN / lite mode (opt-in only)

By default, every dependency the app needs to boot (React, ReactDOM, Babel
standalone, JSZip, `@aiden0z/pptx-renderer`, and the Spectral font) is
vendored locally under `src/pptxdiff/vendor/` — see
`src/pptxdiff/vendor/PROVENANCE.md` for exact versions, source URLs, and
integrity hashes. Setting `PPTXDIFF_LITE_MODE=1` (or appending `?lite=1` to
the app's URL) opts back into loading those same, version-pinned libraries
from their original CDNs (unpkg, cdnjs, esm.sh, Google Fonts) instead. This
is off by default, documented, and pinned to specific versions — it exists
as an escape hatch, not the default behavior. Prefer keeping it opt-in rather
than removing it.

## Live push (Slack / Notion / Confluence)

The "Live push" feature sends user-provided credentials (a Slack webhook URL,
a Notion integration token, a Confluence API token, etc.) directly from the
browser to the respective third-party API. This is expected, user-initiated
functionality — not something that happens without your action — but it does
mean:

- Those credentials live in the browser's memory (and origin) while the
  modal is open, so any script able to run on the page during that window
  could in principle read them.
- If you opt in to persisting a credential field, it is stored in
  `localStorage` **in plaintext**, readable by any script running on the
  page's origin. Persistence is per-field, opt-in, and kept in a dedicated
  `localStorage` key separate from ordinary reviewer state (decisions,
  comments, history) — so clearing one can never accidentally clear the
  other. Use the live-push modal's own "forget"/clear controls if you want
  to remove stored credentials.

Treat live-push credentials the same way you'd treat any token pasted into a
browser: convenient, but with the caveats plaintext client-side storage
always carries.

## No Content-Security-Policy (yet)

The app's inline templates/styles and the `new Function`-based runtime
described above make a strict CSP a real refactor rather than a header that
can be bolted on today. See `docs/.scrolls/SECURITY_HARDENING_PLAN.md`'s P3
ticket for what a future CSP would need to relax and what a tightening path
could look like. This is a known, accepted gap, not an oversight.

## Vendored dependency provenance

`src/pptxdiff/vendor/` ships pre-built third-party libraries so the app can
run fully offline. `src/pptxdiff/vendor/PROVENANCE.md` and
`src/pptxdiff/vendor/manifest.json` record, per file: the upstream package
and exact version, the source URL it was fetched/built from, an integrity
hash, and its license. `scripts/verify_vendor.mjs` re-derives each file's
hash and checks it against the manifest — run it any time you want to
confirm the vendored bytes on disk haven't drifted from what's documented:

```sh
node scripts/verify_vendor.mjs
```

## Why a scanner might flag this package

An automated scanner (e.g. Socket's "AI detected potential security risk")
may flag this package for capabilities that are legitimate here: local
filesystem serving, `child_process` use to open a browser, browser-side
`new Function` evaluation, an optional CDN-loading mode, and browser-to-
third-party network calls for live push. A manual security review
(`docs/.scrolls/SECURITY_ANALYSIS.md`, 2026-07-27) found no evidence of
malware, credential exfiltration, install-time execution, or hidden
supply-chain behavior — the verdict was "reasonable to use after manual
review." The hardening described above (and tracked in
`docs/.scrolls/SECURITY_HARDENING_PLAN.md`) is about reducing blast radius
and making that review easier to reproduce, not responding to an active
vulnerability.
