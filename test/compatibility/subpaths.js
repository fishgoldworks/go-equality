'use strict';
// Executed from an isolated installation on every supported CommonJS runtime.
const assert = require('assert');
const entry = 'go-equality';
const rootFile = require.resolve(entry);
const names = ['isEqual', 'isStrictEqual', 'isLooseEqual'];
const functions = names.map(function (name) {
  let fn;
  assert.doesNotThrow(function () {
    fn = require(entry + '/' + name);
  }, 'The installed function subpath must resolve: ' + name);
  assert.strictEqual(typeof fn, 'function');
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(fn, name),
    false,
    'Importing must not add self-name properties'
  );
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(fn, 'default'),
    false,
    'Importing must not add default properties'
  );
  assert.strictEqual(require.cache[rootFile], undefined, 'Focused imports must not load the root aggregator');
  return fn;
});
const api = require(entry);
functions.forEach(function (fn, index) {
  assert.strictEqual(fn, api[names[index]], 'Root and focused imports must share function identity');
  assert.strictEqual(fn({ values: [1, 2] }, { values: [1, 2] }), true);
  assert.strictEqual(fn({ values: [1, 2] }, { values: [2, 1] }), false);
  assert.strictEqual(fn(1, '1'), index === 2);
  assert.strictEqual(fn(new Number(1), 1), index !== 1);
  assert.throws(function () {
    fn(
      {
        equals: function () {
          return 1;
        }
      },
      {}
    );
  }, TypeError);
});
const isEqual = functions[0];
assert.strictEqual(isEqual.strict, functions[1]);
assert.strictEqual(isEqual.loose, functions[2]);
assert.strictEqual(isEqual.custom, api.isEqual.custom);
assert.strictEqual(isEqual.create, api.isEqual.create);
assert.strictEqual(
  isEqual.custom('ADMIN', 'admin', function (left, right) {
    return typeof left === 'string' && typeof right === 'string'
      ? left.toLowerCase() === right.toLowerCase()
      : undefined;
  }),
  true
);
assert.strictEqual(
  isEqual.create(
    function () {
      return undefined;
    },
    { mode: 'loose' }
  )(1, '1'),
  true
);
const version = process.versions.node.split('.').map(Number);
if (version[0] > 12 || (version[0] === 12 && version[1] >= 7)) {
  ['go-equality/src/isEqual.js', 'go-equality/isEqual.js', 'go-equality/isEqual/custom'].forEach(function (specifier) {
    assert.throws(function () {
      require(specifier);
    }, Error);
  });
}
console.log('Installed CommonJS function subpaths, identity, behaviour and encapsulation passed.');
