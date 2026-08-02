# CLI_API_DESIGN.md — Headless CLI + Web API: architecture proposal

**Status**: proposal / not yet implemented. This is a design record (same spirit as GAP_CONTEXT.md's
"why," but forward-looking) — read it before starting any of the PLAN.md tickets it spawns, so
implementation follows the reasoning here instead of re-deriving it.

## 1. The ask

Today `pptxdiff` (the npm CLI, `bin/cli.js`) does exactly one thing: serve `src/pptxdiff/`'s static
files on loopback and open a browser tab. Every actual feature — parsing, diffing, rendering,
exporting, the reviewer workflow — only exists as interactive UI inside that browser tab. There is
no way to run a diff without a human clicking through the page, and no way for another program
(a script, a CI job, a git hook, an AI agent) to get a diff result back as data.

The ask: design (a) a full CLI surface that exposes every pptxdiff feature headlessly, scriptably,
with machine-readable output, and (b) a Web API exposing the same feature set over HTTP — so
pptxdiff can be embedded as infrastructure (a git `difftool`/`textconv` driver for `*.pptx`, a CI
gate, a tool an AI agent calls directly) instead of only a human-operated app.

## 2. What "no backend" actually constrains, and what it doesn't

WISDOM.md's Constraints section is explicit: *"No backend. Everything (parsing, rendering, diffing,
exporting) runs client-side in the browser."* That constraint is about **the shipped app**
(`index.html`) — it must keep working as a single file with zero server dependency, because that's
what makes it trivially distributable, embeddable in the VS Code extension, and safe (a reviewer's
`.pptx` files never leave their machine unless they explicitly trigger a live-push).

Nothing about that constraint forbids building a **separate, opt-in** surface that runs the same
logic in Node instead of a browser tab. `index.html` keeps working exactly as it does today,
unmodified in its zero-backend guarantee; the CLI/API are new, additive surfaces a user explicitly
installs and runs, exactly the same relationship `bin/cli.js` (a Node process) already has to
`index.html` (a static file it serves) today.

## 3. Key finding: the engine is already written in a Node-portable style

This matters more than it might seem, because it changes the CLI/API design from "wrap a browser"
to "extract a library" — a materially better outcome for speed, footprint, and git-integration
use cases (see §6). Checked directly against `index.html`'s source, not assumed:

- `parseBuffer`/`parseSlide`/`parseRelsFor`/etc. (the whole OOXML parser) take `zip`/`buf`/`doc`
  arguments and return plain objects — they don't touch `this.state`, `this.setState`, or any DOM
  node outside a scratch `DOMParser` result. Their only external dependencies are the `JSZip`
  global, the `DOMParser` global, and a couple of class constants (`this.EMU`).
- `alignSlides(A, B)`, `refineMoves(alignment, A, B)`, `markMovedByLIS(pairs)`,
  `findDuplicateSlides(slides)`, `findCrossDeckDuplicates(...)`, `computeContentChecksum(buf)`,
  `isExcludedFromContentChecksum(path)`, `buildJsonReport()`, `buildReportRows()`, `pickMergeWinner`,
  `slideToBuildSpec` — all pure, argument-in/value-out. This is WISDOM.md's own documented "pure-core
  house style," applied consistently across the diff/align/merge engine, not just the newer
  request/cancel/confirmYes UI helpers it was written about.
- There is already a proven precedent for running this style of code in Node unmodified:
  `sample-pptx.js` is a browser-authored ES module (assumes a `JSZip` global and `atob`) that
  `gen-sample-pptx.mjs` runs under plain Node today by shimming exactly those two globals before
  importing it (see WISDOM.md, "running a browser-only ES module from Node"). The parse/diff engine
  needs the same shim, plus one more: `DOMParser` (no Node builtin — `@xmldom/xmldom` or `linkedom`
  covers it) and `crypto.subtle` (Node ≥19 exposes this as a global already, see `engines.node` in
  `package.json`, which already requires `>=18` — bump if needed).

**Conclusion**: extracting the parse/align/diff/checksum/report-building engine into a standalone
Node+browser dual-target module is a real, scoped, mechanical refactor — not a rewrite — because the
code was never actually coupled to the DOM/React in the first place. What IS genuinely
browser-only: the fidelity **renderer** (`@aiden0z/pptx-renderer`'s canvas/DOM output), the
`window.print()`-based PDF export, and the `<foreignObject>`-SVG screenshot capture (§27). Those three
need a real browser (or a from-scratch reimplementation, out of scope). Everything else does not.

## 4. Proposed layering

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3 — Surfaces (what a user/agent/git actually invokes)     │
│  ┌───────────────┐  ┌────────────────────┐  ┌─────────────────┐ │
│  │ pptxdiff (GUI) │  │ @pptxdiff/cli │  │ @pptxdiff/server │ │
│  │ existing        │  │ new headless CLI  │  │ new Web API      │ │
│  │ bin/cli.js      │  │ subcommands       │  │ HTTP/REST        │ │
│  └───────┬────────┘  └─────────┬──────────┘  └────────┬─────────┘ │
│          │ serves              │ imports              │ imports   │
│          ▼                     ▼                      ▼           │
│  ┌───────────────┐   ┌─────────────────────────────────────────┐ │
│  │ index.html     │   │ @pptxdiff/core — engine, browser+Node    │ │
│  │ (browser app)  │◄──┤ parse / align / diff / checksum / report │ │
│  │ imports core   │   │ / merge-plan-apply — zero DOM dependency │ │
│  └───────────────┘   └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        (renderer/PDF/screenshot stay browser-only — see §6, Phase 1)
```

Four packages, not one, so the zero-runtime-dependency guarantee that `pptxdiff` (the GUI launcher)
currently makes stays true for exactly the users who only want the GUI:

| Package | Depends on | Runtime deps |
|---|---|---|
| `pptxdiff` (existing) | — | none (unchanged — stdlib-only static server) |
| `@pptxdiff/core` (new) | — | `jszip`, a `DOMParser` polyfill (~2 small deps) |
| `@pptxdiff/cli` (new) | `@pptxdiff/core`, optionally Playwright | none required for `diff`/`checksum`/`batch`/`merge`; Playwright only if a browser-only export (`report --format pdf`, `screenshot`) is invoked — install on demand, don't force it on everyone |
| `@pptxdiff/server` (new) | `@pptxdiff/core`, stdlib `http` (matches `bin/cli.js`'s existing no-framework style) | same optional-Playwright story as the CLI |

`index.html` itself changes to `import` `@pptxdiff/core` as a local ES module (served by the
existing static server, which already has a `.mjs` MIME type from §24) instead of carrying its own
copy of the parse/diff functions inline — this is what guarantees the CLI/API can never silently
drift from what a human sees in the GUI: there is exactly one engine, imported three ways.

## 5. CLI design (`@pptxdiff/cli`, binary `pptxdiff-cli`)

### Command surface

| Command | Purpose | Notes |
|---|---|---|
| `pptxdiff open [--lite] [--port N]` | today's GUI-launcher behavior | unchanged, stays in the `pptxdiff` package |
| `pptxdiff diff <before> <after>` | full deck-level diff | default: human-readable summary to stdout; `--json` for the full `buildJsonReport()` shape |
| `pptxdiff checksum <file>` | parser-independent SHA-256 content checksum | wraps `computeContentChecksum` directly — useful standalone for "did this deck's real content change" CI gates |
| `pptxdiff batch <beforeDir> <afterDir> [--pairing order\|filename]` | multi-pair diff, same engine as the app's Batch view | `--format table\|csv\|json` |
| `pptxdiff report <before> <after> --format html\|md\|json\|csv\|notion\|confluence [--out file]` | any of the app's non-PDF export formats, headlessly | pure-engine path (Phase 2, see §6) |
| `pptxdiff report <before> <after> --format pdf\|screenshot [--out file]` | the two browser-dependent exports | always drives a real headless browser (Playwright) — documented as such, not silently slow |
| `pptxdiff merge <before> <after> --plan plan.json --out merged.pptx` | apply an exported merge-plan JSON to produce a real `.pptx` | wraps the existing majority-vote/`slideToBuildSpec` merge writer |
| `pptxdiff textconv <file>` | git `textconv` driver — prints a stable, comparable text rendering of ONE file | see §7 |
| `pptxdiff difftool <local> <remote>` | git `difftool` driver — opens the GUI pre-loaded with both files | see §7 |
| `pptxdiff install-git-integration [--global\|--local]` | writes the `.gitattributes`/git-config entries for the two above | asks before touching global config; never silent |
| `pptxdiff mcp` | starts an MCP server exposing the same operations as typed tools | see §9 |

### Output & exit-code contract

This is the single most important design lever for both the git-integration and AI-agent use
cases — a diff tool that prints prose and always exits 0 is useless to a script.

- **Exit codes**: `0` = ran successfully, no differences found; `1` = ran successfully, differences
  found (matches `diff(1)`/`git diff --exit-code` convention, so `pptxdiff diff a.pptx b.pptx` can
  gate a CI step directly); `2+` = tool error (bad/corrupt file, parse failure, I/O error).
- **`--json` on every subcommand**, not just `report --format json` — same report shape
  `buildJsonReport()` already produces in the browser, so a script or agent parsing CLI output and
  a script or agent parsing the Web API's response are learning ONE schema, not two.
- **stdout** = the result; **stderr** = warnings/progress/errors. `--quiet` suppresses non-error
  stderr. TTY-aware coloring, off automatically when piped (matches how most CLIs behave, avoids
  polluting `--json` output — which goes to stdout — with ANSI codes when redirected).

## 6. Execution strategy — how commands actually run

Two ways to make the CLI/API actually produce a result, with a real tradeoff, not a slam dunk:

**Strategy A — drive a real headless browser (Playwright) against `index.html`.**
Load the (already fully offline-capable, per §24) app in headless Chromium, call the exact same
in-page functions a human's click would call via `page.evaluate()`, read the result back. Zero risk
of the CLI/API ever disagreeing with what a human sees in the GUI, because it IS the GUI's code.
Cost: ~1-2s Chromium boot per invocation, a large optional dependency, unfriendly to a
"runs on every `git log -p`" use case.

**Strategy B — the extracted `@pptxdiff/core` engine (§3/§4), running natively in Node.**
Fast (no browser boot), light (two small deps), works in minimal CI containers. Cost: a real
one-time extraction effort, and it structurally CANNOT cover the three genuinely browser-only
features (pixel-fidelity render, `window.print()` PDF, `<foreignObject>` SVG screenshot capture).

**Recommendation: do both, in phases, not one-or-the-other.**

- **Phase 1** (ships the whole command/endpoint surface fast, de-risks the design before investing
  in extraction): Strategy A for everything. Validates that the CLI/API shape in §5/§8 is actually
  the right one against real usage before paying the extraction cost.
- **Phase 2** (perf/footprint follow-up, unblocks git-driver and CI use cases where a Chromium boot
  per file is unacceptable): extract `@pptxdiff/core` per §3/§4. `diff`/`checksum`/`batch`/`merge`/
  `report --format html|md|json|csv|notion|confluence` move to the native path. `report --format
  pdf|screenshot` and the fidelity-render path stay on Strategy A permanently — they're rendering
  features, not diffing features, and always will need a real browser.
- CLI/API commands print which path they used only when it matters (e.g. warn once if a
  browser-only format is requested and Playwright isn't installed, rather than a confusing
  `MODULE_NOT_FOUND`).

## 7. Git integration

Two distinct, standard git extension points, both needed (they solve different problems):

- **`textconv`** — used by `git diff`, `git log -p`, `git show`. Git can't line-diff a binary
  `.pptx`, but it CAN line-diff whatever a configured filter prints for a SINGLE file. `pptxdiff
  textconv <file>` prints a stable, deterministic, comparable text rendering (per-slide shape/text
  dump, similar in spirit to the "Slide N: ..." shape a report row already produces) so `git diff`
  shows something meaningful inline in a terminal instead of `Binary files a/deck.pptx and
  b/deck.pptx differ`. Wiring: `.gitattributes` → `*.pptx diff=pptxdiff`; git config →
  `[diff "pptxdiff"] textconv = pptxdiff textconv`.
- **`difftool`** — used by `git difftool`. Git hands the driver two temp file paths (old, new) and
  expects it to present a diff UI; it doesn't need to be text. `pptxdiff difftool "$LOCAL"
  "$REMOTE"` opens the existing single-pair GUI view pre-loaded with both files — this is the
  "real" visual diff experience, reusing 100% of the existing rendering/reviewer-workflow UI, not a
  new one. Wiring: `[difftool "pptxdiff"] cmd = pptxdiff difftool \"$LOCAL\" \"$REMOTE\"`.
- `pptxdiff install-git-integration` writes both sets of config for the user rather than making
  them hand-edit `.git/config`/`.gitattributes` — but per this project's own risk posture (and the
  general "confirm before touching shared/global state" rule), it must ask before writing to the
  user's **global** `~/.gitconfig`, and should default to **repo-local** `.git/config` +
  `.gitattributes` (committable, so the whole team gets it) unless `--global` is explicitly passed.

## 8. Web API design (`@pptxdiff/server`)

Stateless-first (matches most of what the CLI does), with an optional stateful **session** layer for
the parts of the app that are inherently multi-step (the reviewer workflow — approve/reject,
comments, merge-winner picks). Sessions are what let a headless client (an AI agent, a CI bot) and a
human using the actual GUI collaborate on the SAME review, not just get a one-shot diff — this is
the API's most distinctive value beyond "diff as a service."

### Stateless endpoints

| Endpoint | Purpose |
|---|---|
| `POST /v1/diff` | multipart upload (before/after) → full JSON diff report |
| `POST /v1/checksum` | one file → `{algorithm, hash}` |
| `POST /v1/batch` | multiple before/after pairs → batch report |
| `POST /v1/report` | `{before, after, format}` → file bytes, or a job id for `pdf`/`screenshot` (see below) |
| `POST /v1/merge` | `{before, after, plan}` → merged `.pptx` bytes |
| `GET /v1/jobs/{id}` | poll status/result for the async browser-dependent export formats |

### Stateful session endpoints (mirrors the GUI's reviewer workflow)

`POST /v1/sessions` (from a diff) → `PATCH /v1/sessions/{id}/decisions|comments|merge-choices` →
`GET /v1/sessions/{id}/report`. Session state lives server-side (in-memory or file-backed —
explicitly NOT `localStorage`, since there's no browser now), same shape as the app's existing
`slideDiffReviewerState_v1` object, so import/export round-trips between a session and a GUI's
"Import report JSON…" stay compatible.

### Security posture — carries forward, doesn't reinvent

The 2026-07-29/30 CLI-hardening session (loopback binding by default, `path.relative()`-based
containment, security response headers — see SECURITY_ANALYSIS.md/SECURITY_HARDENING_PLAN.md) set
the precedent this API must match, not relitigate:

- Bind `127.0.0.1` by default; a non-loopback bind requires an explicit flag AND an API key.
- Never hold third-party credentials (Slack/Notion/Confluence) server-side — same "no secret
  custody" principle the GUI's live-push feature already follows; the API is pass-through only if
  it ever proxies a live-push call, never a stored-credential vault.
- Request size limits on uploads (decks can be large; unbounded multipart bodies are a DoS vector).
- An OpenAPI spec generated from the route definitions — not just for humans; this is what makes
  the API genuinely usable by an AI agent's tool-calling layer without hand-written integration
  code (see §9).

## 9. AI-agent integration

This is the part of the original ask ("an AI agent can review and fix PowerPoint documents
alongside human users") that needs its own explicit answer, not just "the API happens to be
usable by anyone." Two concrete mechanisms, complementary:

1. **`--json` everywhere + OpenAPI spec** (already in §5/§8) — the baseline. Any agent that can
   shell out or make an HTTP call can already parse structured pptxdiff output.
2. **`pptxdiff mcp`** — an MCP (Model Context Protocol) server exposing `diff`/`checksum`/
   `batch`/`report`/`merge`/session operations as typed tools. This is the more idiomatic
   integration point for an agent like Claude specifically (no shell-escaping, no HTTP client
   boilerplate, structured tool schemas instead of a man page) and can be a thin wrapper over the
   exact same `@pptxdiff/core` calls the CLI and API already use — not a fourth reimplementation.

## 10. Decisions (resolved 2026-07-31)

- **Package split: four packages**, as proposed in §4 (`pptxdiff` / `@pptxdiff/core` /
  `@pptxdiff/cli` / `@pptxdiff/server`) — the GUI launcher keeps its zero-runtime-dependency claim.
- **Execution strategy: Phase 1 (Playwright-driven) first.** Ship the full CLI+API command/endpoint
  surface reusing the existing browser engine as-is; defer the `@pptxdiff/core` native extraction
  (Phase 2) until the surface design is validated against real usage.
- **Build order: CLI and Web API together, not sequentially.** Since Phase 1 means both surfaces
  are thin wrappers around the same Playwright-driven automation shim, build that shim once and
  stand up both the CLI subcommands (§5) and the API endpoints (§8) on top of it in the same pass,
  rather than building one first and duplicating the wrapper logic for the other later.

## 10a. Package-family naming direction (resolved 2026-08-02)

Owner note: the npm org/scope `@pptxdiff` is available because project owner owns the npm org `pptxdiff`. Future published package naming should therefore prefer:

| Package | Role |
|---|---|
| `pptxdiff` | Main user-facing GUI launcher / shortest `npx pptxdiff` entry point. |
| `@pptxdiff/cli` | Headless CLI package (`diff`, `checksum`, `textconv`, `difftool`, `install-git-integration`). Supersedes the earlier unscoped `pptxdiff-cli` naming direction for eventual publication. |
| `@pptxdiff/server` | Loopback HTTP API package (`/v1/diff`, `/v1/checksum`, `/v1/health`, later sessions/jobs). |
| `@pptxdiff/core` | Future extracted shared engine: parse / align / diff / checksum / report helpers, with browser-only rendering/export paths remaining outside native core per §6. |

Important npm detail: package name and binary name do not need to match. `@pptxdiff/cli` can still expose a `pptxdiff-cli` binary, and `@pptxdiff/server` can still expose a `pptxdiff-server` binary, preserving ergonomic shell commands while keeping package names in the scoped family.

Pros of the `@pptxdiff/*` scoped family:
- Clear ownership/branding signal: all modular packages visibly belong to the same project.
- Lower name-collision risk than unscoped names such as `pptxdiff-server` or `pptxdiff-core`.
- Better monorepo organization as the package family grows (`@pptxdiff/cli`, `@pptxdiff/server`, `@pptxdiff/core`, possibly `@pptxdiff/mcp` later).
- Cleaner collaborator/access control through npm org permissions.
- More consistent internal dependency graph once `@pptxdiff/core` exists.

Cons / costs:
- Slightly more publish ceremony: public scoped packages generally need `npm publish --access public`.
- Longer install names (`npm install @pptxdiff/server`) than unscoped equivalents.
- Users may initially wonder how root `pptxdiff` relates to scoped `@pptxdiff/*` packages; README/package docs should state that `pptxdiff` is the public GUI entry point and `@pptxdiff/*` are companion packages.
- Rename cost is now mostly paid in package metadata: current local package name is `@pptxdiff/cli`, while the exposed shell binary remains `pptxdiff-cli`. Keep docs/tests clear about package name vs. binary name.

Recommended dependency direction remains:

```text
pptxdiff
@pptxdiff/core
@pptxdiff/cli -> pptxdiff + @pptxdiff/core
@pptxdiff/server -> @pptxdiff/cli and/or @pptxdiff/core
```

## 11. What this does NOT change

- `index.html` still runs with zero backend when opened directly (`file://`) or via the existing
  `pptxdiff` GUI launcher — the `@pptxdiff/core` extraction only changes WHERE the parse/diff code
  physically lives, not whether the browser app needs a server to function.
- The three browser-only export features (fidelity render, PDF, SVG screenshot) don't get a native
  reimplementation under this proposal — they stay real-browser-only, permanently, by design (see
  §6, Phase 2).
- Nothing here touches the "no server-side secret custody" principle for Slack/Notion/Confluence —
  the API's session/live-push story (if built) inherits the exact same constraint the GUI already
  has, not a relaxed one.
