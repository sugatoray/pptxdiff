# Project instructions: pptxdiff-brew

## Versioning

This package's `version` (in `package.json` and `CHANGELOG.md` headings) follows:

```
{{pptxdiff-version}}-{{calver}}
```

- **`pptxdiff-version`** — the `pptxdiff` npm version this directory's `Formula/pptxdiff.rb` is
  currently pinned to (the version in its `url`/`sha256` lines, set by `sync-tap.mjs`). This is
  **not** the root repo's `package.json` version — the formula pin only moves once a version is
  actually published to npm and synced, so the two can legitimately differ for a while.
- **`calver`** — `YYYYMMDD` (e.g. `20260809`), the date of the most recent change to *anything* in
  this directory (formula, scripts, tests, docs, CI workflow) — not just formula-pin bumps.
  Unpadded/dotted forms like `YYYY.MM.DD` are avoided because SemVer's pre-release-identifier rules
  forbid leading zeros in dot-separated numeric segments (`08`, `09` are invalid); a single
  `YYYYMMDD` integer identifier has no such issue and still sorts correctly.

Example: `0.7.0-20260809` = formula pinned to `pptxdiff@0.7.0`, package last touched 2026-08-09.

**Why not plain SemVer:** this package doesn't have its own independent feature/release cadence —
it exists to track and re-package someone else's releases (`pptxdiff` on npm) plus whatever
packaging/tooling maintenance happens around that. A Debian-style `upstream-packaging_revision`
split fits better than SemVer; CalVer is used for the packaging-revision half instead of an
incrementing integer because this directory's own changes are naturally date-driven (weekly CI
sync + occasional manual edits), not milestone-driven.

**When to bump:**

- Formula pin changes (`sync-tap.mjs` updates `url`/`sha256`) → update both halves: the
  `pptxdiff-version` to match, and `calver` to today.
- Any other change in this directory (docs, tests, CI workflow, etc.) with no pin change → keep
  `pptxdiff-version` as-is, bump only `calver` to today.

Update `package.json`'s `version` field and add a new `## [{version}] - {date}` heading in
`CHANGELOG.md` (moving the accumulated `## [Unreleased]` content under it) whenever either half
changes.

## CHANGELOG.md entry rules

- `pptxdiff-version` and `calver` in each `## [{pptxdiff-version}-{calver}]` heading reflect what
  was true **at the commit(s) that introduced that entry** — not the date the changelog happened to
  be edited. If work is later reorganized/reworded in the changelog without new substantive changes,
  the heading's date does not move.
- Each version section has **at most one** of each subsection heading (`### Added`, `### Changed`,
  `### Fixed`, `### Verified`, `### Removed`, etc.). If multiple commits under the same version add
  entries to the same subsection, merge their bullets into that one heading, in chronological order,
  rather than repeating the heading.
- Commits sharing the same `pptxdiff-version` and calendar date collapse into one version section
  (`calver` is day-granularity), even if they were separate commits.
