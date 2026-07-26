"""mkdocs-macros-plugin hook (module_name: main in mkdocs.yml).

Defines the two Jinja macros documentation-coverage.md's body calls:
render_coverage_summary() and render_coverage_table(kind). Both read the
`coverage_summary` block from documentation-coverage.md's OWN front matter
directly off disk -- not via the plugin's page-context machinery -- since
that data is written once per doc-coverage sync run (see
scripts/sync_doc_coverage.py) and is the same regardless of which page
happens to be rendering; reading it straight from the file keeps this hook
from depending on exactly how/when mkdocs-macros-plugin exposes the
in-progress page object to a macro call.

render_by_default: false in mkdocs.yml means this whole module is inert for
every page except the one that opts in via `render_macros: true` in its own
front matter (documentation-coverage.md, currently the only one).
"""
import re
from pathlib import Path

import yaml

DOCS_DIR = Path(__file__).resolve().parent / "docs"
COVERAGE_PAGE = DOCS_DIR / "documentation-coverage.md"
FRONT_MATTER_RE = re.compile(r"\A---\n(.*?\n)---\n", re.DOTALL)

QUALITY_ICON = {
    "complete": ':material-check-circle:{ style="color:#3E7C5A" } Complete',
    "partial": ':material-alert-circle:{ style="color:#C9684A" } Partial',
    "missing": ':material-close-circle:{ style="color:#B23A2E" } Missing',
}


def _load_coverage_summary():
    if not COVERAGE_PAGE.exists():
        return {"totals": {}, "items": []}
    text = COVERAGE_PAGE.read_text()
    m = FRONT_MATTER_RE.match(text)
    if not m:
        return {"totals": {}, "items": []}
    meta = yaml.safe_load(m.group(1)) or {}
    return meta.get("coverage_summary", {"totals": {}, "items": []})


def _location_links(item):
    if not item["locations"]:
        return "—"
    links = []
    for loc in item["locations"]:
        href = loc["page"] + (f"#{loc['anchor']}" if loc.get("anchor") else "")
        label = loc["page"].rsplit("/", 1)[-1].removesuffix(".md")
        if loc.get("anchor"):
            label += f" § {loc['anchor'].replace('-', ' ')}"
        links.append(f"[{label}]({href})")
    return "<br>".join(links)


def define_env(env):
    @env.macro
    def render_coverage_summary():
        data = _load_coverage_summary()
        t = data.get("totals", {})
        overall = t.get("overall", {})
        rows = []
        for label, key in (("Features", "feature"), ("Limitations", "limitation")):
            k = t.get(key, {})
            rows.append(f"| {label} | {k.get('complete', 0)} | {k.get('partial', 0)} | {k.get('missing', 0)} | {k.get('items', 0)} |")
        generated_at = data.get("generated_at", "unknown")
        lines = [
            f'**{overall.get("items", 0)}** tracked items — **{overall.get("complete", 0)}** complete, '
            f'**{overall.get("partial", 0)}** partial, **{overall.get("missing", 0)}** not yet documented. '
            f"*(generated {generated_at})*",
            "",
            "| | Complete | Partial | Missing | Total |",
            "|---|---|---|---|---|",
        ] + rows
        return "\n".join(lines)

    @env.macro
    def render_coverage_table(kind):
        data = _load_coverage_summary()
        items = [it for it in data.get("items", []) if it["kind"] == kind]
        if not items:
            return "*(none registered)*"
        lines = ["| Item | Status | Documented at |", "|---|---|---|"]
        for it in items:
            status = QUALITY_ICON.get(it["quality"], it["quality"])
            lines.append(f"| {it['title']} | {status} | {_location_links(it)} |")
        return "\n".join(lines)
