'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { run } = require('./release-tools');
const { scenarios } = require('../test/compatibility/optional-capabilities');

module.exports = function checkOptionalCapabilities(consumer, runtime, esm) {
  const root = path.resolve(__dirname, '..');
  const runner = path.join(consumer, 'optional-capabilities.js');
  fs.copyFileSync(path.join(root, 'test/compatibility/optional-capabilities.js'), runner);
  const bootstrap = path.join(consumer, 'optional-bootstrap.mjs');
  fs.writeFileSync(
    bootstrap,
    "import suite from './optional-capabilities.js';\n" +
      'const scenario = suite.scenarios.find(item => item[0] === process.argv[2]);\n' +
      'global.optionalFixture = suite.prepare(global, scenario[1]);\n' +
      "import('./optional-import' + (process.argv[3] ? '-' + process.argv[3] : '') + '.mjs').catch(error => { console.error(error); process.exitCode = 1; });\n"
  );
  const esmRunner = path.join(consumer, 'optional-import.mjs');
  fs.writeFileSync(
    esmRunner,
    "import Eq, { isEqual, isLooseEqual, isStrictEqual } from 'go-equality';\n" +
      "import assert from 'assert';\n" +
      "import suite from './optional-capabilities.js';\n" +
      'assert.strictEqual(Eq.isEqual, isEqual);\n' +
      'assert.strictEqual(Eq.isLooseEqual, isLooseEqual);\n' +
      'assert.strictEqual(Eq.isStrictEqual, isStrictEqual);\n' +
      'const checks = suite.exercise({ isEqual, isLooseEqual, isStrictEqual }, global.optionalFixture, assert);\n' +
      'console.log(JSON.stringify({ scenario: process.argv[2], checks }));\n'
  );
  const rootRunner = fs.readFileSync(esmRunner, 'utf8');
  for (const focus of ['isEqual', 'isLooseEqual', 'isStrictEqual']) {
    const focusedImports =
      'import focusedDefault, { ' + focus + " as focusedNamed } from 'go-equality/" + focus + "';\n";
    const checks =
      'assert.strictEqual(focusedDefault, focusedNamed);\nassert.strictEqual(focusedNamed, ' + focus + ');\n';
    fs.writeFileSync(
      path.join(consumer, 'optional-import-' + focus + '.mjs'),
      focusedImports + rootRunner.replace('const checks =', checks + 'const checks =')
    );
  }
  const entries = [['go-equality', 'commonjs', '']];
  // Public subpaths must load successfully after capability removal, before the root API.
  for (const focus of ['isEqual', 'isLooseEqual', 'isStrictEqual']) {
    entries.push(['go-equality', 'commonjs', 'public/' + focus]);
  }
  for (const file of ['go-equality.js', 'go-equality.min.js']) {
    for (const format of ['commonjs', 'global', 'amd']) {
      entries.push([path.join(consumer, 'node_modules/go-equality/dist', file), format, '']);
    }
  }
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  let checks = 0;
  let imports = 0;
  for (const scenario of scenarios) {
    const commands = entries.map(([entry, format, focus]) => [runner, entry, format, scenario[0], focus]);
    if (esm) {
      // Initialise Node's CJS/ESM loader before removing Buffer: Node 12's lexer needs it.
      // No library module loads until after the bootstrap removes capabilities.
      for (const focus of ['', 'isEqual', 'isLooseEqual', 'isStrictEqual']) {
        commands.push([bootstrap, scenario[0], focus]);
      }
    }
    for (const args of commands) {
      const report = JSON.parse(run(runtime, args, consumer, env));
      assert.equal(report.scenario, scenario[0]);
      assert.ok(report.checks >= 183, 'Optional-capability assertions must actually execute.');
      checks += report.checks;
      imports++;
    }
  }
  console.log('Optional capabilities: ' + imports + ' fresh imports, ' + checks + ' assertions passed.');
};
