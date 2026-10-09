'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const python = process.env.PYTHON || 'python';
const pythonAvailable = spawnSync(python, ['--version'], { encoding: 'utf8' }).status === 0;

function fixture(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'go-equality-release-test-'));
  try {
    const commands = path.join(directory, 'commands.jsonl');
    const npm = path.join(directory, 'npm.cjs');
    fs.writeFileSync(
      npm,
      `
const fs = require('node:fs');
fs.appendFileSync(${JSON.stringify(commands)}, JSON.stringify(process.argv.slice(2)) + '\\n');
console.error('Injected npm failure');
process.exit(31);
`
    );
    callback(directory, commands, npm);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function invoke(script, args, npm) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30000,
    env: { ...process.env, npm_execpath: npm }
  });
}

test('a missing supplied tarball fails before any npm command', () => {
  fixture((directory, commands, npm) => {
    const result = invoke(
      path.join(root, 'scripts/test-package.js'),
      ['--tarball', path.join(directory, 'missing.tgz')],
      npm
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Tarball does not exist/);
    assert.equal(fs.existsSync(commands), false);
  });
});

test('package checks install the exact supplied bytes and propagate install failures', () => {
  fixture((directory, commands, npm) => {
    const tarball = path.join(directory, 'candidate with spaces.tgz');
    const bytes = Buffer.from('release candidate sentinel');
    fs.writeFileSync(tarball, bytes);
    const result = invoke(path.join(root, 'scripts/test-package.js'), ['--tarball', tarball], npm);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Injected npm failure/);
    assert.match(result.stdout, new RegExp(createHash('sha256').update(bytes).digest('hex')));
    const calls = fs
      .readFileSync(commands, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'install');
    assert.equal(calls[0].at(-1), tarball);
    assert.deepEqual(fs.readFileSync(tarball), bytes);
  });
});

test(
  'browser verification rejects a missing supplied tarball before loading browser tools',
  { skip: pythonAvailable ? false : 'Optional Python browser tooling is unavailable.' },
  () => {
    fixture((directory) => {
      const result = spawnSync(
        python,
        [path.join(root, 'scripts/test-browser.py'), '--tarball', path.join(directory, 'missing.tgz')],
        { encoding: 'utf8', timeout: 30000 }
      );
      assert.equal(result.error, undefined);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Tarball does not exist/);
    });
  }
);

function packFixture(directory) {
  const scripts = path.join(directory, 'scripts');
  fs.mkdirSync(scripts);
  for (const name of ['pack-package.js', 'release-tools.js', 'package-layout.js']) {
    fs.copyFileSync(path.join(root, 'scripts', name), path.join(scripts, name));
  }
  fs.writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({
      name: 'release-fixture',
      version: '1.0.0',
      files: ['index.js', 'dist'],
      scripts: { build: 'node build.cjs', prepack: 'node -e "process.exit(92)"' }
    })
  );
  fs.writeFileSync(path.join(directory, 'index.js'), 'module.exports = true;\n');
  return path.join(scripts, 'pack-package.js');
}

test('packing builds once, skips recursive hooks, and records the actual archive digest', () => {
  fixture((directory) => {
    const script = packFixture(directory);
    fs.writeFileSync(
      path.join(directory, 'build.cjs'),
      `
const fs = require('node:fs');
fs.appendFileSync('build-count.txt', 'built\\n');
fs.mkdirSync('package/dist', {recursive:true});
fs.writeFileSync('package/dist/current.js', 'module.exports = true;');
fs.writeFileSync('package/index.js', 'module.exports = true;');
fs.writeFileSync('package/package.json', JSON.stringify({name:'release-fixture',version:'1.0.0',files:['index.js','dist']}));
`
    );
    const destination = path.join(directory, 'candidate');
    const result = invoke(script, ['--destination', destination], process.env.npm_execpath);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const packed = JSON.parse(result.stdout.trim().split('\n').at(-1));
    assert.equal(fs.readFileSync(path.join(directory, 'build-count.txt'), 'utf8'), 'built\n');
    assert.equal(packed.tarball, path.join(destination, 'release-fixture-1.0.0.tgz'));
    assert.equal(packed.sha256, createHash('sha256').update(fs.readFileSync(packed.tarball)).digest('hex'));
    assert.equal(fs.readFileSync(packed.tarball + '.sha256', 'utf8'), packed.sha256 + '  release-fixture-1.0.0.tgz\n');
  });
});

test('a failed build prevents packing and retains child diagnostics', () => {
  fixture((directory) => {
    const script = packFixture(directory);
    fs.writeFileSync(path.join(directory, 'build.cjs'), 'console.error("Build regression sentinel");process.exit(37);');
    const destination = path.join(directory, 'candidate');
    const result = invoke(script, ['--destination', destination], process.env.npm_execpath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Build regression sentinel/);
    assert.equal(fs.existsSync(path.join(destination, 'release-fixture-1.0.0.tgz')), false);
  });
});

function verificationFixture(directory, commands) {
  const scripts = path.join(directory, 'scripts');
  fs.mkdirSync(scripts);
  for (const name of ['verify.js', 'release-tools.js']) {
    fs.copyFileSync(path.join(root, 'scripts', name), path.join(scripts, name));
  }
  // Only the old-runtime version probe is simulated; npm commands remain real
  // child processes so failure propagation and archive paths cross the OS boundary.
  const preload = path.join(directory, 'runtime.cjs');
  fs.writeFileSync(
    preload,
    `
const childProcess = require('node:child_process');
const spawn = childProcess.spawnSync;
childProcess.spawnSync = (command, args, options) => command === 'minimum-node-fixture'
  ? {status: 0, stdout: 'v8.0.0\\n'} : spawn(command, args, options);
`
  );
  const npm = path.join(directory, 'verify-npm.cjs');
  fs.writeFileSync(
    npm,
    `
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(commands)}, JSON.stringify(args) + '\\n');
if (args[1] === process.env.FAIL_COMMAND) {
  console.error('Verification child failure sentinel');
  process.exit(39);
}
if (args[1] === 'pack:package') {
  const destination = args[args.indexOf('--destination') + 1];
  fs.mkdirSync(destination, {recursive: true});
  const tarball = path.join(destination, 'candidate.tgz');
  fs.writeFileSync(tarball, 'candidate archive bytes');
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex');
  fs.writeFileSync(tarball + '.sha256', sha256 + '  candidate.tgz\\n');
  console.log(JSON.stringify({tarball, sha256}));
}
if (args.includes('--tarball')) {
  const tarball = args[args.indexOf('--tarball') + 1];
  if (fs.readFileSync(tarball, 'utf8') !== 'candidate archive bytes') process.exit(40);
}
`
  );
  return (failure, candidateArgs = ['--destination', path.join(directory, 'output')]) =>
    spawnSync(
      process.execPath,
      [
        '--require',
        preload,
        path.join(scripts, 'verify.js'),
        '--node',
        'minimum-node-fixture',
        '--browser',
        ...candidateArgs
      ],
      {
        encoding: 'utf8',
        timeout: 30000,
        env: { ...process.env, npm_execpath: npm, FAIL_COMMAND: failure || '' }
      }
    );
}

test('the complete gate passes one candidate to artifact, memory, package and browser consumers', () => {
  fixture((directory, commands) => {
    const result = verificationFixture(directory, commands)();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const calls = fs
      .readFileSync(commands, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(calls.filter((args) => args[1] === 'pack:package').length, 1);
    assert.equal(
      calls.some((args) => args[1] === 'build'),
      false,
      'The packing command already owns the complete build'
    );
    const expected = path.join(directory, 'output', 'candidate.tgz');
    for (const command of ['test:types', 'test:artifacts', 'test:memory', 'test:package', 'test:browser']) {
      const args = calls.find((call) => call[1] === command);
      assert.equal(args[args.indexOf('--tarball') + 1], expected, command);
    }
    assert.match(result.stdout, /Verified release candidate:/);
  });
});

test('a failing verification child prevents later consumer checks and success reporting', () => {
  fixture((directory, commands) => {
    const result = verificationFixture(directory, commands)('test:types');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Verification child failure sentinel/);
    assert.doesNotMatch(result.stdout, /Verified release candidate:/);
    const calls = fs
      .readFileSync(commands, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(
      calls.some((args) => args[1] === 'test:package' || args[1] === 'test:browser'),
      false
    );
  });
});

test('release verification rejects a newer runtime substituted for the declared minimum', () => {
  fixture((_directory, commands, npm) => {
    const result = invoke(path.join(root, 'scripts/verify.js'), ['--node', process.execPath], npm);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Expected the declared minimum Node v8.0.0/);
    assert.equal(fs.existsSync(commands), false);
  });
});

test('a changed archive is rejected against its recorded digest before installation', () => {
  fixture((directory, commands, npm) => {
    const tarball = path.join(directory, 'changed.tgz');
    fs.writeFileSync(tarball, 'changed bytes');
    fs.writeFileSync(tarball + '.sha256', '0'.repeat(64) + '  changed.tgz\n');
    const result = invoke(path.join(root, 'scripts/test-package.js'), ['--tarball', tarball], npm);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Tarball SHA-256 does not match/);
    assert.equal(fs.existsSync(commands), false);
  });
});

test('an explicitly empty tarball path fails instead of creating a new candidate', () => {
  fixture((_directory, commands, npm) => {
    const result = invoke(path.join(root, 'scripts/test-package.js'), ['--tarball', ''], npm);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Tarball does not exist/);
    assert.equal(fs.existsSync(commands), false);
  });
});

test('supplied candidates run every verification gate without another build or pack', () => {
  fixture((directory, commands) => {
    const tarball = path.join(directory, 'supplied candidate.tgz');
    fs.writeFileSync(tarball, 'candidate archive bytes');
    const result = verificationFixture(directory, commands)(undefined, ['--tarball', tarball]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const calls = fs
      .readFileSync(commands, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      calls.map((args) => args[1]),
      [
        'lint',
        'format:check',
        'test:docs',
        'coverage',
        'test:types',
        'test:build',
        'test:tooling',
        'test:artifacts',
        'test:release',
        'test:memory',
        'test:package',
        'test:browser'
      ]
    );
    for (const command of ['test:types', 'test:artifacts', 'test:memory', 'test:package', 'test:browser']) {
      const args = calls.find((call) => call[1] === command);
      assert.equal(args[args.indexOf('--tarball') + 1], tarball);
    }
    assert.equal(fs.readFileSync(tarball, 'utf8'), 'candidate archive bytes');
  });
});

test('verification rejects missing supplied candidates before probing runtimes or running gates', () => {
  fixture((directory, commands, npm) => {
    for (const tarball of [path.join(directory, 'missing.tgz'), '']) {
      const result = invoke(
        path.join(root, 'scripts/verify.js'),
        ['--node', 'missing-runtime-fixture', '--tarball', tarball],
        npm
      );
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Tarball does not exist/);
      assert.equal(fs.existsSync(commands), false);
    }
  });
});

test('verification rejects a destination combined with a supplied candidate', () => {
  fixture((directory, commands, npm) => {
    const result = invoke(
      path.join(root, 'scripts/verify.js'),
      ['--tarball', path.join(directory, 'candidate.tgz'), '--destination', directory],
      npm
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--tarball cannot be combined with --destination/);
    assert.equal(fs.existsSync(commands), false);
  });
});

test('memory verification rejects missing and empty supplied candidates before installation', () => {
  fixture((directory, commands, npm) => {
    for (const tarball of [path.join(directory, 'missing.tgz'), '']) {
      const result = invoke(path.join(root, 'scripts/test-memory.js'), ['--tarball', tarball], npm);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Tarball does not exist/);
      assert.equal(fs.existsSync(commands), false);
    }
  });
});

test('memory verification rejects a recorded digest mismatch before installation', () => {
  fixture((directory, commands, npm) => {
    const tarball = path.join(directory, 'changed.tgz');
    fs.writeFileSync(tarball, 'changed candidate');
    fs.writeFileSync(tarball + '.sha256', '0'.repeat(64) + '  changed.tgz\n');
    const result = invoke(path.join(root, 'scripts/test-memory.js'), ['--tarball', tarball], npm);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Tarball SHA-256 does not match/);
    assert.equal(fs.existsSync(commands), false);
  });
});

test('memory verification retains installation failures instead of testing the checkout', () => {
  fixture((directory, commands, npm) => {
    const tarball = path.join(directory, 'candidate with spaces.tgz');
    fs.writeFileSync(tarball, 'memory candidate sentinel');
    const result = invoke(path.join(root, 'scripts/test-memory.js'), ['--tarball', tarball], npm);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Injected npm failure/);
    const calls = fs
      .readFileSync(commands, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'install');
    assert.equal(calls[0].at(-1), tarball);
  });
});

test('memory verification runs the installed candidate and propagates constrained-child failures', () => {
  fixture((directory) => {
    const source = path.join(directory, 'candidate');
    fs.mkdirSync(source);
    fs.writeFileSync(
      path.join(source, 'package.json'),
      JSON.stringify({ name: 'go-equality', version: '1.0.0', main: 'index.js' })
    );
    fs.writeFileSync(
      path.join(source, 'index.js'),
      `
function compare() { throw new Error('Candidate memory failure sentinel'); }
compare.create = () => compare;
module.exports = {isEqual: compare, isStrictEqual: compare, isLooseEqual: compare};
`
    );
    const packed = spawnSync(
      process.execPath,
      [process.env.npm_execpath, 'pack', '--ignore-scripts', '--json', '--pack-destination', directory],
      { cwd: source, encoding: 'utf8', timeout: 30000 }
    );
    assert.equal(packed.status, 0, packed.stdout + packed.stderr);
    const tarball = path.join(directory, JSON.parse(packed.stdout)[0].filename);
    const before = fs.readFileSync(tarball);
    const digest = createHash('sha256').update(before).digest('hex');
    fs.writeFileSync(tarball + '.sha256', digest + '  ' + path.basename(tarball) + '\n');
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/test-memory.js'), '--tarball', tarball], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30000,
      // A candidate must take precedence over checkout-oriented diagnostics.
      env: {
        ...process.env,
        EQUALITY_ENTRY: path.join(directory, 'unavailable-diagnostic.js'),
        EQUALITY_FORMAT: 'global'
      }
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Constrained-heap comparison failed/);
    assert.match(result.stderr, /Candidate memory failure sentinel/);
    assert.deepEqual(fs.readFileSync(tarball), before);
  });
});

test('standalone memory diagnostics retain entry and global-format overrides', () => {
  fixture((directory, commands, npm) => {
    const entry = path.join(directory, 'diagnostic.js');
    fs.writeFileSync(
      entry,
      `
function compare() { throw new Error('Standalone memory diagnostic sentinel'); }
compare.create = () => compare;
this.Equality = {isEqual: compare};
`
    );
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/test-memory.js')], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30000,
      env: { ...process.env, npm_execpath: npm, EQUALITY_ENTRY: entry, EQUALITY_FORMAT: 'global' }
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Standalone memory diagnostic sentinel/);
    assert.equal(fs.existsSync(commands), false);
  });
});

test(
  'browser reports cannot overwrite candidate archives, digests or source inputs',
  { skip: pythonAvailable ? false : 'Python is unavailable; browser input checks did not run.' },
  () => {
    const result = spawnSync(python, [path.join(root, 'scripts/test-browser-inputs.py')], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30000
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
);
