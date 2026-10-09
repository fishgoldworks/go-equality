'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { describeTarball, runNpm } = require('./release-tools');

function packPackage(destination) {
  runNpm(['run', 'build'], true);
  fs.mkdirSync(destination, { recursive: true });
  const [packed] = JSON.parse(
    runNpm([
      'pack',
      require('./package-layout').packageRoot,
      '--json',
      '--ignore-scripts',
      '--pack-destination',
      destination
    ])
  );
  const candidate = describeTarball(path.join(destination, packed.filename), false);
  fs.writeFileSync(candidate.tarball + '.sha256', candidate.sha256 + '  ' + path.basename(candidate.tarball) + '\n');
  return candidate;
}

if (require.main === module) {
  const { values } = parseArgs({ options: { destination: { type: 'string' } } });
  const destination = values.destination
    ? path.resolve(values.destination)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'go-equality-candidate-'));
  console.log(JSON.stringify(packPackage(destination)));
}

module.exports = packPackage;
