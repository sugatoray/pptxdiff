# CLI_and_API.md — runtime/tooling discussion addendum

**Status**: discussion record, no implementation yet. Read `docs/.scrolls/CLI_API_DESIGN.md` first
for the full CLI/Web API architecture, phasing, and package split — this file is a scoped addendum
capturing one specific follow-up question raised after that design's Phase-1-first decision, kept
separate so the main design doc stays about the architecture, not a runtime-comparison tangent.

## Question raised

After `CLI_API_DESIGN.md`'s decisions were recorded (four packages; Phase 1 = Playwright-driven
before the native `@pptxdiff/core` extraction; CLI + Web API built together on one shared
automation shim), the follow-up: *could Deno be used instead of Playwright, and would that keep
the volume of vendored libraries small?* Discussion only, nothing implemented or committed as code
from this exchange.

## Answer: Deno and Playwright are not substitutes for each other

They solve different problems. **Deno is a JS/TS runtime** — an alternative to Node. **Playwright
is a browser-automation library** that happens to also manage a Chromium download. Swapping the
runtime that *orchestrates* a browser doesn't remove the need for the browser itself.

The weight in Phase 1 isn't Playwright-the-library (a few MB) — it's Chromium-the-browser
(~130–300MB depending on OS). That cost exists because three pptxdiff export features are
**structurally browser-only**, independent of what drives them:

- pixel-fidelity slide rendering (`@aiden0z/pptx-renderer` draws to canvas/DOM)
- PDF export (literally `window.print()` of the live page)
- SVG screenshot capture (clones the live DOM into a `<foreignObject>`, per SPEC.md §27)

None of that exists in Deno — no layout/rendering engine, no `window.print()`, no DOM to clone.
Swapping Playwright for `deno_puppeteer` (a real Deno port of Puppeteer) still downloads a
Chromium, just via a Deno-flavored API. For Phase 1 specifically, **Deno doesn't shrink anything —
it's orthogonal to the vendoring question.**

## Where Deno would actually help: Phase 2, not Phase 1

Phase 2's native `@pptxdiff/core` extraction (the non-browser commands — `diff`/`checksum`/
`batch`/`merge`/most report formats, see `CLI_API_DESIGN.md` §3/§4/§6) is where Deno has real,
specific advantages:

- Built-in Web Crypto matching the same `crypto.subtle` API the checksum code
  (`computeContentChecksum`) already uses in the browser — no polyfill needed, same as Node ≥18.
- `npm:jszip` specifier support, so the one real dependency the engine needs is still available
  without a separate package ecosystem.
- `deno compile` can produce a single, dependency-free, portable binary — no `node_modules`, no
  npm install step for the end user. This resonates with the project's own stated identity
  ("Completely local, no cloud upload," `package.json` description) and its existing
  security-hardening posture (SECURITY_ANALYSIS.md/SECURITY_HARDENING_PLAN.md).

**One correction to the record**: `DOMParser` is a browser/HTML-spec API, not part of the
WinterCG-common runtime surface (fetch/streams/crypto/URL) that either Node or Deno implements
natively. Both need a userland polyfill for it — `@xmldom/xmldom`/`linkedom` on Node,
`deno_dom`/`linkedom` (via `npm:` specifier) on Deno. This is a wash between the two runtimes, not
a Deno advantage — corrected here because the original design-doc reasoning in `CLI_API_DESIGN.md`
§3 only checked this against Node.

## Why Deno isn't the Phase 2 answer either, at least not by default

Two concrete reasons to not reach for it reflexively, even for the parts where it would genuinely
help:

1. **It would be a second runtime** alongside the Node-based GUI launcher (`bin/cli.js`), the VS
   Code extension (`src/packages/pptxdiff-vscode`), and the docs-site tooling — real onboarding and
   maintenance cost for a narrow slice of the surface, not a wholesale migration (which is a much
   bigger, separate decision this discussion does not make).
2. **`deno compile` binaries still need per-OS builds and still hit Gatekeeper/SmartScreen without
   code signing** — exactly the packaging/signing burden `GAP_CONTEXT.md`'s "Why the npm CLI opens
   a browser tab instead of a real native window" entry records the project **explicitly
   rejecting** when it chose CLI+browser over Electron/Tauri. Reintroducing that tradeoff via a
   runtime choice for the CLI would relitigate a settled decision without saying so — worth
   surfacing explicitly rather than letting it happen by accident.

## The lever that actually shrinks Phase 1's footprint (runtime-independent)

Use `playwright-core` (no bundled Chromium download) instead of the full `playwright` package, and
auto-detect an already-installed system Chrome/Edge/Chromium via `executablePath`, falling back to
a one-time `playwright install chromium` prompt **only** when a browser-dependent command
(`report --format pdf|screenshot`) is actually invoked and no system browser is found. This is a
Node-side change, keeps one runtime, and gets most of the realistic size win without any of the
second-runtime or packaging-burden costs above.

## Net recommendation

- **Phase 1**: stay on Node + `playwright-core` + system-browser detection (lazy Chromium install,
  only for the two commands that structurally need it).
- **Phase 2**: reconsider Deno specifically as a possible **additional** distribution channel for
  the native `@pptxdiff/core`-based engine/CLI — e.g. a `deno compile` release binary shipped
  *alongside* the npm package, not instead of it — once that engine actually exists. Not a Phase 1
  decision, and not a decision to make in the abstract; revisit with the real engine code in hand.
