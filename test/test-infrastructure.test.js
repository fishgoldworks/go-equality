'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { graphEqual, perfectMatching } = require('./helpers/oracle');
const helper = path.join(__dirname, 'helpers/api.js');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-equality-test-infra-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const entry = path.join(root, 'api.js');
  fs.writeFileSync(
    entry,
    `
    if (typeof module === 'object') {
      module.exports = { selected: 'commonjs' };
    } else if (typeof define === 'function') {
      define([], () => ({ selected: 'amd' }));
    } else {
      this.Equality = { selected: 'global' };
    }
  `
  );
  return { root, entry };
}

function runnerEnvironment() {
  const env = { ...process.env };
  // An independent test process must not inherit Node's internal nesting marker.
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function select(entry, format) {
  const env = { ...process.env, EQUALITY_ENTRY: entry };
  delete env.EQUALITY_FORMAT;
  delete env.EQUALITY_WITHOUT_BUFFER;
  if (format !== undefined) {
    env.EQUALITY_FORMAT = format;
  }
  const result = spawnSync(
    process.execPath,
    ['-e', `console.log(JSON.stringify(require(${JSON.stringify(helper)})))`],
    { env, encoding: 'utf8', timeout: 10000 }
  );
  assert.ifError(result.error);
  return result;
}

for (const format of [undefined, 'commonjs', 'global', 'amd']) {
  test(`API selection uses the requested loader: ${format ?? 'default'}`, (t) => {
    const { entry } = fixture(t);
    const result = select(entry, format);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { selected: format ?? 'commonjs' });
  });
}
for (const format of ['', 'globla', 'esm']) {
  test(`API selection rejects an unsupported explicit format: ${JSON.stringify(format)}`, (t) => {
    const { entry } = fixture(t);
    const result = select(entry, format);
    assert.notEqual(result.status, 0, 'Unsupported formats must not become a CommonJS run');
    assert.match(result.stderr, /Unsupported EQUALITY_FORMAT/);
    assert.equal(result.stdout, '');
  });
}
for (const entry of ['', '   ']) {
  test(`API selection rejects an empty explicit entry: ${JSON.stringify(entry)}`, () => {
    const result = select(entry);
    assert.notEqual(result.status, 0, 'An explicit empty entry must not select the checkout');
    assert.match(result.stderr, /EQUALITY_ENTRY must name/);
  });
}

test('an explicitly missing API entry is never replaced by checkout code', (t) => {
  const { root } = fixture(t);
  const result = select(path.join(root, 'missing.js'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing\.js/);
});

test('main runner forwards Node options before JS test paths and excludes compile-only files', (t) => {
  const { root } = fixture(t);
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.mkdirSync(path.join(root, 'test'));
  fs.copyFileSync(path.join(__dirname, '../scripts/test.js'), path.join(root, 'scripts/test.js'));
  fs.writeFileSync(
    path.join(root, 'test/selected.test.js'),
    `
    const test = require('node:test');
    test('selected-control', () => {});
    test('not-selected', () => { throw Error('filter failed'); });
  `
  );
  fs.writeFileSync(path.join(root, 'test/not-runtime.ts'), 'THIS IS NOT EXECUTABLE JAVASCRIPT');
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'scripts/test.js'), '--test-name-pattern=selected-control'],
    { cwd: os.tmpdir(), env: runnerEnvironment(), encoding: 'utf8', timeout: 10000 }
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /selected-control/);
  assert.doesNotMatch(result.stdout + result.stderr, /filter failed|SyntaxError/);
});

test('main runner propagates a real child test failure instead of reporting success', (t) => {
  const { root } = fixture(t);
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.mkdirSync(path.join(root, 'test'));
  fs.copyFileSync(path.join(__dirname, '../scripts/test.js'), path.join(root, 'scripts/test.js'));
  fs.writeFileSync(
    path.join(root, 'test/fails.test.js'),
    `
    require('node:test')('failure-control', () => { throw Error('intended test failure'); });
  `
  );
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/test.js')], {
    env: runnerEnvironment(),
    encoding: 'utf8',
    timeout: 10000
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /intended test failure/);
});

test('reference assignment search rejects contention and accepts a reassignment', () => {
  assert.equal(perfectMatching([]), true);
  assert.equal(
    perfectMatching([
      [true, false],
      [true, false]
    ]),
    false
  );
  assert.equal(
    perfectMatching([
      [true, true],
      [true, false]
    ]),
    true
  );
});

test('reference graph oracle agrees with manually specified cyclic and false controls', () => {
  const left = { value: 1 };
  const equal = { value: 1 };
  const loose = { value: '1' };
  left.next = left;
  equal.next = equal;
  loose.next = loose;
  for (const mode of ['isEqual', 'isLooseEqual', 'isStrictEqual']) {
    assert.equal(graphEqual(left, equal, mode), true);
    assert.equal(graphEqual(left, { value: 1, next: null }, mode), false);
    assert.equal(graphEqual(left, loose, mode), mode === 'isLooseEqual');
  }
});
