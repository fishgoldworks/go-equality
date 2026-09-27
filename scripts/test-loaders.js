'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const version = require('../package.json').version;

function verifyLoaders(directory = path.resolve(__dirname, '../dist')) {
  let checks = 0;
  for (const file of ['go-equality.js', 'go-equality.min.js']) {
    const source = fs.readFileSync(path.join(directory, file), 'utf8');
    assert.equal(source.startsWith('/*! go-equality v' + version + ' |'), true, 'Stale bundle version: ' + file);
    if (file.endsWith('.min.js')) {
      const code = source.replace(/^\/\*![\s\S]*?\*\/\s*/, '').trim();
      assert.equal(
        /[\r\n\u2028\u2029]/.test(code),
        false,
        'Minified bundle must contain one line of code after the licence banner.'
      );
    }
    for (const unrelatedModule of [undefined, null, {}, 0, 'unrelated']) {
      for (const amd of [false, true]) {
        let result;
        const sandbox = { module: unrelatedModule };
        if (amd) {
          sandbox.define = (dependencies, factory) => {
            assert.equal(Array.isArray(dependencies) && dependencies.length === 0, true);
            result = factory();
          };
          sandbox.define.amd = {};
        }
        vm.runInNewContext(source, sandbox, { filename: file });
        const api = amd ? result : sandbox.Equality;
        assert.deepEqual(Object.keys(api).sort(), ['isEqual', 'isLooseEqual', 'isStrictEqual']);
        assert.equal(api.isEqual({ x: 1 }, { x: 1 }), true);
        assert.equal(api.isLooseEqual(1, '1'), true);
        assert.equal(api.isStrictEqual(1, Object(1)), false);
        checks++;
      }
    }
    const sandbox = {
      module: { exports: {} },
      define() {
        throw Error('CommonJS has priority');
      }
    };
    sandbox.define.amd = {};
    vm.runInNewContext(source, sandbox, { filename: file });
    assert.equal(sandbox.module.exports.isEqual(new Set([1]), new Set([1])), true);
    assert.equal(Object.hasOwn(sandbox, 'Equality'), false);
    checks++;
  }
  console.log('Loader environment checks passed: ' + checks + '.');
  return checks;
}

module.exports = verifyLoaders;
if (require.main === module) {
  verifyLoaders();
}
