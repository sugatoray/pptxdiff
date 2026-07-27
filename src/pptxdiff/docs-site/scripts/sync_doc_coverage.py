#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.9"
# dependencies = ["pyyaml"]
# ///
"""Documentation-coverage tracker for src/pptxdiff/docs-site/docs/.

Cross-references coverage_registry.yml (the canonical list of features and
limitations pptxdiff's docs are expected to cover -- curated from
docs/.scrolls/SPEC.md and docs/.scrolls/GAP_ANALYSIS.md in the repository)
against every page's own `doc_coverage:` YAML front matter, and writes the
result into documentation-coverage.md's front matter (read by that page's
Jinja macros at mkdocs-build time to render the actual table -- see main.py).

Two modes:
  --write   Recompute the report and write it into documentation-coverage.md's
            front matter (creates the page if it doesn't exist yet).
  --check   Recompute the report and fail (exit 1) if it differs from what's
            currently on disk, or if anything is structurally broken: a page
            references a registry id that doesn't exist, a duplicate id
            exists in the registry, or a page's `anchor` doesn't match any
            actual heading in that page. This is the Red/Green regression
            test -- it does NOT require 100% coverage (partial/missing rows
            are legitimate, expected states), only that the tracking itself
            is internally consistent and not stale.

Run:
  uv run src/pptxdiff/docs-site/scripts/sync_doc_coverage.py --check
  uv run src/pptxdiff/docs-site/scripts/sync_doc_coverage.py --write
"""
import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

SCRIPT_DIR = Path(__file__).resolve().parent
DOCS_SITE_DIR = SCRIPT_DIR.parent
DOCS_DIR = DOCS_SITE_DIR / "docs"
REGISTRY_PATH = SCRIPT_DIR / "coverage_registry.yml"
COVERAGE_PAGE_PATH = DOCS_DIR / "documentation-coverage.md"
COVERAGE_PAGE_REL = "documentation-coverage.md"

FRONT_MATTER_RE = re.compile(r"\A---\n(.*?\n)---\n(.*)\Z", re.DOTALL)
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$", re.MULTILINE)
QUALITY_LEVELS = ("complete", "partial")  # "missing" is computed, never declared


def slugify(heading_text):
    """Approximates python-markdown's `toc` extension slug algorithm closely
    enough for this project's own (plain ASCII, no duplicate-heading) pages.
    Strips inline Markdown formatting markers, lowercases, spaces -> hyphens,
    drops anything that isn't alnum/hyphen/underscore."""
    text = re.sub(r"[`*_]+", "", heading_text)
    text = text.strip().lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s]+", "-", text)
    return text.strip("-")


def split_front_matter(text):
    """Returns (meta_dict_or_None, body_text). body_text is the FULL original
    text if there's no front matter, else everything after the closing ---."""
    m = FRONT_MATTER_RE.match(text)
    if not m:
        return None, text
    meta = yaml.safe_load(m.group(1)) or {}
    return meta, m.group(2)


def dump_front_matter(meta, body):
    header = yaml.safe_dump(meta, sort_keys=False, allow_unicode=True, default_flow_style=False)
    return "---\n" + header + "---\n" + body


def load_registry():
    data = yaml.safe_load(REGISTRY_PATH.read_text())
    items = {}
    errors = []
    for kind in ("features", "limitations"):
        for entry in data.get(kind, []):
            rid = entry["id"]
            if rid in items:
                errors.append(f"duplicate registry id '{rid}' (appears in both/multiple kind lists)")
                continue
            items[rid] = {"id": rid, "kind": kind[:-1], "title": entry["title"], "source": entry.get("source", "")}
    return items, errors


def find_doc_pages():
    return sorted(p for p in DOCS_DIR.rglob("*.md") if p.resolve() != COVERAGE_PAGE_PATH.resolve())


def scan_pages(registry):
    """Returns (claims, errors). claims: {id: [{page, anchor, quality}, ...]}"""
    claims = {rid: [] for rid in registry}
    errors = []
    for page_path in find_doc_pages():
        text = page_path.read_text()
        meta, body = split_front_matter(text)
        if not meta or "doc_coverage" not in meta:
            continue
        rel = page_path.relative_to(DOCS_DIR).as_posix()
        headings = {slugify(text) for _, text in HEADING_RE.findall(body)}
        for entry in meta["doc_coverage"]:
            rid = entry.get("id")
            quality = entry.get("quality")
            anchor = entry.get("anchor")
            if rid not in registry:
                errors.append(f"{rel}: doc_coverage references unknown id '{rid}' (not in coverage_registry.yml)")
                continue
            if quality not in QUALITY_LEVELS:
                errors.append(f"{rel}: doc_coverage id '{rid}' has invalid quality '{quality}' (expected one of {QUALITY_LEVELS})")
                continue
            if anchor and anchor not in headings:
                errors.append(f"{rel}: doc_coverage id '{rid}' has anchor '#{anchor}' which matches no heading in this page")
                continue
            claims[rid].append({"page": rel, "anchor": anchor, "quality": quality})
    return claims, errors


def build_report(registry, claims):
    best_rank = {"complete": 2, "partial": 1, "missing": 0}
    items = []
    for rid, meta in registry.items():
        page_claims = claims.get(rid, [])
        if page_claims:
            quality = max((c["quality"] for c in page_claims), key=lambda q: best_rank[q])
        else:
            quality = "missing"
        items.append({
            "id": rid,
            "kind": meta["kind"],
            "title": meta["title"],
            "quality": quality,
            "locations": [{"page": c["page"], "anchor": c["anchor"]} for c in page_claims],
        })
    items.sort(key=lambda it: (it["kind"], it["id"]))

    def totals_for(kind):
        subset = [it for it in items if kind is None or it["kind"] == kind]
        return {
            "items": len(subset),
            "complete": sum(1 for it in subset if it["quality"] == "complete"),
            "partial": sum(1 for it in subset if it["quality"] == "partial"),
            "missing": sum(1 for it in subset if it["quality"] == "missing"),
        }

    return {
        "totals": {"overall": totals_for(None), "feature": totals_for("feature"), "limitation": totals_for("limitation")},
        "items": items,
    }


DEFAULT_COVERAGE_BODY = """# Documentation Coverage — Features & Limitations

Programmatically generated from every page's own `doc_coverage:` front
matter, cross-referenced against `scripts/coverage_registry.yml`. Run
`uv run src/pptxdiff/docs-site/scripts/sync_doc_coverage.py --write` to
regenerate after adding or changing coverage on any page; `--check` verifies
this page is still in sync (see the script's own docstring for exactly what
that checks).

{{ render_coverage_summary() }}

## Features

{{ render_coverage_table(kind="feature") }}

## Limitations

{{ render_coverage_table(kind="limitation") }}
"""


def write_coverage_page(report):
    if COVERAGE_PAGE_PATH.exists():
        _, body = split_front_matter(COVERAGE_PAGE_PATH.read_text())
    else:
        body = DEFAULT_COVERAGE_BODY
    meta = {
        "title": "Documentation Coverage",
        "render_macros": True,
        "coverage_summary": {
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "totals": report["totals"],
            "items": report["items"],
        },
    }
    COVERAGE_PAGE_PATH.write_text(dump_front_matter(meta, body))


def report_matches_disk(report):
    if not COVERAGE_PAGE_PATH.exists():
        return False, "documentation-coverage.md does not exist yet"
    meta, _ = split_front_matter(COVERAGE_PAGE_PATH.read_text())
    if not meta or "coverage_summary" not in meta:
        return False, "documentation-coverage.md has no coverage_summary front matter"
    on_disk = meta["coverage_summary"]
    if on_disk.get("totals") != report["totals"]:
        return False, "totals on disk don't match a fresh scan"
    if on_disk.get("items") != report["items"]:
        return False, "items on disk don't match a fresh scan"
    return True, None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="verify the coverage page is up to date and structurally valid; exit 1 if not")
    mode.add_argument("--write", action="store_true", help="regenerate documentation-coverage.md's front matter from a fresh scan")
    args = ap.parse_args()

    registry, registry_errors = load_registry()
    claims, scan_errors = scan_pages(registry)
    errors = registry_errors + scan_errors
    report = build_report(registry, claims)

    t = report["totals"]["overall"]
    print(f"Documentation coverage: {t['complete']} complete, {t['partial']} partial, {t['missing']} missing (of {t['items']})")

    if errors:
        print("\nStructural problems found:")
        for e in errors:
            print(f"  - {e}")

    if args.write:
        if errors:
            print("\nFAILED: not writing documentation-coverage.md while structural problems exist above.")
            sys.exit(1)
        write_coverage_page(report)
        print(f"\nWrote {COVERAGE_PAGE_PATH.relative_to(DOCS_SITE_DIR)}")
        sys.exit(0)

    # --check
    ok, reason = (True, None) if errors else report_matches_disk(report)
    if errors or not ok:
        if not errors:
            print(f"\nSTALE: {reason} -- run --write to regenerate.")
        print("\nCHECK: FAIL")
        sys.exit(1)
    print("\nCHECK: PASS (documentation-coverage.md is in sync and structurally valid)")
    sys.exit(0)


if __name__ == "__main__":
    main()
