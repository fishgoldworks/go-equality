'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const instrument = require('../helpers/instrumentExample');
const { readDocuments, examples: extractExamples, bindImports, checkLinks } = require('../helpers/documentation');
if (!process.env.EQUALITY_PACKAGE_ROOT) {
  throw new Error('Run consumer documentation checks through test:artifacts or test:package.');
}
const root = path.resolve(process.env.EQUALITY_PACKAGE_ROOT);
const documents = readDocuments(root);
const examples = extractExamples(documents);
const htmlExamples = extractExamples(documents, 'html');
const api = require(root);
for (const { file, index, code } of examples) {
  test('Installed ' + file + ' JavaScript block ' + (index + 1), () => {
    const { source, assertions } = instrument(code);
    assert.ok(assertions > 0);
    vm.runInNewContext(bindImports(source), { __api: api, assert }, { filename: file, timeout: 5000 });
  });
}
test('Installed documentation links resolve', () => checkLinks(root, documents));
for (const [i, example] of htmlExamples.entries()) {
  test(`README browser script block ${i + 1}`, () => {
    const metadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const cdnPrefix = 'https://cdn.jsdelivr.net/npm/' + metadata.name + '@' + metadata.version + '/';
    const scripts = [
      ...example.code.replaceAll(cdnPrefix, '').matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)
    ];
    assert.equal(scripts.length, 2);
    assert.match(scripts[0][1], /^dist\/go-equality(?:\.min)?\.js$/);
    const context = vm.createContext({ assert });
    vm.runInContext(fs.readFileSync(path.join(root, scripts[0][1]), 'utf8'), context, { timeout: 5000 });
    const { source, assertions } = instrument(scripts[1][2]);
    assert.ok(assertions > 0);
    vm.runInContext(source, context, { filename: 'README browser example', timeout: 5000 });
  });
}

test('Documented ES module and CommonJS examples work through the package root', () => {
  const imports = examples.filter(({ code }) => /^import /m.test(code) || /require\('go-equality'\)/.test(code));
  assert.ok(imports.some(({ code }) => /^import \{ isEqual \} from 'go-equality';$/m.test(code)));
  assert.ok(imports.some(({ code }) => /^const \{ isEqual \} = require\('go-equality'\);$/m.test(code)));
  for (const { code } of imports) {
    const source = instrument(code).source;
    const esm = /^import /m.test(code);
    const prefix = esm
      ? "import assert from 'node:assert/strict';\n"
      : "const assert = require('node:assert/strict');\n";
    const result = spawnSync(
      process.execPath,
      ['--input-type=' + (esm ? 'module' : 'commonjs'), '-e', prefix + source],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 10000
      }
    );
    if (result.error) {
      throw result.error;
    }
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});
