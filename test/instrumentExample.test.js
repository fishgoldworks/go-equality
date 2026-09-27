'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const instrumentExample = require('./helpers/instrumentExample');

test('example assertions survive multiline calls and retain exception checks', () => {
  const example = `compare(
    function () {},
    function () {}
  ); // false
  compare(1, 1); // true
  fail(
    'bad'
  ); // throws TypeError
  `;
  const result = instrumentExample(example);
  assert.equal(result.assertions, 3);
  const context = {
    assert,
    compare: (left, right) => left === right,
    fail: () => {
      throw new TypeError('bad');
    }
  };
  vm.runInNewContext(result.source, context);
  assert.throws(() => vm.runInNewContext(result.source, { ...context, compare: () => true }));
});

test('result annotations cannot silently lose their checked expression', () => {
  assert.throws(() => instrumentExample('// true'), /expression/i);
  const source = 'const message = "// false";';
  assert.deepEqual(instrumentExample(source), { source, assertions: 0 });
});
