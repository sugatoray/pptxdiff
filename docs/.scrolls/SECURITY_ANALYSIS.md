# Security Analysis

## 20260727 22:11:37 - npm package `pptxdiff`

Reviewer: Codex (GPT-5)

Scope: npm package metadata at repository root, packaged runtime files under `src/pptxdiff`, CLI entrypoint `bin/cli.js`, vendored browser dependencies, browser-side integrations, and npm audit results.

Verdict: no evidence of malware, credential exfiltration, install-time execution, dependency confusion, or hidden supply-chain behavior was found in the local package. The Socket "AI detected potential security risk" signal is plausible as a static-analysis false-positive or manual-review trigger caused by legitimate but sensitive capabilities: local filesystem serving, `child_process.exec` browser launch, browser-side `new Function` runtime evaluation, optional CDN loading in lite mode, and browser-to-third-party live-push integrations.

Strengths:

- No `preinstall`, `install`, `postinstall`, or `prepare` lifecycle script is present in `package.json`; installing the npm package should not execute package code.
- The published package has no production dependencies. `npm audit --omit=dev` and full `npm audit` both reported `found 0 vulnerabilities` at review time.
- Runtime dependencies are vendored locally by default: React, ReactDOM, Babel standalone, JSZip, `@aiden0z/pptx-renderer`, and Spectral fonts ship in `src/pptxdiff/vendor`, reducing runtime dependency on CDNs.
- The CLI is a small stdlib-only local static server. It serves the package's own app directory and rejects path traversal attempts outside that root.
- The app's core comparison workflow is local-first: user-selected PPTX files are read in the browser, and default operation does not require cloud upload.
- Live-push credential persistence is opt-in and separated from general review state in `localStorage`, which is a better default than silently storing tokens.
- Vendored licenses are included for the major browser dependencies.

Concerns and weaknesses:

- `bin/cli.js` imports `child_process.exec` to open the browser. The constructed command only uses an internally generated localhost URL and a platform-selected opener, so this does not look exploitable as command injection today. However, scanners will correctly flag shell access, and future changes that introduce user-controlled URL/command fragments could make it dangerous.
- The CLI path containment check uses `filePath.startsWith(ROOT)`. This blocks ordinary `../` traversal, but prefix checks are easier to get wrong than `path.relative()`-based containment, especially if symlinks, casing, encoded separators, or sibling paths sharing the same prefix ever enter the serving path.
- The local HTTP server calls `server.listen(0)` without an explicit host. Depending on Node/platform defaults, this may bind more broadly than loopback. The intended use is local-only, so binding explicitly to `127.0.0.1` or `localhost` would reduce exposure.
- `support.js` uses `new Function` for the design-component runtime and imported JSX/module execution. This appears intentional and local to the app's component system, but any future ability to load untrusted remote component sources would become a code-execution boundary. Keep this restricted to trusted packaged/local app content.
- `PPTXDIFF_LITE_MODE` and `?lite=1` intentionally switch several libraries/fonts to CDN URLs. This is opt-in, documented, and pinned to specific versions, but it reintroduces network supply-chain risk and browser privacy leakage. Continue to keep offline vendoring as the default.
- Browser-side live push sends user-provided credentials/tokens to Slack, Notion, or Confluence endpoints from the page. That is expected functionality, but it means the browser origin and any injected script would have access to those credentials while the modal is active. Persisting credentials in `localStorage`, even opt-in, should be described as convenience with risk.
- The package ships large minified vendored bundles. This improves offline behavior but makes human review harder and requires a repeatable process for verifying vendored bytes, upstream versions, SRI hashes, and licenses.
- There is no Content-Security-Policy in the static HTML. Because the app intentionally uses inline templates/styles and dynamic code evaluation, a strict CSP may require refactoring, but the absence of CSP increases impact if HTML injection is introduced later.

Recommended improvements:

- Replace `exec()` browser launch with `spawn()` or `execFile()` using fixed executable names and argument arrays.
- Bind the CLI server explicitly to loopback, for example `server.listen(0, "127.0.0.1", ...)`.
- Replace `startsWith(ROOT)` containment with a helper based on `path.resolve()` plus `path.relative()`, and add regression tests for encoded traversal, sibling-prefix paths, and platform path separators.
- Add `X-Content-Type-Options: nosniff`, conservative cache headers, and a local-only server banner/header. Consider a best-effort CSP roadmap, even if current dynamic runtime constraints prevent a strict policy immediately.
- Add a `SECURITY.md` or README security section explaining the Socket alert, local-first model, no install scripts, no production dependencies, optional CDN mode, shell opener behavior, and live-push credential handling.
- Document and automate vendored dependency provenance: exact upstream package/version/source URL, integrity hash, license, and a verification command that compares the vendored file with the pinned upstream artifact.
- Keep lite/CDN mode opt-in only. Avoid adding remote script loading outside that explicit mode.
- Treat live-push credentials as sensitive: prefer session-only defaults, keep per-field persistence opt-in, add UI copy that warns about localStorage persistence, and consider a "clear all live-push credentials" command.
- Add a lightweight static security check in CI for lifecycle scripts, unexpected dependencies, dynamic remote script URLs, and newly introduced `child_process`, `eval`, or `new Function` call sites.

Bottom line: the npm package is reasonable to use after manual review. The Socket warning should not be ignored, but the local evidence points to explainable static-analysis triggers rather than a malicious supply-chain package. The highest-value hardening work is to make the CLI strictly loopback and argument-safe, strengthen static-file path containment, and make the vendored-dependency provenance story auditable.
