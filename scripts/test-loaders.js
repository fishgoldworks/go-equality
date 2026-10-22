'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const version = require('../package.json').version;
const license = fs.readFileSync(path.resolve(__dirname, '../LICENSE.md'), 'utf8').replace(/\r\n/g, '\n').trim();

function verifyLoaders(directory = path.join(require('./package-layout').packageRoot, 'dist')) {
  let checks = 0;
  for (const file of ['go-equality.js', 'go-equality.min.js']) {
    const source = fs.readFileSync(path.join(directory, file), 'utf8');
    assert.ok(source.includes(license), 'Standalone bundle must preserve the full licence notice: ' + file);
    assert.equal(source.startsWith('/*! go-equality v' + version + ' |'), true, 'Stale bundle version: ' + file);
    if (file.endsWith('.min.js')) {
      assert.match(source, /\n\/\/# sourceMappingURL=go-equality\.min\.js\.map\s*$/);
      const map = JSON.parse(fs.readFileSync(path.join(directory, file + '.map'), 'utf8'));
      assert.equal(map.version, 3);
      assert.equal(map.file, file);
      assert.deepEqual(map.sources, ['go-equality.js']);
      assert.deepEqual(map.sourcesContent, [fs.readFileSync(path.join(directory, 'go-equality.js'), 'utf8')]);
      assert.ok(map.mappings.length > 0, 'Minified bundle must map back to the readable bundle.');
      const code = source
        .replace(/^\/\*![\s\S]*?\*\/\s*/, '')
        .replace(/\n\/\/# sourceMappingURL=[^\n]+\s*$/, '')
        .trim();
      assert.equal(
        /[\r\n\u2028\u2029]/.test(code),
        false,
        'Minified bundle must contain one line of code after the licence banner.'
      );
    }
    for (const unrelatedModule of [undefined, null, {}, 0, 'unrelated']) {
      for (const amd of [false, true]) {
        let result;
        const sandbox = { module: unrelatedModule, Equality: 'unrelated global' };
        if (amd) {
          sandbox.define = (dependencies, factory) => {
            assert.equal(Array.isArray(dependencies) && dependencies.length === 0, true);
            result = factory();
          };
          sandbox.define.amd = {};
        }
        vm.runInNewContext(source, sandbox, { filename: file });
        const api = amd ? result : sandbox.goEquality;
        assert.equal(sandbox.Equality, 'unrelated global');
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
    assert.equal(Object.hasOwn(sandbox, 'goEquality'), false);
    checks++;
  }
  console.log('Loader environment checks passed: ' + checks + '.');
  return checks;
}

module.exports = verifyLoaders;
if (require.main === module) {
  verifyLoaders();
}
