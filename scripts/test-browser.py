"""Run actual-browser regressions against both distribution bundles.

Usage: python scripts/test-browser.py [--browser chromium|firefox|webkit|all]
       [--executable /path/to/browser] [--tarball candidate.tgz | --bundle-dir package/dist]
       [--output results.json]
Release checks use --tarball; --bundle-dir is a checkout diagnostic.
Install optional tooling from test/browser/requirements.txt and use
`python -m playwright install chromium` (or the requested browser) first.
"""
from __future__ import annotations

import argparse
import hashlib
import io
from importlib.metadata import version
import json
import os
from pathlib import Path
import platform
import shutil
import sys
import tarfile


def check_output_path(output: Path | None, inputs: list[Path]) -> None:
    if output is None:
        return
    output = output.resolve()
    for source in inputs:
        source = source.resolve()
        if output == source or (output.exists() and source.exists() and output.samefile(source)):
            raise ValueError(f"Report output must not overwrite a verification input: {source}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", choices=("chromium", "firefox", "webkit", "all"), default="chromium")
    parser.add_argument("--executable", help="Optional explicit executable; requires a single browser.")
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--bundle-dir", type=Path)
    source.add_argument("--tarball", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.browser == "all" and args.executable:
        parser.error("--executable cannot be combined with --browser all")
    root = Path(__file__).resolve().parent.parent
    candidate = {}
    filenames = ("go-equality.js", "go-equality.min.js")
    suite_path = root / "test" / "browser" / "suite.js"
    try:
        inputs = [Path(__file__), suite_path]
        if args.tarball:
            inputs.extend([args.tarball, Path(str(args.tarball.resolve()) + ".sha256")])
        else:
            directory = args.bundle_dir or root / "package" / "dist"
            inputs.extend(directory / filename for filename in filenames)
        # Validate before reading inputs or starting browser work. Otherwise the
        # report's finally block can overwrite the very candidate it evaluated.
        check_output_path(args.output, inputs)
        if args.tarball:
            tarball = args.tarball.resolve()
            if not tarball.is_file():
                raise ValueError(f"Tarball does not exist: {tarball}")
            archive_bytes = tarball.read_bytes()
            digest = hashlib.sha256(archive_bytes).hexdigest()
            recorded = Path(str(tarball) + ".sha256")
            if recorded.exists() and recorded.read_text(encoding="utf-8").split()[0] != digest:
                raise ValueError(f"Tarball SHA-256 does not match its recorded digest: {tarball}")
            candidate = {"tarball": str(tarball), "sha256": digest}
            print(f"Tarball: {tarball}\nSHA-256: {digest}", flush=True)
            bundles = {}
            # Read only advertised regular files; never extract archive paths to disk.
            with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:gz") as archive:
                for filename in filenames:
                    member = archive.getmember("package/dist/" + filename)
                    if not member.isfile():
                        raise ValueError(f"Expected a regular bundle file: {filename}")
                    with archive.extractfile(member) as bundle:
                        bundles[filename] = bundle.read().decode("utf-8")
        else:
            bundle_dir = (args.bundle_dir or root / "package" / "dist").resolve()
            bundles = {filename: (bundle_dir / filename).read_text(encoding="utf-8") for filename in filenames}
    except (OSError, ValueError, KeyError, tarfile.TarError) as error:
        parser.exit(1, f"Browser verification failed: {error}\n")
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        parser.exit(1, "Install browser tooling: python -m pip install -r test/browser/requirements.txt\nNo browser tests were run.\n")

    suite = suite_path.read_text(encoding="utf-8")
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
                    for filename in filenames:
                        context = browser.new_context()
                        try:
                            # No test needs an external request or a file-URL exemption.
                            context.route("**/*", lambda route: route.abort())
                            page = context.new_page()
                            page.set_default_timeout(15000)
                            page.set_content("<!doctype html><html><body></body></html>")
                            page.add_script_tag(content=bundles[filename])
                            page.add_script_tag(content=suite)
                            report = page.evaluate("runGoEqualityBrowserTests(Equality)")
                            if not isinstance(report, dict) or not report.get("cases"):
                                raise RuntimeError("Browser suite returned no test cases.")
                            report.update(**candidate, browser=name, browserVersion=browser.version, playwrightVersion=version("playwright"), python=platform.python_version(), bundle=filename)
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
        reports.append({**candidate, "harnessError": str(error), "failed": 1})
    finally:
        if args.output:
            args.output.write_text(json.dumps(reports, indent=2) + "\n", encoding="utf-8")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
