"""Protect browser verification inputs from report-output collisions.

Runs the real command in temporary copies. A deliberately failing browser launcher
makes output handling testable without installing any browser or Playwright.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest


class ReportInputTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="go-equality-browser-inputs-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / "scripts").mkdir()
        self.harness = self.root / "scripts/test-browser.py"
        source_root = Path(__file__).resolve().parent.parent
        shutil.copy2(source_root / "scripts/test-browser.py", self.harness)
        shutil.copy2(source_root / "scripts/browser-examples.js", self.root / "scripts/browser-examples.js")
        (self.root / "test/helpers").mkdir(parents=True)
        for filename in ("documentation.js", "instrumentExample.js"):
            shutil.copy2(source_root / "test/helpers" / filename, self.root / "test/helpers" / filename)
        (self.root / "test/browser").mkdir(parents=True)
        self.suite = self.root / "test/browser/suite.js"
        self.suite.write_text("// Input preserved by this test.\n", encoding="utf-8")
        self.bundles = self.root / "bundles"
        self.bundles.mkdir()
        self.tarball = self.root / "candidate.tgz"
        with tarfile.open(self.tarball, "w:gz") as archive:
            for filename in ("go-equality.js", "go-equality.min.js"):
                content = b"// Fixture never executes; launcher fails first.\n"
                (self.bundles / filename).write_bytes(content)
                info = tarfile.TarInfo("package/dist/" + filename)
                info.size = len(content)
                archive.addfile(info, io.BytesIO(content))
        self.readme = '<script src="https://cdn.jsdelivr.net/npm/go-equality@2.0.0/dist/go-equality.min.js"></script>\n<script>Equality.isEqual(1, 1); // => true\n</script>'
        self.write_candidate()
        self.digest = Path(str(self.tarball) + ".sha256")
        self.digest.write_text(hashlib.sha256(self.tarball.read_bytes()).hexdigest() + "  candidate.tgz\n")
        fake = self.root / "imports/playwright"
        fake.mkdir(parents=True)
        (fake / "__init__.py").write_text("")
        (fake / "sync_api.py").write_text(
            "def sync_playwright():\n    raise RuntimeError('browser launch sentinel')\n"
        )
        self.env = {**os.environ, "PYTHONPATH": str(fake.parent), "NODE_PATH": str(source_root / "node_modules")}

    def write_candidate(self, readme=None):
        with tarfile.open(self.tarball, "w:gz") as archive:
            files = {"package/dist/" + p.name: p.read_bytes() for p in self.bundles.iterdir()}
            files["package/package.json"] = b'{"name":"go-equality","version":"2.0.0"}'
            files["package/README.md"] = ("```html\n" + (self.readme if readme is None else readme) + "\n```\n").encode()
            for name, content in files.items():
                info = tarfile.TarInfo(name)
                info.size = len(content)
                archive.addfile(info, io.BytesIO(content))
        if hasattr(self, "digest"):
            self.digest.write_text(hashlib.sha256(self.tarball.read_bytes()).hexdigest() + "  candidate.tgz\n")

    def test_wrong_version_example_fails_before_browser_launch(self):
        self.write_candidate(self.readme.replace("@2.0.0/", "@1.0.4/"))
        result = self.invoke(self.root / "report.json")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Browser example must use the candidate CDN URL", result.stderr)
        self.assertNotIn("browser launch sentinel", result.stderr)

    def test_unchecked_example_fails_before_browser_launch(self):
        self.write_candidate(self.readme.replace("// => true", ""))
        result = self.invoke(self.root / "report.json")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Browser example must contain result assertions", result.stderr)
        self.assertNotIn("browser launch sentinel", result.stderr)

    def invoke(self, output, source=None):
        return subprocess.run(
            [sys.executable, str(self.harness),
             *(source or ["--tarball", str(self.tarball)]), "--output", str(output)],
            cwd=self.root, env=self.env, capture_output=True, text=True, timeout=15
        )

    def assert_rejected(self, output, source=None):
        protected = [self.harness, self.tarball, self.digest, self.suite, *self.bundles.iterdir()]
        before = {file: file.read_bytes() for file in protected}
        result = self.invoke(output, source)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Report output must not overwrite a verification input", result.stderr)
        self.assertNotIn("browser launch sentinel", result.stderr)
        for file, content in before.items():
            self.assertEqual(content, file.read_bytes(), str(file))

    def test_tarball_cannot_be_replaced_by_json(self):
        self.assert_rejected(self.tarball)

    def test_digest_cannot_be_replaced_by_json(self):
        self.assert_rejected(self.digest)

    def test_relative_spelling_cannot_bypass_protection(self):
        self.assert_rejected("bundles/../candidate.tgz")

    def test_bundle_inputs_are_protected(self):
        for filename in ("go-equality.js", "go-equality.min.js"):
            with self.subTest(filename=filename):
                self.assert_rejected(self.bundles / filename, ["--bundle-dir", str(self.bundles)])

    def test_suite_is_protected(self):
        self.assert_rejected(self.suite)

    def test_harness_is_protected_for_each_input_source(self):
        for source in (None, ["--bundle-dir", str(self.bundles)]):
            with self.subTest(source=source):
                self.assert_rejected(self.harness, source)

    def test_relative_spelling_cannot_overwrite_harness(self):
        self.assert_rejected("scripts/../scripts/test-browser.py")

    def test_symlink_output_cannot_alias_input(self):
        for source in (self.tarball, self.harness):
            with self.subTest(source=source.name):
                output = self.root / (source.name + ".report.json")
                try:
                    output.symlink_to(source)
                except OSError as error:
                    self.skipTest("Symlink creation unavailable: " + str(error))
                self.assert_rejected(output)

    def test_hardlink_output_cannot_alias_input(self):
        for source in (self.tarball, self.harness):
            with self.subTest(source=source.name):
                output = self.root / (source.name + ".report.json")
                try:
                    os.link(source, output)
                except OSError as error:
                    self.skipTest("Hardlink creation unavailable: " + str(error))
                self.assert_rejected(output)

    def test_distinct_report_still_records_browser_failure(self):
        output = self.root / "report.json"
        before = self.tarball.read_bytes(), self.digest.read_bytes()
        result = self.invoke(output)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("browser launch sentinel", result.stderr)
        self.assertIn("browser launch sentinel", json.loads(output.read_text())[0]["harnessError"])
        self.assertEqual(before, (self.tarball.read_bytes(), self.digest.read_bytes()))


if __name__ == "__main__":
    unittest.main()
