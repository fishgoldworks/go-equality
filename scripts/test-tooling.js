'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const commands = [
  { script: 'benchmark.js', args: ['--samples', '3', '--target-ms', '0.01', '--filter', 'primitive equal'] },
  { script: 'benchmark-memory.js', args: ['--samples', '1', '--size', '3'] },
  { script: 'stress.js', args: ['--seeds', '3'] }
];
const entrySource = 'module.exports = require(' + JSON.stringify(root) + ');\n';

function fixture(run) {
  const prefix = path.join(os.tmpdir(), 'go-equality-tooling-test-');
  const directory = fs.mkdtempSync(prefix);
  try {
    run(directory);
  } finally {
    assert.ok(path.resolve(directory).startsWith(path.resolve(prefix)), 'Cleanup must stay in the owned fixture');
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function write(directory, filename, source) {
  const destination = path.join(directory, filename);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, source);
  return destination;
}

function run(command, directory, args = []) {
  const result = spawnSync(process.execPath, [path.join(__dirname, command.script), ...command.args, ...args], {
    cwd: directory,
    encoding: 'utf8',
    timeout: 30000
  });
  assert.ifError(result.error);
  return result;
}

function checkReport(command, report, version) {
  if (command.script === 'stress.js') {
    assert.equal(report.passed, true);
    assert.equal(report.seeds, 3);
    assert.equal(report.directionalAssertions, 54);
    assert.equal(report.reference, 'supplied baseline ' + (version === null ? '(version unknown)' : version));
  } else {
    assert.equal(report.versions[0].name, 'baseline');
    assert.equal(report.versions[0].version, version);
    assert.equal(report.versions.length, 2);
    if (command.script === 'benchmark.js') {
      assert.equal(report.samples, 3);
      assert.deepEqual(
        report.results.map((row) => row.name),
        ['primitive equal']
      );
      assert.equal(report.results[0].baseline.samplesNs.length, 3);
    } else {
      assert.equal(report.samples, 1);
      assert.deepEqual(
        report.results.map((row) => row.kind),
        ['Set', 'Map']
      );
      for (const row of report.results) {
        assert.equal(row.size, 3);
        assert.equal(row.baseline.samples.length, 1);
      }
    }
  }
}

const baselines = [
  {
    name: 'a package directory beside a colliding package.json, using its declared main',
    version: '9.8.7',
    create(directory) {
      write(directory, 'package.json', '{"version":"1.0.0"}');
      write(directory, 'package/package.json', '{"main":"lib/comparator.cjs","version":"9.8.7"}');
      write(directory, 'package/index.js', 'throw Error("The declared main must take precedence");');
      write(directory, 'package/lib/comparator.cjs', entrySource);
      return 'package';
    }
  },
  {
    name: 'an explicit file inside a package',
    version: '9.8.7',
    create(directory) {
      write(directory, 'package/package.json', '{"main":"unused.js","version":"9.8.7"}');
      write(directory, 'package/lib/comparator.cjs', entrySource);
      return 'package/lib/comparator.cjs';
    }
  },
  {
    name: 'a package with an index fallback',
    version: '9.8.6',
    create(directory) {
      write(directory, 'package/package.json', '{"version":"9.8.6"}');
      write(directory, 'package/index.js', entrySource);
      return 'package';
    }
  },
  {
    name: 'a package whose missing main falls back to index',
    version: '9.8.5',
    create(directory) {
      write(directory, 'package/package.json', '{"main":"absent.js","version":"9.8.5"}');
      write(directory, 'package/index.js', entrySource);
      return 'package';
    }
  },
  {
    name: 'a package with a byte-order mark in its metadata',
    version: '9.8.4',
    create(directory) {
      write(directory, 'package/package.json', '\uFEFF{"version":"9.8.4"}');
      write(directory, 'package/index.js', entrySource);
      return 'package';
    }
  },
  {
    name: 'a directory without package metadata',
    version: null,
    create(directory) {
      write(directory, 'package/index.js', entrySource);
      return 'package';
    }
  },
  {
    name: 'a standalone file without package metadata',
    version: null,
    create(directory) {
      write(directory, 'comparator.cjs', entrySource);
      return 'comparator.cjs';
    }
  }
];

for (const command of commands) {
  for (const baseline of baselines) {
    test(command.script + ' accepts ' + baseline.name, () =>
      fixture((directory) => {
        const location = baseline.create(directory);
        const result = run(command, directory, ['--baseline', location]);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        checkReport(command, JSON.parse(result.stdout), baseline.version);
      })
    );
  }
  test(command.script + ' preserves errors thrown by the declared package entry', () =>
    fixture((directory) => {
      write(directory, 'package/package.json', '{"main":"entry.cjs","version":"9.8.7"}');
      write(directory, 'package/index.js', entrySource);
      write(directory, 'package/entry.cjs', 'throw Error("Declared entry failed");');
      const result = run(command, directory, ['--baseline', 'package']);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Declared entry failed/);
    })
  );
}

for (const failure of ['throw Error("Comparison worker failed");', 'process.exit(7);']) {
  test('benchmark-memory.js fails when a comparison worker runs ' + failure, () =>
    fixture((directory) => {
      write(directory, 'package/package.json', '{"version":"9.8.7"}');
      write(
        directory,
        'package/index.js',
        'exports.isEqual = () => { console.error("Worker diagnostic"); ' + failure + ' };'
      );
      const output = path.join(directory, 'report.json');
      const result = run(commands[1], directory, ['--baseline', 'package', '--output', output]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Worker diagnostic/);
      assert.ok(!fs.existsSync(output), 'Failed measurements must not write a successful report');
    })
  );
}

test('stress.js retains independent-oracle checks without a baseline', () =>
  fixture((directory) => {
    const result = run(commands[2], directory);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.passed, true);
    assert.equal(report.directionalAssertions, 54);
    assert.equal(report.reference, 'independent eager fixed-point oracle');
  }));

// Reports must not replace the implementation or metadata being measured.
for (const command of commands.slice(0, 2)) {
  for (const kind of ['entry', 'metadata', 'symlink', 'hardlink']) {
    test(command.script + ' preserves a benchmark input used as the ' + kind + ' report destination', (context) =>
      fixture((directory) => {
        const entry = write(directory, 'baseline/index.js', entrySource);
        const metadata = write(directory, 'baseline/package.json', '{"version":"9.8.7"}');
        let output = kind === 'metadata' ? metadata : entry;
        if (kind === 'symlink' || kind === 'hardlink') {
          output = path.join(directory, 'report.json');
          if (kind === 'symlink') {
            try {
              fs.symlinkSync(entry, output);
            } catch (error) {
              if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
                context.skip('Windows requires Developer Mode or symlink privileges for this fixture.');
                return;
              }
              throw error;
            }
          } else {
            fs.linkSync(entry, output);
          }
        }
        const before = fs.readFileSync(kind === 'metadata' ? metadata : entry);
        const result = run(command, directory, ['--baseline', 'baseline', '--output', output]);
        assert.deepEqual(fs.readFileSync(kind === 'metadata' ? metadata : entry), before, 'Input was overwritten');
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Benchmark report would overwrite an input/);
      })
    );
  }
  test(command.script + ' can replace an existing separate report', () =>
    fixture((directory) => {
      const location = baselines[0].create(directory);
      const output = write(directory, 'report.json', '{"old":true}\n');
      const result = run(command, directory, ['--baseline', location, '--output', output]);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const report = JSON.parse(fs.readFileSync(output, 'utf8'));
      assert.deepEqual(report, JSON.parse(result.stdout));
      checkReport(command, report, baselines[0].version);
    })
  );
}

test('benchmark.js rejects an empty selection instead of writing an empty successful report', () =>
  fixture((directory) => {
    const output = path.join(directory, 'report.json');
    const result = run({ script: 'benchmark.js', args: ['--filter', 'not-an-existing-workload'] }, directory, [
      '--output',
      output
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /No benchmark cases match/);
    assert.ok(!fs.existsSync(output));
  }));

function customBenchmarkFixture(directory, fault) {
  for (const name of ['benchmark-custom.js', 'benchmark-output.js']) {
    const source = path.join(__dirname, name);
    if (fs.existsSync(source)) {
      write(directory, 'scripts/' + name, fs.readFileSync(source));
    }
  }
  write(directory, 'package.json', '{"version":"9.8.7"}');
  write(
    directory,
    'index.js',
    [
      'const real = require(' + JSON.stringify(root) + ').isEqual;',
      'function isEqual(a, b) { return ' + (fault === 'ordinary' ? '1' : 'real(a, b)') + '; }',
      'isEqual.custom = (a, b, callback) => ' + (fault === 'custom' ? '1' : 'real.custom(a, b, callback)') + ';',
      'isEqual.create = (callback) => ' + (fault === 'created' ? '() => 1' : 'real.create(callback)') + ';',
      'module.exports = { isEqual };'
    ].join('\n')
  );
  return path.join(directory, 'scripts/benchmark-custom.js');
}

for (const file of ['index.js', 'package.json', 'scripts/benchmark-custom.js']) {
  test('benchmark-custom.js preserves input ' + file + ' used as a report path', () =>
    fixture((directory) => {
      const script = customBenchmarkFixture(directory);
      const target = path.join(directory, file);
      const before = fs.readFileSync(target);
      const result = spawnSync(process.execPath, [script, target], { encoding: 'utf8', timeout: 30000 });
      assert.ifError(result.error);
      assert.deepEqual(fs.readFileSync(target), before, 'Input was overwritten');
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Benchmark report would overwrite an input/);
    })
  );
}

for (const fault of ['ordinary', 'custom', 'created']) {
  test('benchmark-custom.js rejects a non-boolean truthy result from ' + fault, () =>
    fixture((directory) => {
      const script = customBenchmarkFixture(directory, fault);
      const output = path.join(directory, 'report.json');
      const result = spawnSync(process.execPath, [script, output], { encoding: 'utf8', timeout: 30000 });
      assert.ifError(result.error);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp('primitive / ' + fault));
      assert.ok(!fs.existsSync(output), 'Invalid comparisons must not write a successful report');
    })
  );
}

test('benchmark-custom.js writes a valid report to a separate existing destination', () =>
  fixture((directory) => {
    const script = customBenchmarkFixture(directory);
    const output = write(directory, 'report.json', '{"old":true}\n');
    const result = spawnSync(process.execPath, [script, output], { encoding: 'utf8', timeout: 30000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const report = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(report.results.length, 6);
    for (const row of report.results) {
      assert.deepEqual(Object.keys(row.variants), ['ordinary', 'custom', 'created']);
    }
    assert.deepEqual(report, JSON.parse(result.stdout));
  }));

for (const command of commands.slice(0, 2)) {
  test(command.script + ' preserves a dependency loaded by the selected baseline', () =>
    fixture((directory) => {
      write(directory, 'baseline/package.json', '{"version":"9.8.7"}');
      write(directory, 'baseline/index.js', 'module.exports = require("./implementation.cjs");');
      const dependency = write(directory, 'baseline/implementation.cjs', entrySource);
      const before = fs.readFileSync(dependency);
      const result = run(command, directory, ['--baseline', 'baseline', '--output', dependency]);
      assert.deepEqual(fs.readFileSync(dependency), before, 'Loaded dependency was overwritten');
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Benchmark report would overwrite an input/);
    })
  );
}

function esmBaseline(directory, extension) {
  write(directory, 'baseline/package.json', '{"type":"module","version":"9.8.7"}');
  const dependency = write(
    directory,
    'baseline/implementation.' + extension,
    'import api from ' +
      JSON.stringify(pathToFileURL(path.join(root, 'index.js')).href) +
      ';\n' +
      'export const isEqual = api.isEqual;\n'
  );
  const entry = write(
    directory,
    'baseline/entry.' + extension,
    'export { isEqual } from "./implementation.' + extension + '";\n'
  );
  return { entry, dependency };
}

for (const command of commands.slice(0, 2)) {
  for (const extension of ['mjs', 'js']) {
    test(command.script + ' preserves a transitive ESM input in .' + extension, () =>
      fixture((directory) => {
        const { entry, dependency } = esmBaseline(directory, extension);
        const before = fs.readFileSync(dependency);
        const result = run(command, directory, ['--baseline', entry, '--output', dependency]);
        assert.deepEqual(fs.readFileSync(dependency), before, 'Imported ESM input was overwritten');
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Benchmark report would overwrite an input/);
      })
    );
  }
  test(command.script + ' preserves a hardlink to a transitive ESM input', () =>
    fixture((directory) => {
      const { entry, dependency } = esmBaseline(directory, 'mjs');
      const output = path.join(directory, 'report.json');
      fs.linkSync(dependency, output);
      const before = fs.readFileSync(dependency);
      const result = run(command, directory, ['--baseline', entry, '--output', output]);
      assert.deepEqual(fs.readFileSync(dependency), before, 'Aliased ESM input was overwritten');
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Benchmark report would overwrite an input/);
    })
  );
  test(command.script + ' writes a separate report for an ESM baseline', () =>
    fixture((directory) => {
      const { entry, dependency } = esmBaseline(directory, 'mjs');
      const before = fs.readFileSync(dependency);
      const output = write(directory, 'report.json', '{"old":true}\n');
      const result = run(command, directory, ['--baseline', entry, '--output', output]);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.deepEqual(fs.readFileSync(dependency), before);
      const report = JSON.parse(fs.readFileSync(output, 'utf8'));
      assert.deepEqual(report, JSON.parse(result.stdout));
      checkReport(command, report, '9.8.7');
    })
  );
}

test('benchmark-custom.js preserves a transitive ESM input loaded by its entry', () =>
  fixture((directory) => {
    const script = customBenchmarkFixture(directory);
    const { entry, dependency } = esmBaseline(directory, 'mjs');
    write(directory, 'index.js', 'module.exports = require(' + JSON.stringify(entry) + ');\n');
    const before = fs.readFileSync(dependency);
    const result = spawnSync(process.execPath, [script, dependency], { encoding: 'utf8', timeout: 30000 });
    assert.ifError(result.error);
    assert.deepEqual(fs.readFileSync(dependency), before, 'Custom benchmark ESM input was overwritten');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Benchmark report would overwrite an input/);
  }));

function runMatchingAudit(
  directory,
  entry,
  output,
  mode = 'default',
  script = path.join(__dirname, 'audit-matching.js')
) {
  const result = spawnSync(process.execPath, [script, mode, ...(output ? [output] : [])], {
    cwd: directory,
    env: { ...process.env, EQUALITY_ENTRY: entry },
    encoding: 'utf8',
    timeout: 30000
  });
  assert.ifError(result.error);
  return result;
}

for (const kind of ['entry', 'metadata', 'hardlink', 'commonjs', 'esm', 'late-esm', 'script']) {
  test('audit-matching.js preserves its ' + kind + ' input used as the report destination', () =>
    fixture((directory) => {
      const entry = write(directory, 'baseline/index.js', entrySource);
      const metadata = write(directory, 'baseline/package.json', '{"version":"9.8.7"}');
      let target = entry;
      let output = entry;
      let script;
      if (kind === 'metadata') {
        target = output = metadata;
      } else if (kind === 'hardlink') {
        output = path.join(directory, 'report.json');
        fs.linkSync(entry, output);
      } else if (kind === 'commonjs') {
        target = output = write(directory, 'baseline/implementation.cjs', entrySource);
        write(directory, 'baseline/index.js', 'module.exports = require("./implementation.cjs");');
      } else if (kind === 'esm') {
        target = output = write(
          directory,
          'baseline/implementation.mjs',
          'import api from ' +
            JSON.stringify(pathToFileURL(path.join(root, 'index.js')).href) +
            ';\nexport const isEqual = api.isEqual;\n'
        );
        write(directory, 'baseline/index.js', 'module.exports = require("./implementation.mjs");');
      } else if (kind === 'late-esm') {
        target = output = write(directory, 'baseline/late.mjs', 'export const loaded = true;\n');
        write(
          directory,
          'baseline/index.js',
          'const real = require(' +
            JSON.stringify(root) +
            ').isEqual;\n' +
            'exports.isEqual = { create(callback, options) {\n' +
            '  require("./late.mjs");\n' +
            '  return real.create(callback, options);\n' +
            '} };\n'
        );
      } else if (kind === 'script') {
        for (const name of ['audit-matching.js', 'benchmark-output.js', 'resolve-library.js']) {
          write(directory, 'scripts/' + name, fs.readFileSync(path.join(__dirname, name)));
        }
        script = target = output = path.join(directory, 'scripts/audit-matching.js');
      }
      const before = fs.readFileSync(target);
      const result = runMatchingAudit(directory, entry, output, 'default', script);
      assert.deepEqual(fs.readFileSync(target), before, 'Audit input was overwritten');
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /report would overwrite an input/);
    })
  );
}

for (const selection of ['absolute', 'relative', 'package']) {
  for (const main of ['lib/index.cjs', '../shared/index.cjs']) {
    test('audit-matching.js preserves selected metadata for ' + selection + ' entry ' + main, () =>
      fixture((directory) => {
        const baseline = selection === 'package' ? 'node_modules/test-baseline' : 'baseline';
        const metadata = write(directory, baseline + '/package.json', JSON.stringify({ main }));
        write(directory, baseline + '/' + main, entrySource);
        write(directory, path.join(baseline, path.dirname(main), 'package.json'), '{"type":"commonjs"}');
        for (const name of ['audit-matching.js', 'benchmark-output.js', 'resolve-library.js']) {
          write(directory, 'scripts/' + name, fs.readFileSync(path.join(__dirname, name)));
        }
        const entry =
          selection === 'package'
            ? 'test-baseline'
            : selection === 'relative'
              ? '../baseline'
              : path.join(directory, baseline);
        const before = fs.readFileSync(metadata);
        const result = runMatchingAudit(
          directory,
          entry,
          metadata,
          'default',
          path.join(directory, 'scripts/audit-matching.js')
        );
        assert.deepEqual(fs.readFileSync(metadata), before, 'Selected package metadata was overwritten');
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /report would overwrite an input/);
        const reportPath = path.join(directory, 'report.json');
        const valid = runMatchingAudit(
          directory,
          entry,
          reportPath,
          'default',
          path.join(directory, 'scripts/audit-matching.js')
        );
        assert.equal(valid.status, 0, valid.stdout + valid.stderr);
        assert.equal(JSON.parse(fs.readFileSync(reportPath, 'utf8')).comparisons, 262144);
        assert.deepEqual(fs.readFileSync(metadata), before);
      })
    );
  }
}

for (const selection of ['subpath', 'imports', 'self-reference']) {
  test('audit-matching.js preserves selected metadata for ' + selection, () =>
    fixture((directory) => {
      for (const name of ['audit-matching.js', 'benchmark-output.js', 'resolve-library.js']) {
        write(directory, 'scripts/' + name, fs.readFileSync(path.join(__dirname, name)));
      }
      let entry;
      let metadata;
      if (selection === 'subpath') {
        entry = 'test-baseline/subdir';
        metadata = write(directory, 'node_modules/test-baseline/package.json', '{}');
        write(directory, 'node_modules/test-baseline/subdir/package.json', '{"main":"../../shared/index.cjs"}');
        write(directory, 'node_modules/shared/index.cjs', entrySource);
        write(directory, 'node_modules/shared/package.json', '{}');
      } else {
        entry = selection === 'imports' ? '#baseline' : 'test-baseline';
        metadata = write(
          directory,
          'package.json',
          JSON.stringify({
            name: 'test-baseline',
            exports: './lib/index.cjs',
            imports: { '#baseline': './lib/index.cjs' }
          })
        );
        write(directory, 'lib/index.cjs', entrySource);
        write(directory, 'lib/package.json', '{"type":"commonjs"}');
      }
      const before = fs.readFileSync(metadata);
      const result = runMatchingAudit(
        directory,
        entry,
        metadata,
        'default',
        path.join(directory, 'scripts/audit-matching.js')
      );
      assert.deepEqual(fs.readFileSync(metadata), before, 'Selected package metadata was overwritten');
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /report would overwrite an input/);
      const reportPath = path.join(directory, 'report.json');
      const valid = runMatchingAudit(
        directory,
        entry,
        reportPath,
        'default',
        path.join(directory, 'scripts/audit-matching.js')
      );
      assert.equal(valid.status, 0, valid.stdout + valid.stderr);
      assert.equal(JSON.parse(fs.readFileSync(reportPath, 'utf8')).comparisons, 262144);
      assert.deepEqual(fs.readFileSync(metadata), before);
    })
  );
}

test('audit-matching.js ignores malformed metadata in a shadowed package', () =>
  fixture((directory) => {
    for (const name of ['audit-matching.js', 'benchmark-output.js', 'resolve-library.js']) {
      write(directory, 'app/scripts/' + name, fs.readFileSync(path.join(__dirname, name)));
    }
    write(directory, 'app/node_modules/test-baseline/index.js', entrySource);
    write(directory, 'app/node_modules/test-baseline/package.json', '{"main":"index.js"}');
    const shadowed = write(directory, 'node_modules/test-baseline/package.json', '{broken');
    for (const output of [undefined, path.join(directory, 'report.json')]) {
      const result = runMatchingAudit(
        directory,
        'test-baseline',
        output,
        'default',
        path.join(directory, 'app/scripts/audit-matching.js')
      );
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.comparisons, 262144);
      if (output) {
        assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), report);
      }
      assert.equal(fs.readFileSync(shadowed, 'utf8'), '{broken');
    }
  }));

for (const mode of ['default', 'strict', 'loose']) {
  test('audit-matching.js replaces a separate report in ' + mode + ' mode', () =>
    fixture((directory) => {
      const entry = write(directory, 'baseline/index.js', entrySource);
      const output = write(directory, 'report.json', '{"old":true}\n');
      const before = fs.readFileSync(entry);
      const result = runMatchingAudit(directory, entry, output, mode);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.deepEqual(fs.readFileSync(entry), before);
      const report = JSON.parse(fs.readFileSync(output, 'utf8'));
      assert.deepEqual(report, JSON.parse(result.stdout));
      assert.equal(report.mode, mode);
      assert.equal(report.matrices, 65536);
      assert.equal(report.comparisons, 262144);
      assert.equal(report.failed, 0);
    })
  );
}

test('audit-matching.js retains stdout-only reporting without a destination', () =>
  fixture((directory) => {
    const entry = write(directory, 'baseline/index.js', entrySource);
    const before = fs.readFileSync(entry);
    const result = runMatchingAudit(directory, entry);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(fs.readFileSync(entry), before);
    assert.deepEqual(fs.readdirSync(directory), ['baseline']);
    assert.equal(JSON.parse(result.stdout).comparisons, 262144);
  }));

function transitiveMetadataBaseline(directory, kind) {
  const entry = write(directory, 'baseline/index.cjs', 'module.exports = require("./inner/comparator.js");');
  write(directory, 'baseline/package.json', '{"main":"index.cjs","version":"9.8.7"}');
  let metadata;
  if (kind === 'esm-scope' || kind === 'late-scope') {
    metadata = write(
      directory,
      'baseline/inner/package.json',
      '{"type":"module","imports":{"#impl":"./implementation.js"}}'
    );
    write(directory, 'baseline/inner/comparator.js', 'export { isEqual } from "#impl";');
    write(
      directory,
      'baseline/inner/implementation.js',
      'import api from ' +
        JSON.stringify(pathToFileURL(path.join(root, 'index.js')).href) +
        '; export const isEqual = api.isEqual;'
    );
    if (kind === 'late-scope') {
      write(
        directory,
        'baseline/index.cjs',
        [
          'function load() { return require("./inner/comparator.js").isEqual; }',
          'function isEqual(a, b) { return load()(a, b); }',
          'isEqual.create = (...args) => load().create(...args);',
          'module.exports = { isEqual };'
        ].join('\n')
      );
    }
  } else if (kind === 'package-exports') {
    write(directory, 'baseline/index.cjs', 'module.exports = require("bridge");');
    metadata = write(
      directory,
      'baseline/node_modules/bridge/package.json',
      '{"exports":{"require":"./inner/comparator.cjs"}}'
    );
    write(directory, 'baseline/node_modules/bridge/inner/package.json', '{"type":"commonjs"}');
    write(directory, 'baseline/node_modules/bridge/inner/comparator.cjs', entrySource);
  } else if (kind === 'imports-main') {
    write(directory, 'baseline/index.cjs', 'module.exports = require("./inner/comparator.cjs");');
    write(directory, 'baseline/inner/comparator.cjs', 'module.exports = require("#bridge");');
    write(
      directory,
      'baseline/inner/package.json',
      '\uFEFF' + JSON.stringify({ imports: { '#*': { node: ['*'], default: 'unused-package' } } })
    );
    metadata = write(directory, 'baseline/inner/node_modules/bridge/package.json', '{"main":"../shared.cjs"}');
    write(directory, 'baseline/inner/node_modules/shared.cjs', entrySource);
  } else {
    const location = kind === 'relative-main' ? 'baseline/bridge' : 'baseline/node_modules/bridge';
    write(
      directory,
      'baseline/index.cjs',
      'module.exports = require(' + JSON.stringify(kind === 'relative-main' ? './bridge' : 'bridge') + ');'
    );
    metadata = write(directory, location + '/package.json', '{"main":"../shared.cjs"}');
    write(directory, location + '/../shared.cjs', entrySource);
  }
  return { entry, metadata };
}

const metadataCommands = [...commands.slice(0, 2), { script: 'audit-matching.js' }];
function runMetadataCommand(command, directory, entry, output) {
  return command.script === 'audit-matching.js'
    ? runMatchingAudit(directory, entry, output)
    : run(command, directory, ['--baseline', entry, '--output', output]);
}

for (const command of metadataCommands) {
  for (const kind of ['esm-scope', 'late-scope', 'package-exports', 'relative-main', 'package-main', 'imports-main']) {
    test(command.script + ' preserves transitive metadata for ' + kind, () =>
      fixture((directory) => {
        const { entry, metadata } = transitiveMetadataBaseline(directory, kind);
        const before = fs.readFileSync(metadata);
        const reportPath = write(directory, 'report.json', '{"old":true}');
        const valid = runMetadataCommand(command, directory, entry, reportPath);
        assert.equal(valid.status, 0, valid.stdout + valid.stderr);
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        assert.deepEqual(report, JSON.parse(valid.stdout));
        if (command.script === 'audit-matching.js') {
          assert.equal(report.comparisons, 262144);
          assert.equal(report.failed, 0);
        } else {
          checkReport(command, report, '9.8.7');
        }
        assert.deepEqual(fs.readFileSync(metadata), before);
        const result = runMetadataCommand(command, directory, entry, metadata);
        assert.deepEqual(fs.readFileSync(metadata), before, 'Transitive package metadata was overwritten');
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /report would overwrite an input/);
      })
    );
  }
  test(command.script + ' preserves a hardlink to transitive metadata', () =>
    fixture((directory) => {
      const { entry, metadata } = transitiveMetadataBaseline(directory, 'esm-scope');
      const output = path.join(directory, 'report.json');
      fs.linkSync(metadata, output);
      const before = fs.readFileSync(metadata);
      const result = runMetadataCommand(command, directory, entry, output);
      assert.deepEqual(fs.readFileSync(metadata), before, 'Aliased transitive package metadata was overwritten');
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /report would overwrite an input/);
    })
  );
}

test('benchmark.js preserves a symlink to transitive metadata', (context) =>
  fixture((directory) => {
    const { entry, metadata } = transitiveMetadataBaseline(directory, 'esm-scope');
    const output = path.join(directory, 'report.json');
    try {
      fs.symlinkSync(metadata, output);
    } catch (error) {
      if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
        context.skip('Windows requires Developer Mode or symlink privileges for this fixture.');
        return;
      }
      throw error;
    }
    const before = fs.readFileSync(metadata);
    const result = runMetadataCommand(metadataCommands[0], directory, entry, output);
    assert.deepEqual(fs.readFileSync(metadata), before, 'Aliased transitive package metadata was overwritten');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /report would overwrite an input/);
  }));

test('benchmark-custom.js preserves transitive metadata', () =>
  fixture((directory) => {
    const script = customBenchmarkFixture(directory);
    const { entry, metadata } = transitiveMetadataBaseline(directory, 'esm-scope');
    write(directory, 'index.js', 'module.exports = require(' + JSON.stringify(entry) + ');');
    const before = fs.readFileSync(metadata);
    const result = spawnSync(process.execPath, [script, metadata], { encoding: 'utf8', timeout: 30000 });
    assert.ifError(result.error);
    assert.deepEqual(fs.readFileSync(metadata), before, 'Transitive package metadata was overwritten');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /report would overwrite an input/);
  }));

test('benchmark.js ignores inactive import targets when protecting metadata', () =>
  fixture((directory) => {
    const { entry, metadata } = transitiveMetadataBaseline(directory, 'imports-main');
    write(
      directory,
      'baseline/inner/package.json',
      JSON.stringify({
        imports: {
          '#*': { node: ['*'], default: 'file:///C:/unused%2Ftarget.cjs' }
        }
      })
    );
    const before = fs.readFileSync(metadata);
    const output = path.join(directory, 'report.json');
    const result = runMetadataCommand(metadataCommands[0], directory, entry, output);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    checkReport(metadataCommands[0], JSON.parse(fs.readFileSync(output, 'utf8')), '9.8.7');
    assert.deepEqual(fs.readFileSync(metadata), before);
  }));

test('benchmark.js ignores inactive import targets after wildcard substitution', () =>
  fixture((directory) => {
    const { entry, metadata } = transitiveMetadataBaseline(directory, 'imports-main');
    write(directory, 'baseline/inner/comparator.cjs', 'module.exports = require("#file:bridge");');
    write(
      directory,
      'baseline/inner/package.json',
      JSON.stringify({
        imports: {
          '#file:bridge': 'bridge',
          '#*': '*'
        }
      })
    );
    const before = fs.readFileSync(metadata);
    const output = path.join(directory, 'report.json');
    const result = runMetadataCommand(metadataCommands[0], directory, entry, output);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    checkReport(metadataCommands[0], JSON.parse(fs.readFileSync(output, 'utf8')), '9.8.7');
    assert.deepEqual(fs.readFileSync(metadata), before);
  }));

test('declaration checks reject dependencies on browser and contributor globals', () =>
  fixture((directory) => {
    const checkConsumerTypes = require('./consumer-types');
    const entry = path.join(directory, 'node_modules/go-equality');
    write(directory, 'package.json', '{"private":true}');
    const { consumerManifest, writeFunctionEntries } = require('./package-layout');
    write(directory, 'node_modules/go-equality/package.json', JSON.stringify(consumerManifest()));
    for (const filename of ['index.js', 'index.d.ts']) {
      fs.copyFileSync(path.join(root, filename), path.join(entry, filename));
    }
    fs.mkdirSync(path.join(entry, 'src'));
    for (const filename of fs.readdirSync(path.join(root, 'src')).filter((name) => name.endsWith('.js'))) {
      fs.copyFileSync(path.join(root, 'src', filename), path.join(entry, 'src', filename));
    }
    writeFunctionEntries(entry);
    write(directory, 'node_modules/@types/contributor/index.d.ts', 'declare interface ContributorOnly {}');
    assert.doesNotThrow(() => checkConsumerTypes(directory, [process.execPath], [process.execPath]));
    const declaration = fs.readFileSync(path.join(entry, 'index.d.ts'), 'utf8');
    for (const type of ['Window', 'ContributorOnly']) {
      fs.writeFileSync(path.join(entry, 'index.d.ts'), declaration + '\nexport type AmbientProbe = ' + type + ';\n');
      assert.throws(
        () => checkConsumerTypes(directory, [process.execPath], [process.execPath]),
        new RegExp("Cannot find name '" + type + "'")
      );
    }
  }));

// Execute the real command bodies with inert I/O so simultaneous failures are
// deterministic and never remove a real directory or launch a child process.
function consumerCleanupProbe(stage, primary, cleanupErrors, failWork = true) {
  const removals = [];
  const consumerDirectory = path.join(os.tmpdir(), 'go-equality-consumer-injected');
  const packageDirectory = path.join(os.tmpdir(), 'go-equality-package-injected');
  const candidate = { tarball: 'candidate.tgz', sha256: 'unchanged' };
  const remove = (directory) => {
    removals.push(directory);
    const index = directory === consumerDirectory ? 0 : 1;
    if (index < cleanupErrors.length) {
      throw cleanupErrors[index];
    }
  };
  const work = () => {
    if (failWork) {
      throw primary;
    }
  };
  const fakeFs = {
    mkdtempSync: (prefix) => (prefix.includes('consumer') ? consumerDirectory : packageDirectory),
    mkdirSync() {},
    writeFileSync() {},
    rmSync: remove,
    readdirSync() {
      if (stage === 'package' || stage === 'discovery') {
        work();
      }
      return [];
    }
  };
  const fixture = { consumer: consumerDirectory, entry: consumerDirectory, cleanup: () => remove(consumerDirectory) };
  const script =
    stage === 'setup' ? 'consumer-package.js' : 'test-' + (stage === 'discovery' ? 'artifacts' : stage) + '.js';
  const filename = path.join(__dirname, script);
  const module = { exports: {} };
  const stubs = {
    'node:fs': fakeFs,
    'node:util': { parseArgs: () => ({ values: { tarball: candidate.tarball } }) },
    'node:child_process': {
      spawnSync() {
        work();
        return { status: 0, stdout: '', stderr: '' };
      }
    },
    './release-tools': { describeTarball: () => candidate, run: stage === 'setup' ? work : () => '' },
    './consumer-package': () => fixture,
    './consumer-types': work,
    './test-loaders': stage === 'artifacts' ? work : () => {},
    './pack-package': () => assert.fail('The supplied candidate must not be repacked'),
    './package-layout': { packageRoot: 'unused' },
    '../test/helpers/documentation': {}
  };
  let failed = false;
  let error;
  let result;
  try {
    vm.runInNewContext(
      fs.readFileSync(filename, 'utf8'),
      {
        module,
        __dirname,
        __filename: filename,
        process: { execPath: process.execPath, env: { npm_execpath: 'npm-cli.js' }, stdout: { write() {} } },
        console: { log() {} },
        require: (name) => (Object.hasOwn(stubs, name) ? stubs[name] : require(name))
      },
      { filename }
    );
    if (stage === 'setup') {
      result = module.exports(candidate);
    }
  } catch (caught) {
    failed = true;
    error = caught;
  }
  return { failed, error, result, removals, consumerDirectory, packageDirectory };
}

for (const stage of ['setup', 'types', 'artifacts', 'discovery', 'memory', 'package']) {
  test(stage + ' preserves the original failure when consumer cleanup succeeds', () => {
    const primary = new Error('Injected check failure');
    const result = consumerCleanupProbe(stage, primary, []);
    assert.equal(result.failed, true);
    assert.equal(result.error, primary);
    assert.deepEqual(
      result.removals,
      stage === 'package' ? [result.consumerDirectory, result.packageDirectory] : [result.consumerDirectory]
    );
  });
  test(stage + ' preserves check and cleanup failures and attempts every cleanup', () => {
    for (const primary of [new Error('Injected check failure'), undefined, null, false, 0, '']) {
      const cleanupErrors = [Object.assign(new Error('Injected busy consumer directory'), { code: 'EBUSY' })];
      if (stage === 'package') {
        cleanupErrors.push(new Error('Injected busy package directory'));
      }
      const result = consumerCleanupProbe(stage, primary, cleanupErrors);
      assert.equal(result.failed, true);
      assert.equal(result.error.name, 'AggregateError');
      assert.deepEqual(Array.from(result.error.errors), [primary, ...cleanupErrors]);
      assert.deepEqual(
        result.removals,
        stage === 'package' ? [result.consumerDirectory, result.packageDirectory] : [result.consumerDirectory]
      );
    }
  });
}

for (const stage of ['types', 'artifacts', 'memory']) {
  test(stage + ' cleans up successful checks and fails if cleanup alone fails', () => {
    const valid = consumerCleanupProbe(stage, undefined, [], false);
    assert.equal(valid.failed, false, valid.error?.stack);
    assert.deepEqual(valid.removals, [valid.consumerDirectory]);
    const cleanupError = new Error('Injected cleanup failure');
    const failed = consumerCleanupProbe(stage, undefined, [cleanupError], false);
    assert.equal(failed.failed, true);
    assert.equal(failed.error, cleanupError);
    assert.deepEqual(failed.removals, [failed.consumerDirectory]);
  });
}

test('successful consumer setup transfers cleanup ownership to the caller', () => {
  const result = consumerCleanupProbe('setup', undefined, [], false);
  assert.equal(result.failed, false, result.error?.stack);
  assert.deepEqual(result.removals, []);
  result.result.cleanup();
  assert.deepEqual(result.removals, [result.consumerDirectory]);
});
