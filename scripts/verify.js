'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { describeTarball, run, runNpm } = require('./release-tools');
const { values } = parseArgs({
  options: {
    browser: { type: 'boolean', default: false },
    node: { type: 'string' },
    tarball: { type: 'string' },
    destination: { type: 'string' }
  }
});
if (values.tarball !== undefined && values.destination !== undefined) {
  throw new Error('--tarball cannot be combined with --destination.');
}
// Reject invalid supplied candidates before runtime probes or verification work.
let candidate = values.tarball !== undefined ? describeTarball(values.tarball) : null;
const minimumNode = values.node || process.env.GO_EQUALITY_NODE8;
if (!minimumNode) {
  throw new Error('Release verification requires Node 8.0.0: set GO_EQUALITY_NODE8 or pass --node /path/to/node.');
}
const minimumVersion = run(minimumNode, ['--version']).trim();
if (minimumVersion !== 'v8.0.0') {
  throw new Error('Expected the declared minimum Node v8.0.0, received ' + minimumVersion);
}
runNpm(['run', 'lint'], true);
runNpm(['run', 'format:check'], true);
if (!candidate) {
  const destination = values.destination
    ? path.resolve(values.destination)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'go-equality-release-'));
  // pack:package owns the complete build; later consumers share its exact archive.
  const output = runNpm(['run', 'pack:package', '--', '--destination', destination]);
  process.stdout.write(output);
  const packed = JSON.parse(output.trim().split('\n').at(-1));
  candidate = describeTarball(packed.tarball);
  if (candidate.sha256 !== packed.sha256) {
    throw new Error('Packed candidate changed before verification.');
  }
}
for (const command of [
  'test:docs',
  'coverage',
  'test:types',
  'test:build',
  'test:tooling',
  'test:artifacts',
  'test:release',
  'test:memory'
]) {
  const artifactArgs = ['test:types', 'test:artifacts', 'test:memory'].includes(command)
    ? ['--', '--tarball', candidate.tarball]
    : [];
  runNpm(['run', command, ...artifactArgs], true);
}
runNpm(['run', 'test:package', '--', '--tarball', candidate.tarball, '--node', minimumNode], true);
if (values.browser) {
  runNpm(['run', 'test:browser', '--', '--tarball', candidate.tarball, '--browser', 'all'], true);
}
if (describeTarball(candidate.tarball).sha256 !== candidate.sha256) {
  throw new Error('Candidate changed during verification.');
}
console.log('Verified release candidate: ' + candidate.tarball + '\nSHA-256: ' + candidate.sha256);
