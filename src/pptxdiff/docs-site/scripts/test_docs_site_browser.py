#!/usr/bin/env python3
"""Browser regression checks for the MkDocs documentation site.

Start the docs server first:

    uv run --group docs mkdocs serve -f src/pptxdiff/docs-site/mkdocs.yml -a 127.0.0.1:8123

Then run:

    uv run --with playwright python src/pptxdiff/docs-site/scripts/test_docs_site_browser.py
"""

import os
import re

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.environ.get("PPTXDIFF_DOCS_BASE_URL", "http://127.0.0.1:8123/pptxdiff/")
DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path=os.environ.get("PPTXDIFF_CHROME_PATH", DEFAULT_CHROME),
        )
        page = browser.new_page()
        console_errors = []
        local_http_errors = []

        def record_console_error(msg):
            text = msg.text
            if msg.type == "error" and not ("resource" in text.lower() and "404" in text):
                console_errors.append(text)

        def record_http_error(res):
            if res.status >= 400 and res.url.startswith(BASE_URL):
                local_http_errors.append(f"{res.status} {res.url}")

        page.on("console", record_console_error)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))
        page.on("response", record_http_error)

        page.goto(BASE_URL, wait_until="domcontentloaded")
        expect(page).to_have_title(re.compile("pptxdiff", re.IGNORECASE))

        cli_api_link = page.locator('a[href="headless-cli-api/"]').first
        expect(cli_api_link).to_be_visible()
        cli_api_link.click()
        page.wait_for_load_state("domcontentloaded")

        expect(page.locator("h1")).to_contain_text("Headless CLI & Web API")
        expect(page.get_by_role("heading", name="@pptxdiff/cli")).to_be_visible()
        expect(page.get_by_role("heading", name="Git Integration")).to_be_visible()
        expect(page.get_by_role("heading", name="@pptxdiff/server")).to_be_visible()
        expect(page.get_by_role("heading", name="API Discovery")).to_be_visible()
        expect(page.get_by_text("GET /openapi.json").first).to_be_visible()
        expect(page.get_by_text("GET /docs").first).to_be_visible()

        page.goto(BASE_URL + "documentation-coverage/", wait_until="domcontentloaded")
        expect(page.locator("h1")).to_contain_text("Documentation Coverage")
        for text in [
            "Headless CLI (@pptxdiff/cli)",
            "Git integration for .pptx files",
            "Web API (@pptxdiff/server)",
            "OpenAPI docs endpoints",
        ]:
            expect(page.get_by_text(text).first).to_be_visible()

        page.goto(BASE_URL + "limitations/", wait_until="domcontentloaded")
        expect(page.locator("h1")).to_contain_text("Known limitations")
        expect(page.get_by_role("heading", name="Headless CLI/API Notes")).to_be_visible()
        expect(page.get_by_text("@pptxdiff/server serves /openapi.json locally")).to_be_visible()

        browser.close()

        if console_errors or local_http_errors:
            details = []
            if console_errors:
                details.append("Browser console/page errors:\n" + "\n".join(console_errors))
            if local_http_errors:
                details.append("Local HTTP errors:\n" + "\n".join(local_http_errors))
            raise AssertionError("\n\n".join(details))


if __name__ == "__main__":
    main()
