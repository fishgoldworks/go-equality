'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const name = require('../package.json').name;

function fixture(run) {
  const prefix = path.join(os.tmpdir(), name + '-build-test-');
  const directory = fs.mkdtempSync(prefix);
  try {
    for (const file of [
      'package.json',
      'LICENSE.md',
      'README.md',
      'docs',
      'CHANGELOG.md',
      'index.js',
      'index.mjs',
      'index.d.ts',
      'src',
      'scripts'
    ]) {
      const source = path.join(root, file);
      if (fs.existsSync(source)) {
        fs.cpSync(source, path.join(directory, file), { recursive: true });
      }
    }
    fs.mkdirSync(path.join(directory, 'package'));
    fs.writeFileSync(path.join(directory, 'package', 'previous.txt'), 'previous distribution');
    fs.writeFileSync(
      path.join(directory, 'inject.cjs'),
      `
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const terser = require('terser');
const mode = process.env.GO_LIBRARY_TEST_FAILURE;
if (mode === 'replace-falsy') {
    // Observe, but do not handle, the exact falsy value escaping the build.
    process.on('uncaughtExceptionMonitor', error => {
        if (error === 0) console.error('Injected falsy replacement failure');
    });
}
if (mode === 'rollback-cleanup') {
    const fail = target => {
        if (path.dirname(target) === __dirname && path.basename(target).startsWith('.go-')) {
            throw Object.assign(Error('Injected cleanup failure at ' + target), {code:'EACCES'});
        }
    };
    const remove = fs.rmSync;
    fs.rmSync = (target, options) => { fail(target); return remove(target, options); };
    const removeAsync = fsp.rm;
    fsp.rm = async (target, options) => { fail(target); return removeAsync(target, options); };
}
if (mode === 'backup-cleanup') {
    const remove = fs.rmSync;
    fs.rmSync = (target, options) => {
        if (path.dirname(target) === __dirname && path.basename(target).startsWith('.go-equality-build-') && target.endsWith('-previous')) {
            remove(path.join(target, 'previous.txt'));
            throw Object.assign(Error('Injected backup cleanup failure at ' + target), {code:'EACCES'});
        }
        return remove(target, options);
    };
}
if (mode === 'minify' || mode === 'smoke') {
    const minify = text => {
        if (mode === 'minify') throw Error('Injected minifier failure');
        // Pass format checks so this failure occurs when the bundle is executed.
        const banner = text.slice(0, text.indexOf('*/') + 2);
        return {code:banner + '\\nthrow Error("Injected smoke failure");', map:'{}'};
    };
    terser.minify = async text => minify(text);
    terser.minify_sync = minify;
}
if (mode === 'replace' || mode === 'replace-falsy' || mode.startsWith('rollback')) {
    let failed = false;
    const fail = target => {
        if ((!failed || mode.startsWith('rollback')) && path.resolve(target) === path.join(__dirname, 'package')) {
            failed = true;
            if (mode === 'replace-falsy') throw 0;
            throw Object.assign(Error('Injected replacement failure'), {code:'EACCES'});
        }
    };
    const rename = fs.renameSync;
    fs.renameSync = (from, to) => { fail(to); return rename(from, to); };
    const renameAsync = fsp.rename;
    fsp.rename = async (from, to) => { fail(to); return renameAsync(from, to); };
}
`
    );
    const build = (mode, args = []) =>
      spawnSync(
        process.execPath,
        ['--require', path.join(directory, 'inject.cjs'), path.join(directory, 'scripts', 'build.js'), ...args],
        {
          cwd: directory,
          encoding: 'utf8',
          timeout: 30000,
          env: { ...process.env, NODE_PATH: path.join(root, 'node_modules'), GO_LIBRARY_TEST_FAILURE: mode }
        }
      );
    run(directory, build);
    assert.deepEqual(
      fs.readdirSync(directory).filter((file) => file.startsWith('.' + name + '-build-')),
      [],
      'Temporary build directories must be cleaned'
    );
  } finally {
    assert.ok(
      path.resolve(directory).startsWith(path.resolve(prefix)),
      'Cleanup must stay in the owned fixture directory'
    );
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function assertPreserved(directory, result) {
  assert.ifError(result.error);
  assert.notEqual(result.status, 0, 'An unsuccessful build must fail');
  assert.deepEqual(fs.readdirSync(path.join(directory, 'package')), ['previous.txt']);
  assert.equal(fs.readFileSync(path.join(directory, 'package', 'previous.txt'), 'utf8'), 'previous distribution');
}

for (const [mode, failure] of [
  ['minify', 'Injected minifier failure'],
  ['smoke', 'Injected smoke failure'],
  ['replace', 'Injected replacement failure'],
  ['replace-falsy', 'Injected falsy replacement failure']
]) {
  test(mode + ' failure preserves the previous distribution', () =>
    fixture((directory, build) => {
      const result = build(mode);
      assertPreserved(directory, result);
      assert.ok(result.stderr.includes(failure), result.stdout + result.stderr);
    })
  );
}
for (const mode of ['bundle', 'minify']) {
  test('removed ' + mode + ' mode fails without changing the distribution', () =>
    fixture((directory, build) => {
      const result = build('', [mode]);
      assertPreserved(directory, result);
      assert.match(result.stderr, /Usage: node scripts\/build\.js/);
    })
  );
}
test('one build replaces stale output with the complete distribution', () =>
  fixture((directory, build) => {
    const result = build('');
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const expected = [
      'CHANGELOG.md',
      'LICENSE.md',
      'README.md',
      'dist',
      'docs',
      'index.d.ts',
      'index.js',
      'package.json',
      'src'
    ];
    assert.deepEqual(fs.readdirSync(path.join(directory, 'package')).sort(), expected.sort());
  }));

test('backup cleanup failure reports the active new distribution and an incomplete backup', () =>
  fixture((directory, build) => {
    fs.writeFileSync(path.join(directory, 'package', 'remaining.txt'), 'remaining old file');
    const result = build('backup-cleanup');
    assert.ifError(result.error);
    assert.notEqual(result.status, 0, 'Failed backup cleanup must fail the command');
    const output = path.join(directory, 'package');
    assert.deepEqual(fs.readdirSync(output).sort(), [
      'CHANGELOG.md',
      'LICENSE.md',
      'README.md',
      'dist',
      'docs',
      'index.d.ts',
      'index.js',
      'package.json',
      'src'
    ]);
    for (const entry of ['index.js', 'dist/go-equality.js', 'dist/go-equality.min.js']) {
      const api = require(path.join(output, entry));
      assert.equal(api.isEqual({ current: [1, 2] }, { current: [1, 2] }), true);
      assert.equal(api.isEqual({ current: [1, 2] }, { current: [1, 3] }), false);
    }
    const backups = fs
      .readdirSync(directory)
      .filter((file) => file.startsWith('.' + name + '-build-') && file.endsWith('-previous'));
    assert.equal(backups.length, 1);
    const backup = path.join(directory, backups[0]);
    assert.deepEqual(fs.readdirSync(backup), ['remaining.txt'], 'A failed cleanup can leave an incomplete backup');
    assert.equal(fs.readFileSync(path.join(backup, 'remaining.txt'), 'utf8'), 'remaining old file');
    assert.ok(result.stderr.includes('New distribution is active at ' + output), result.stderr);
    assert.ok(result.stderr.includes('cleanup of previous distribution failed at ' + backup), result.stderr);
    assert.match(result.stderr, /\[cause\]: Error: Injected backup cleanup failure/);
    assert.match(result.stderr, /EACCES/);
    assert.ok(result.stderr.includes('inject.cjs'), 'The cleanup cause must retain its original stack');
    assert.doesNotMatch(result.stdout, /Built complete distribution successfully/);
    assert.equal(path.dirname(backup), directory);
    fs.rmSync(backup, { recursive: true, force: true });
  }));

for (const mode of ['rollback', 'rollback-cleanup']) {
  test(mode + ' failure retains a recoverable previous distribution', () =>
    fixture((directory, build) => {
      const result = build(mode);
      assert.ifError(result.error);
      assert.notEqual(result.status, 0);
      const backups = fs
        .readdirSync(directory)
        .filter((file) => file.startsWith('.' + name + '-build-') && file.endsWith('-previous'));
      assert.equal(backups.length, 1);
      const backup = path.join(directory, backups[0]);
      assert.equal(fs.readFileSync(path.join(backup, 'previous.txt'), 'utf8'), 'previous distribution');
      assert.ok(result.stderr.includes(backup), 'Failure must identify the retained backup');
      assert.ok(!fs.existsSync(path.join(directory, 'package')));
      // Demonstrate that the reported backup can be restored once the filesystem permits it.
      fs.renameSync(backup, path.join(directory, 'package'));
      if (mode === 'rollback-cleanup') {
        const staging = backup.slice(0, -'-previous'.length);
        assert.ok(
          result.stderr.includes('cleanup also failed at ' + staging),
          'Failure must also identify the staging directory'
        );
        assert.equal(path.dirname(staging), directory);
        fs.rmSync(staging, { recursive: true, force: true });
      }
    })
  );
}
test('a clean checkout can build without an existing distribution', () =>
  fixture((directory, build) => {
    fs.unlinkSync(path.join(directory, 'package', 'previous.txt'));
    fs.rmdirSync(path.join(directory, 'package'));
    const result = build('');
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(fs.existsSync(path.join(directory, 'package', 'dist', name + '.js')));
    assert.ok(fs.existsSync(path.join(directory, 'package', 'dist', name + '.min.js')));
  }));

test('build assembles a complete consumer package without changing canonical inputs', () =>
  fixture((directory, build) => {
    const inputs = ['index.js', 'index.d.ts', 'package.json', 'README.md', 'docs/API.md'];
    const before = inputs.map((file) => fs.readFileSync(path.join(directory, file)));
    const result = build('');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const output = path.join(directory, 'package');
    assert.ok(fs.existsSync(path.join(output, 'package.json')), 'Expected a complete package/');
    const metadata = JSON.parse(fs.readFileSync(path.join(output, 'package.json'), 'utf8'));
    assert.equal(metadata.name, name);
    assert.equal(metadata.engines.node, '>=8.0.0');
    assert.deepEqual(Object.keys(metadata.exports).sort(), [
      '.',
      './dist/go-equality.js',
      './dist/go-equality.min.js',
      './package.json'
    ]);
    for (const key of ['private', 'scripts', 'devDependencies']) {
      assert.equal(metadata[key], undefined, key);
    }
    for (const [index, file] of inputs.entries()) {
      assert.deepEqual(fs.readFileSync(path.join(directory, file)), before[index]);
    }
    assert.ok(!fs.existsSync(path.join(output, 'src/temp')), 'Playground files are not consumer runtime');
    for (const file of ['README.md', 'docs/API.md']) {
      assert.deepEqual(fs.readFileSync(path.join(output, file)), fs.readFileSync(path.join(directory, file)));
    }
    const contents = () =>
      Object.fromEntries(
        fs
          .readdirSync(output, { recursive: true, withFileTypes: true })
          .filter((file) => file.isFile())
          .map((file) => {
            const absolute = path.join(file.parentPath, file.name);
            return [path.relative(output, absolute), fs.readFileSync(absolute).toString('base64')];
          })
      );
    const expected = contents();
    fs.writeFileSync(path.join(output, 'obsolete.js'), 'stale entry');
    const repeated = build('');
    assert.equal(repeated.status, 0, repeated.stdout + repeated.stderr);
    assert.deepEqual(contents(), expected);
  }));

test('private development manifest rejects ordinary packing', () => {
  const metadata = require('../package.json');
  assert.equal(metadata.private, true);
  assert.equal(metadata.exports, undefined);
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'pack', '--dry-run'], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /pack:package/);
});

test('failure-injection checks reject a minifier prerequisite loading error', () =>
  fixture((directory) => {
    const preload = path.join(directory, 'missing-minifier.cjs');
    fs.writeFileSync(
      preload,
      `
const Module = require('node:module');
const load = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'terser') {
        throw Object.assign(Error('Injected minifier prerequisite failure'), {code:'MODULE_NOT_FOUND'});
    }
    return Reflect.apply(load, this, [request, parent, isMain]);
};
`
    );
    const env = { ...process.env, NODE_OPTIONS: '--require ' + JSON.stringify(preload) };
    // This child is a separate test run, not a worker in the current runner.
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(
      process.execPath,
      [
        '--test',
        '--test-reporter=tap',
        '--test-name-pattern=^(minify|smoke|replace|replace-falsy) failure preserves the previous distribution$',
        path.join(directory, 'scripts', 'test-build.js')
      ],
      {
        cwd: directory,
        encoding: 'utf8',
        timeout: 30000,
        env
      }
    );
    assert.ifError(result.error);
    assert.notEqual(
      result.status,
      0,
      'A prerequisite error must not satisfy an injected-failure regression\n' + result.stdout + result.stderr
    );
    const output = result.stdout + result.stderr;
    assert.match(output, /Injected minifier prerequisite failure/);
    for (const mode of ['minify', 'smoke', 'replace', 'replace-falsy']) {
      assert.match(output, new RegExp('not ok \\d+ - ' + mode + ' failure preserves the previous distribution'));
    }
  }));
