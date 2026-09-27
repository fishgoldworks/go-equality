'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const api = require('./helpers/api');

const root = path.resolve(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const examples = [...readme.matchAll(/^```(?:js|javascript)\n([\s\S]*?)^```/gm)];
const htmlExamples = [...readme.matchAll(/^```html\n([\s\S]*?)^```/gm)];
const names = ['isEqual', 'isLooseEqual', 'isStrictEqual'];
const documented = [...names, 'isEqual.strict', 'isEqual.loose', 'isEqual.custom', 'isEqual.create'];

const instrument = require('./helpers/instrumentExample');

// Exercise each example against the API selected by source/artifact/package
// test runs. A separate test below verifies the real root module imports.
function bindImports(code) {
  let bound = false;
  let source = code.replace(/^import \* as (\w+) from 'go-equality';$/gm, (_, alias) => {
    bound = true;
    return `const ${alias} = __api;`;
  });
  source = source.replace(/^import \{([^}]+)\} from 'go-equality';$/gm, (_, imports) => {
    bound = true;
    return `const {${imports}} = __api;`;
  });
  source = source.replace(/require\('go-equality'\)/g, () => {
    bound = true;
    return '__api';
  });
  assert.doesNotMatch(source, /\b(?:import\s|require\s*\()/, 'Unsupported import in executable example');
  return (bound ? '' : 'const { isEqual, isLooseEqual, isStrictEqual } = __api;\n') + source;
}

for (const [i, example] of examples.entries()) {
  test(`README executable JavaScript block ${i + 1}`, () => {
    const { source, assertions } = instrument(example[1]);
    assert.ok(assertions > 0, 'Each example must state at least one checked result');
    vm.runInNewContext(
      bindImports(source),
      { __api: api, Equality: api, assert },
      {
        filename: `README example ${i + 1}`,
        timeout: 5000
      }
    );
  });
}

for (const [i, example] of htmlExamples.entries()) {
  test(`README browser script block ${i + 1}`, () => {
    const scripts = [...example[1].matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 2);
    assert.match(scripts[0][1], /^dist\/go-equality(?:\.min)?\.js$/);
    const context = vm.createContext({ assert });
    vm.runInContext(fs.readFileSync(path.join(root, scripts[0][1]), 'utf8'), context, { timeout: 5000 });
    const { source, assertions } = instrument(scripts[1][2]);
    assert.ok(assertions > 0);
    vm.runInContext(source, context, { filename: 'README browser example', timeout: 5000 });
  });
}

test('README namespace, named and CommonJS imports work through the package root', () => {
  const imports = examples.filter(([, code]) => /^import /m.test(code) || /require\('go-equality'\)/.test(code));
  assert.ok(imports.length >= 4);
  for (const [, code] of imports) {
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

test('README documents every public function using the requested template structure', () => {
  assert.match(readme, /^# Go Equality$/m);
  assert.match(readme, /^## Installation$/m);
  assert.match(readme, /^## Usage$/m);
  assert.match(readme, /^### ES6$/m);
  assert.match(readme, /^### Node$/m);
  assert.match(readme, /^### Web browser$/m);
  assert.match(readme, /^## Documentation$/m);
  assert.match(readme, /^#### Table of Contents$/m);
  assert.match(readme, /^### Equality$/m);
  assert.match(readme, /All \*\*7 public call forms\*\*/);
  assert.match(readme, /docs-7%20call%20forms-blue/);
  assert.match(readme, /^## Additional documentation$/m);
  assert.match(readme, /^## License$/m);
  for (const name of documented) {
    const section = readme.match(new RegExp('^#### ' + name + '\\n([\\s\\S]*?)(?=^#{1,4} |$(?![\\s\\S]))', 'm'));
    assert.ok(section, `${name} must have a function reference`);
    assert.match(section[1], /^##### Parameters$/m);
    if (name !== 'isEqual.create') {
      assert.match(section[1], /^[-*+]\s+`value` \*\*any\*\*/m);
      assert.match(section[1], /^[-*+]\s+`other` \*\*any\*\*/m);
    }
    if (name === 'isEqual.custom' || name === 'isEqual.create') {
      assert.match(section[1], /^[-*+]\s+`customizer` \*\*Function\*\*/m);
      assert.match(section[1], /^[-*+]\s+`options` \*\*Object\*\*/m);
    }
    assert.match(section[1], /^##### Examples$/m);
    assert.match(section[1], name === 'isEqual.create' ? /Returns \*\*Function\*\*/ : /Returns \*\*boolean\*\*/);
    assert.match(section[1], /\*\*Notes\*\*/);
    assert.match(section[1], /\/\/ true/);
    assert.match(section[1], /\/\/ false/);
  }
});

test('README assertion count and release metadata are consistent', () => {
  assert.ok(examples.length >= 10);
  const assertions = examples.reduce((sum, [, code]) => sum + instrument(code).assertions, 0);
  assert.ok(assertions >= 50, 'Do not silently stop executing documented examples');
  const pkg = require('../package.json');
  const lock = require('../package-lock.json');
  assert.match(
    readme,
    new RegExp('^[-*+]\\s+\\*\\*version\\*\\*:\\s+' + pkg.version.replaceAll('.', '\\.') + '$', 'm')
  );
  assert.match(readme, /^[-*+]\s+\*\*license\*\*:\s+LGPL-3\.0-only$/m);
  assert.equal(pkg.version, lock.version);
  assert.equal(pkg.version, lock.packages[''].version);
  assert.equal(pkg.license, 'LGPL-3.0-only');
  assert.equal(pkg.license, lock.packages[''].license);
  assert.deepEqual(pkg.engines, lock.packages[''].engines);
  assert.deepEqual(Object.keys(api).sort(), names);
});

test('README internal anchors and repository-relative links resolve', () => {
  const withoutCode = readme.replace(/^```[^\n]*\n[\s\S]*?^```/gm, '');
  const anchors = new Set();
  const used = new Map();
  for (const [, heading] of withoutCode.matchAll(/^#{1,6} (.+)$/gm)) {
    const base = heading
      .toLowerCase()
      .replace(/[`*]/g, '')
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/ /g, '-');
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    anchors.add(base + (count ? '-' + count : ''));
  }
  for (const [, target] of withoutCode.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(?:https?:|mailto:)/.test(target)) {
      continue;
    }
    if (target.startsWith('#')) {
      assert.ok(anchors.has(target.slice(1)), `Unknown anchor: ${target}`);
    } else {
      const [file] = target.split('#');
      assert.ok(fs.existsSync(path.join(root, file)), `Missing linked file: ${file}`);
    }
  }
});
