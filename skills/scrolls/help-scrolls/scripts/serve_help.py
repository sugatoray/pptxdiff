#!/usr/bin/env python3
"""Renders references/HELP.md to a small styled HTML page and serves it on
an OS-assigned localhost port, printing the URL and best-effort opening the
default browser. Stdlib only — no markdown package dependency, since the
scrolls skills otherwise avoid non-stdlib requirements.

Binds to 127.0.0.1 only (never all interfaces) — this is a local reference
viewer, not something meant to be reachable from the network.

Prints the URL as the first line of output, then blocks serving requests
until killed. Meant to be launched in the background by open_help.sh, which
waits for that first line rather than guessing a fixed startup delay.
"""
import html as _html
import http.server
import os
import re
import socketserver
import sys
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
HELP_MD = os.path.join(HERE, "..", "references", "HELP.md")


def inline(text: str) -> str:
    text = _html.escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"`([^`]+?)`", r"<code>\1</code>", text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    return text


def render_markdown(md: str) -> str:
    """Small hand-rolled converter for the specific subset of markdown
    HELP.md actually uses: headings, bold, inline/fenced code, tables,
    bullet lists, hr, and paragraphs. Not a general-purpose parser."""
    lines = md.splitlines()
    out = []
    i = 0
    in_list = False

    def close_list():
        nonlocal in_list
        if in_list:
            out.append("</ul>")
            in_list = False

    while i < len(lines):
        line = lines[i]

        if line.strip().startswith("```"):
            close_list()
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            out.append("<pre><code>" + _html.escape("\n".join(code_lines)) + "</code></pre>")
            i += 1
            continue

        if line.strip().startswith("|") and i + 1 < len(lines) and re.match(r"^\s*\|[\s:|-]+\|\s*$", lines[i + 1]):
            close_list()
            header = [c.strip() for c in line.strip().strip("|").split("|")]
            out.append("<table><thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in header) + "</tr></thead><tbody>")
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                row = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                out.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in row) + "</tr>")
                i += 1
            out.append("</tbody></table>")
            continue

        m = re.match(r"^(#{1,3})\s+(.*)", line)
        if m:
            close_list()
            level = len(m.group(1))
            out.append(f"<h{level}>{inline(m.group(2))}</h{level}>")
            i += 1
            continue

        if re.match(r"^-{3,}$", line.strip()):
            close_list()
            out.append("<hr>")
            i += 1
            continue

        m = re.match(r"^-\s+(.*)", line)
        if m:
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{inline(m.group(1))}</li>")
            i += 1
            continue

        if not line.strip():
            close_list()
            i += 1
            continue

        close_list()
        para = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not lines[i].lstrip().startswith(("#", "- ", "|", "```")):
            para.append(lines[i])
            i += 1
        out.append("<p>" + inline(" ".join(para)) + "</p>")

    close_list()
    return "\n".join(out)


PAGE_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Scrolls — Command Reference</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root {{
  color-scheme: light dark;
  --fg: #1a1a1a; --bg: #ffffff; --muted: #6b7280; --border: #e5e7eb;
  --code-bg: #f3f4f6; --link: #2563eb;
}}
@media (prefers-color-scheme: dark) {{
  :root {{ --fg: #e5e7eb; --bg: #0f1115; --muted: #9ca3af; --border: #2a2e37; --code-bg: #1a1d24; --link: #60a5fa; }}
}}
body {{
  margin: 0; padding: 2.5rem 1.25rem 5rem; background: var(--bg); color: var(--fg);
  font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}}
main {{ max-width: 780px; margin: 0 auto; }}
h1 {{ font-size: 1.75rem; margin-bottom: 0.25rem; }}
h2 {{ font-size: 1.25rem; margin-top: 2.5rem; padding-bottom: 0.4rem; border-bottom: 1px solid var(--border); }}
h3 {{ font-size: 1.05rem; margin-top: 1.5rem; }}
code {{ background: var(--code-bg); padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }}
pre {{ background: var(--code-bg); padding: 0.9rem 1rem; border-radius: 8px; overflow-x: auto; }}
pre code {{ background: none; padding: 0; }}
table {{ border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.92rem; }}
th, td {{ border: 1px solid var(--border); padding: 0.5rem 0.65rem; text-align: left; vertical-align: top; }}
th {{ background: var(--code-bg); }}
ul {{ padding-left: 1.4rem; }}
li {{ margin: 0.3rem 0; }}
hr {{ border: none; border-top: 1px solid var(--border); margin: 2rem 0; }}
a {{ color: var(--link); }}
</style>
</head>
<body>
<main>
{body}
</main>
</body>
</html>
"""


def main() -> None:
    with open(HELP_MD, encoding="utf-8") as f:
        md = f.read()
    page = PAGE_TEMPLATE.format(body=render_markdown(md)).encode("utf-8")

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(page)))
            self.end_headers()
            self.wfile.write(page)

        def log_message(self, *args):
            pass  # keep stdout clean — the URL line is what the launcher waits for

    class Server(socketserver.TCPServer):
        allow_reuse_address = True

    with Server(("127.0.0.1", 0), Handler) as httpd:
        port = httpd.server_address[1]
        url = f"http://127.0.0.1:{port}/"
        print(url, flush=True)
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    sys.exit(main())
