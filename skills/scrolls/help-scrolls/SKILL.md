---
name: help-scrolls
description: "Shows a crisp, example-driven reference for the whole scrolls skill family (/setup-scrolls, /update-scrolls, /hide-scrolls, /unhide-scrolls) — what each command does, their shared -p/-t/-l/-r/-u flags, and common usage examples (new project, monorepo, running from a subdirectory, toggling hidden/visible). Use this whenever the user runs /help-scrolls, or asks what the scrolls commands do, how to use them, what flags they take, which one they need, or seems unsure about docs/.scrolls setup — even if they only name one of the four commands rather than 'scrolls' generally."
---

# Scrolls help

This skill's job is to answer clearly and get out of the way — not to explore the codebase, not to check whether scrolls are actually set up here, not to make any changes.

1. Read `references/HELP.md` — that's the maintained, canonical content. Present it rather than reconstructing an explanation from memory of how these skills work: flag semantics here have changed across iterations (e.g. `-r` used to mean "repo root," now means "recurse"), and the reference file is the single source of truth that gets updated when that happens.
2. **Bare `/help-scrolls`, or an open-ended question** ("what are the scrolls commands," "how does this work"): present the whole document, as markdown chat output. This is an answer, not a deliverable — don't write it to a file or publish it as an artifact unless the user separately asks for that.
3. **A specific question** (one command, one flag, one scenario like "how do I do this in a monorepo," or a command name mentioned on its own): lead with the directly relevant part of the doc, answered concisely, and mention that the rest is available via a bare `/help-scrolls` — don't dump the whole reference regardless of what was actually asked.
4. Keep the reference file's own tone and formatting when you present it — it's already written to be crisp; don't editorialize, pad, or re-explain what it already says clearly.

If you notice the reference has drifted from what the other four skills actually do (a flag behaves differently than documented, a new flag exists that isn't listed), fix `references/HELP.md` itself rather than just answering around the gap — this file needs to stay accurate as `setup-scrolls`/`update-scrolls`/`hide-scrolls`/`unhide-scrolls` evolve, since it's the thing users are told to trust.
