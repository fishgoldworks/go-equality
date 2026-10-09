'use strict';
const runCleanups = require('./cleanup');
const { spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const { describeTarball, run } = require('./release-tools');
const { values } = parseArgs({ options: { tarball: { type: 'string' } } });
const fixture = require('./consumer-package')(
  values.tarball !== undefined ? describeTarball(values.tarball) : undefined
);
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const errors = [];
try {
  const tests = fs
    .readdirSync(path.join(root, 'test'))
    .filter((name) => name.endsWith('.test.js'))
    .map((name) => 'test/' + name);
  require('./test-loaders')(path.join(fixture.entry, 'dist'));
  process.stdout.write(
    run(process.execPath, ['--test', path.join(root, 'test/package/docs.test.js')], root, {
      ...process.env,
      EQUALITY_PACKAGE_ROOT: fixture.entry
    })
  );
  for (const file of ['go-equality.js', 'go-equality.min.js']) {
    for (const format of ['commonjs', 'global', 'amd']) {
      console.log('\nArtifact suite: ' + file + ' (' + format + ')');
      const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...tests], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, EQUALITY_ENTRY: path.join(fixture.entry, 'dist', file), EQUALITY_FORMAT: format }
      });
      if (result.error) {
        throw result.error;
      }
      if (result.status !== 0) {
        process.stdout.write(result.stdout);
        process.stderr.write(result.stderr);
        throw new Error('Artifact suite failed: ' + file + ' (' + format + ')');
      }
      console.log(
        result.stdout
          .split('\n')
          .filter((line) => /^# (tests|pass|fail|skipped|duration_ms)/.test(line))
          .join('\n')
      );
    }
  }
} catch (error) {
  errors.push(error);
}
runCleanups([() => fixture.cleanup()], errors);
