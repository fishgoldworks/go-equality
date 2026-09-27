"""Run actual-browser regressions against both distribution bundles.

Usage: python scripts/test-browser.py [--browser chromium|firefox|webkit|all]
       [--executable /path/to/browser] [--bundle-dir dist] [--output results.json]
Install optional tooling from test/browser/requirements.txt and use
`python -m playwright install chromium` (or the requested browser) first.
"""
from __future__ import annotations

import argparse
from importlib.metadata import version
import json
import os
from pathlib import Path
import platform
import shutil
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", choices=("chromium", "firefox", "webkit", "all"), default="chromium")
    parser.add_argument("--executable", help="Optional explicit executable; requires a single browser.")
    parser.add_argument("--bundle-dir", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.browser == "all" and args.executable:
        parser.error("--executable cannot be combined with --browser all")
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        parser.exit(1, "Install browser tooling: python -m pip install -r test/browser/requirements.txt\nNo browser tests were run.\n")

    root = Path(__file__).resolve().parent.parent
    bundle_dir = (args.bundle_dir or root / "dist").resolve()
    suite = (root / "test" / "browser" / "suite.js").read_text(encoding="utf-8")
    browsers = ("chromium", "firefox", "webkit") if args.browser == "all" else (args.browser,)
    reports = []
    failed = False
    try:
        with sync_playwright() as pw:
            for name in browsers:
                browser_type = getattr(pw, name)
                executable = args.executable or (os.environ.get("CHROMIUM_PATH") if name == "chromium" else None)
                if name == "chromium" and not executable and not Path(browser_type.executable_path).is_file():
                    executable = shutil.which("chromium") or shutil.which("google-chrome")
                options = {"headless": True, "timeout": 30000}
                if executable:
                    options["executable_path"] = executable
                if name == "chromium":
                    options["args"] = ["--disable-dev-shm-usage", "--disable-gpu"]
                browser = browser_type.launch(**options)
                try:
                    for filename in ("go-equality.js", "go-equality.min.js"):
                        context = browser.new_context()
                        try:
                            # No test needs an external request or a file-URL exemption.
                            context.route("**/*", lambda route: route.abort())
                            page = context.new_page()
                            page.set_default_timeout(15000)
                            page.set_content("<!doctype html><html><body></body></html>")
                            page.add_script_tag(content=(bundle_dir / filename).read_text(encoding="utf-8"))
                            page.add_script_tag(content=suite)
                            report = page.evaluate("runGoEqualityBrowserTests(Equality)")
                            if not isinstance(report, dict) or not report.get("cases"):
                                raise RuntimeError("Browser suite returned no test cases.")
                            report.update(browser=name, browserVersion=browser.version, playwrightVersion=version("playwright"), python=platform.python_version(), bundle=filename)
                            report["passed"] = sum(case.get("pass") is True for case in report["cases"])
                            report["failed"] = len(report["cases"]) - report["passed"]
                            failed |= report["failed"] != 0
                            reports.append(report)
                            print(f'{name} {browser.version}, {filename}: {report["passed"]}/{len(report["cases"])} passed; {report["failed"]} failed', flush=True)
                            for case in report["cases"]:
                                if not case.get("pass"):
                                    print(json.dumps(case), file=sys.stderr)
                        finally:
                            context.close()
                finally:
                    browser.close()
    except Exception as error:
        failed = True
        print(f"Browser verification failed: {error}\nMissing browsers are failures, not skips. Install with: python -m playwright install {args.browser if args.browser != 'all' else 'chromium firefox webkit'}", file=sys.stderr)
        reports.append({"harnessError": str(error), "failed": 1})
    finally:
        if args.output:
            args.output.write_text(json.dumps(reports, indent=2) + "\n", encoding="utf-8")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
