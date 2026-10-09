'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { scenarios } = require('./compatibility/optional-capabilities');
const selectedEntry = process.env.EQUALITY_ENTRY;
if (selectedEntry !== undefined && selectedEntry.trim() === '') {
  throw new Error('EQUALITY_ENTRY must name a module or bundle when supplied.');
}
const entry = selectedEntry === undefined ? path.resolve(__dirname, '..') : path.resolve(selectedEntry);
const format = process.env.EQUALITY_FORMAT ?? 'commonjs';
if (!['commonjs', 'global', 'amd'].includes(format)) {
  throw new Error('Unsupported EQUALITY_FORMAT: ' + JSON.stringify(format));
}

const focuses =
  format === 'commonjs' && fs.statSync(entry).isDirectory() ? ['', 'isEqual', 'isLooseEqual', 'isStrictEqual'] : [''];
for (const focus of focuses) {
  for (const scenario of scenarios) {
    test('fresh import with optional capabilities: ' + scenario[0] + (focus ? ' / ' + focus : ''), () => {
      const env = { ...process.env };
      // A raw assertion runner must execute even when invoked from node --test.
      delete env.NODE_TEST_CONTEXT;
      const result = spawnSync(
        process.execPath,
        [path.join(__dirname, 'compatibility/optional-capabilities.js'), entry, format, scenario[0], focus],
        { encoding: 'utf8', timeout: 30000, env }
      );
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.scenario, scenario[0]);
      // Nine routes still make 183 assertions without BigInt, shared buffers or Buffer.
      assert.ok(report.checks >= 183, 'The child must execute its behavioural assertions.');
    });
  }
}
