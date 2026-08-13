---
name: help-scrolls
description: "Shows a crisp, example-driven reference for the whole scrolls skill family (/setup-scrolls, /update-scrolls, /hide-scrolls, /unhide-scrolls) — what each command does, their shared -p/-t/-l/-r/-u flags, and common usage examples (new project, monorepo, running from a subdirectory, toggling hidden/visible). Use this whenever the user runs /help-scrolls, or asks what the scrolls commands do, how to use them, what flags they take, which one they need, or seems unsure about docs/.scrolls setup — even if they only name one of the four commands rather than 'scrolls' generally. Supports -e/--online to render it as a styled page served on an OS-assigned localhost port instead of chat text."
---

# Scrolls help

This skill's job is to answer clearly and get out of the way — not to explore the codebase, not to check whether scrolls are actually set up here, not to make any changes.

## Options

Read the invocation text for an optional **`-e` / `--online`** — instead of (or in addition to, if it's ambiguous which the user wants) answering in chat, render `references/HELP.md` as a styled HTML page and serve it locally. Everything else about interpreting the request (bare invocation vs. a specific question) works exactly the same regardless of this flag; `-e` only changes the output channel.

## Steps

1. Read `references/HELP.md` — that's the maintained, canonical content. Present it rather than reconstructing an explanation from memory of how these skills work: flag semantics here have changed across iterations (e.g. `-r` used to mean "repo root," now means "recurse"), and the reference file is the single source of truth that gets updated when that happens.
2. **`-e`/`--online` given**: run `bash <skill-dir>/scripts/open_help.sh`. It launches a small stdlib-only Python server (no dependencies to install) that renders `HELP.md` into a clean, self-contained HTML page — tables, code blocks, headings, dark-mode aware — and binds it to `127.0.0.1` on a port the OS assigns (never all interfaces; this is a local reference viewer, not something to expose on the network). The script waits for the server to confirm it's actually listening before printing anything, then prints the URL followed by the process's PID. Report that URL to the user as a clickable link and mention the PID so they can stop the server later if they want to (it keeps running after this skill finishes, so the link stays open) — a fresh invocation with `-e` starts another server on a new port rather than reusing one, which is fine but worth knowing if several accumulate over a long session. If the script's own browser-opening attempt didn't visibly do anything (e.g. a headless/remote environment with no display), that's expected — the URL is still valid and the report to the user is what matters.
3. **Bare `/help-scrolls`, or an open-ended question** ("what are the scrolls commands," "how does this work"), without `-e`: present the whole document, as markdown chat output. This is an answer, not a deliverable — don't write it to a file or publish it as an artifact unless the user separately asks for that.
4. **A specific question** (one command, one flag, one scenario like "how do I do this in a monorepo," or a command name mentioned on its own): lead with the directly relevant part of the doc, answered concisely, and mention that the rest is available via a bare `/help-scrolls` — don't dump the whole reference regardless of what was actually asked. This applies whether or not `-e` was also given — `-e` changes where the *full* doc goes, not whether a targeted question still gets a targeted answer first.
5. Keep the reference file's own tone and formatting when you present it (in chat or via the rendered page) — it's already written to be crisp; don't editorialize, pad, or re-explain what it already says clearly.

If you notice the reference has drifted from what the other four skills actually do (a flag behaves differently than documented, a new flag exists that isn't listed), fix `references/HELP.md` itself rather than just answering around the gap — this file needs to stay accurate as `setup-scrolls`/`update-scrolls`/`hide-scrolls`/`unhide-scrolls` evolve, since it's the thing users are told to trust, in chat and on the rendered page alike.
