'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'library-docs-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  for (const name of ['scripts', 'src', 'package.json', 'index.js', 'README.md', 'docs']) {
    if (fs.existsSync(path.join(root, name))) {
      fs.cpSync(path.join(root, name), path.join(temp, name), { recursive: true });
    }
  }
  return temp;
}
function run(root, ...args) {
  return spawnSync(process.execPath, ['scripts/docs.js', ...args], { cwd: root, encoding: 'utf8' });
}
function snapshot(root) {
  const files = fs.readdirSync(root, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
  return new Map(
    files.map((entry) => {
      const file = path.join(entry.parentPath, entry.name);
      return [path.relative(root, file), fs.readFileSync(file).toString('base64')];
    })
  );
}

test('documentation check rejects stale output without changing files', (t) => {
  const root = fixture(t);
  fs.appendFileSync(path.join(root, 'README.md'), '\nStale generated content.\n');
  const before = snapshot(root);
  const result = run(root, '--check');
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /README\.md|stale/i);
  assert.deepEqual(snapshot(root), before);
  assert.equal(run(root).status, 0);
  assert.equal(run(root, '--check').status, 0);
});

test('documentation CLI rejects unknown options without changing files', (t) => {
  const root = fixture(t);
  const before = snapshot(root);
  const result = run(root, '--unknown');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /argument|option|usage/i);
  assert.deepEqual(snapshot(root), before);
});
