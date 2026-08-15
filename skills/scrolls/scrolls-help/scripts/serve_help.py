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


# Every fenced block in HELP.md is a shell command example (a slash-command,
# its flags, and sometimes a trailing "# comment"), never general-purpose
# source — so a small hand-rolled tokenizer covers it, in the spirit of a
# Pygments/pymdown-extensions lexer (https://facelessuser.github.io/pymdown-extensions/)
# without pulling in that dependency. Runs on the RAW (unescaped) line so it
# can escape literal text and matched tokens separately — no risk of a later
# regex pass matching inside an already-inserted <span> from an earlier one.
SHELL_TOKEN_RE = re.compile(
    r"(?P<comment>#.*$)"
    r"|(?P<cmd>(?<![\w/])/[a-zA-Z][\w-]*)"
    r"|(?P<flag>(?<!\w)(?:--[a-zA-Z][\w-]*|-[a-zA-Z]))",
    re.MULTILINE,
)


def highlight_shell(code: str) -> str:
    out = []
    pos = 0
    for m in SHELL_TOKEN_RE.finditer(code):
        out.append(_html.escape(code[pos:m.start()]))
        token_html = _html.escape(m.group(0))
        out.append(f'<span class="tok-{m.lastgroup}">{token_html}</span>')
        pos = m.end()
    out.append(_html.escape(code[pos:]))
    return "".join(out)


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
            out.append("<pre><code>" + highlight_shell("\n".join(code_lines)) + "</code></pre>")
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


# A plain placeholder + str.replace (not .format()) — the inline <script>
# below is full of braces, and escaping every one of them for .format()
# would be a maintenance trap.
PAGE_TEMPLATE = """<!doctype html>
<html lang="en" class="colorize">
<head>
<meta charset="utf-8">
<title>Scrolls — Command Reference</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
/* Light values live on bare :root. The dark media query is guarded by
   :not([data-theme="light"]) so an explicit light choice can override the
   system preference; :root[data-theme="dark"] does the same in the other
   direction. This is what lets the toggle button below win either way,
   while a visitor who's never touched it still gets the system default.
   --tok-* are the code-block token colors — a small GitHub-syntax-inspired
   palette (in the spirit of a Pygments/pymdown-extensions theme:
   https://facelessuser.github.io/pymdown-extensions/) with its own light
   and dark values, following the exact same three-layer pattern. */
:root {
  color-scheme: light dark;
  --fg: #1a1a1a; --bg: #ffffff; --muted: #6b7280; --border: #e5e7eb;
  --code-bg: #f3f4f6; --link: #2563eb;
  --tok-cmd: #6f42c1; --tok-flag: #d73a49;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --fg: #e5e7eb; --bg: #0f1115; --muted: #9ca3af; --border: #2a2e37; --code-bg: #1a1d24; --link: #60a5fa;
    --tok-cmd: #d2a8ff; --tok-flag: #ff7b72;
  }
}
:root[data-theme="dark"] {
  --fg: #e5e7eb; --bg: #0f1115; --muted: #9ca3af; --border: #2a2e37; --code-bg: #1a1d24; --link: #60a5fa;
  --tok-cmd: #d2a8ff; --tok-flag: #ff7b72;
}
body {
  margin: 0; padding: 2.5rem 1.25rem 5rem; background: var(--bg); color: var(--fg);
  font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}
main { max-width: 780px; margin: 0 auto; }
h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
h2 { font-size: 1.25rem; margin-top: 2.5rem; padding-bottom: 0.4rem; border-bottom: 1px solid var(--border); }
h3 { font-size: 1.05rem; margin-top: 1.5rem; }
code { background: var(--code-bg); padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
pre { background: var(--code-bg); padding: 0.9rem 1rem; border-radius: 8px; overflow-x: auto; }
pre code { background: none; padding: 0; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.92rem; }
th, td { border: 1px solid var(--border); padding: 0.5rem 0.65rem; text-align: left; vertical-align: top; }
th { background: var(--code-bg); }
ul { padding-left: 1.4rem; }
li { margin: 0.3rem 0; }
hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
a { color: var(--link); }
/* Token colors only apply with the "colorize" class on <html> (the default,
   set server-side so there's no flash of uncolored code on first paint);
   toggling it off falls every token back to plain inherited text. */
.tok-cmd, .tok-flag, .tok-comment { color: inherit; font-weight: inherit; font-style: inherit; }
html.colorize .tok-comment { color: var(--muted); font-style: italic; }
html.colorize .tok-cmd { color: var(--tok-cmd); font-weight: 600; }
html.colorize .tok-flag { color: var(--tok-flag); }
#toolbar { position: fixed; top: 1rem; right: 1rem; z-index: 1; display: flex; gap: 0.5rem; }
#toolbar button {
  padding: 0.4rem 0.8rem; border-radius: 999px; border: 1px solid var(--border);
  background: var(--code-bg); color: var(--fg); font-size: 0.85rem; line-height: 1.2;
  cursor: pointer;
}
#toolbar button:hover { opacity: 0.85; }
</style>
</head>
<body>
<div id="toolbar">
  <button id="colorize-toggle" type="button" aria-label="Toggle code colorization" title="Toggle code colorization">···</button>
  <button id="theme-toggle" type="button" aria-label="Toggle light/dark theme" title="Toggle light/dark theme">···</button>
</div>
<main>
__BODY__
</main>
<script>
(function () {
  var THEME_KEY = "scrolls-help-theme";
  var COLOR_KEY = "scrolls-help-colorize";
  var root = document.documentElement;
  var themeBtn = document.getElementById("theme-toggle");
  var colorBtn = document.getElementById("colorize-toggle");

  var storedTheme = localStorage.getItem(THEME_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    root.setAttribute("data-theme", storedTheme);
  }
  // The class defaults to present (colorized) in the served HTML; only
  // override it if the visitor previously chose to turn it off.
  if (localStorage.getItem(COLOR_KEY) === "off") {
    root.classList.remove("colorize");
  }

  function effectiveTheme() {
    var explicit = root.getAttribute("data-theme");
    if (explicit) return explicit;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function renderTheme() {
    themeBtn.textContent = effectiveTheme() === "dark" ? "☀️ Light" : "🌙 Dark";
  }

  function renderColorize() {
    colorBtn.textContent = root.classList.contains("colorize") ? "⬜ Plain" : "🎨 Colorize";
  }

  themeBtn.addEventListener("click", function () {
    var next = effectiveTheme() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    renderTheme();
  });

  colorBtn.addEventListener("click", function () {
    var next = !root.classList.contains("colorize");
    root.classList.toggle("colorize", next);
    localStorage.setItem(COLOR_KEY, next ? "on" : "off");
    renderColorize();
  });

  renderTheme();
  renderColorize();
})();
</script>
</body>
</html>
"""


def main() -> None:
    with open(HELP_MD, encoding="utf-8") as f:
        md = f.read()
    page = PAGE_TEMPLATE.replace("__BODY__", render_markdown(md)).encode("utf-8")

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
