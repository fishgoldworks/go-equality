'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { run } = require('./release-tools');
const root = path.resolve(__dirname, '..');
module.exports = function checkConsumerTypes(consumer, runtimes, esmRuntimes) {
  const fixtures = path.join(root, 'test', 'types');
  const config = JSON.parse(fs.readFileSync(path.join(fixtures, 'tsconfig.json'), 'utf8'));
  // Repository-only paths support typed lint; installed consumers must use real resolution.
  delete config.compilerOptions.paths;
  for (const extension of ['cts', 'mts']) {
    fs.copyFileSync(path.join(fixtures, 'consumer.ts'), path.join(consumer, 'consumer.' + extension));
  }
  fs.copyFileSync(path.join(fixtures, 'require.cts'), path.join(consumer, 'require.cts'));
  config.files = ['consumer.cts', 'consumer.mts', 'require.cts'];
  fs.writeFileSync(path.join(consumer, 'tsconfig.json'), JSON.stringify(config, null, 2) + '\n');
  run(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.json'], consumer);
  // Execute emitted consumers to catch declaration-only or interop-only successes.
  for (const extension of ['cts', 'mts']) {
    fs.copyFileSync(path.join(fixtures, 'default-import.ts'), path.join(consumer, 'default-import.' + extension));
  }
  const emittedConfig = {
    ...config,
    compilerOptions: { ...config.compilerOptions, noEmit: false, outDir: 'compiled' },
    files: ['default-import.cts', 'default-import.mts']
  };
  fs.writeFileSync(path.join(consumer, 'tsconfig.emit.json'), JSON.stringify(emittedConfig, null, 2) + '\n');
  run(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.emit.json'], consumer);
  for (const runtime of runtimes) {
    run(runtime, [path.join('compiled', 'default-import.cjs')], consumer);
  }
  for (const runtime of esmRuntimes) {
    run(runtime, [path.join('compiled', 'default-import.mjs')], consumer);
  }
};
