'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const api = require('./helpers/api');
const ComparisonContext = require('../src/ComparisonContext');

// Exercise the context invariant directly: public traversal normally resolves
// already-invalid pairs to false before attaching a required dependency.
test('a previously invalidated dependency cannot be accepted by another pair', () => {
  const context = new ComparisonContext('default');
  const dependency = context.pair({ value: 1 }, { value: 2 });
  context.expand(dependency);
  const parent = context.pair({}, {});
  assert.equal(context.require(parent, dependency), false);
});

for (const [name, compare] of Object.entries(api)) {
  test(name + ': binary length is rechecked after a getter resizes the backing store', () => {
    const left = new ArrayBuffer(4, { maxByteLength: 8 });
    const right = new ArrayBuffer(4, { maxByteLength: 8 });
    // Both buffers initially have the same zero-filled payload. The getter
    // changes the right buffer after default/loose classification cached its
    // length. A prefix-only byte comparison would incorrectly accept the pair.
    // This is a defensive check, not support for generally mutating inputs.
    Object.defineProperty(left, 'equals', {
      get() {
        right.resize(8);
        return undefined;
      }
    });
    Object.defineProperty(right, 'equals', {
      get() {
        return undefined;
      }
    });
    assert.equal(compare(left, right), false);
  });
}

test('the public API works without optional native capabilities', () => {
  const entry = process.env.EQUALITY_ENTRY ? path.resolve(process.env.EQUALITY_ENTRY) : path.resolve(__dirname, '..');
  // Use a fresh process so captured intrinsics and module caches are isolated.
  // VM bundle branches also need the optional globals removed in their realm.
  const source = `
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const vm = require('node:vm');
    globalThis.SharedArrayBuffer = undefined;
    globalThis.BigInt = undefined;
    Object.hasOwn = undefined;
    for (const flag of ['hasIndices', 'dotAll', 'unicodeSets']) delete RegExp.prototype[flag];
    const entry = process.argv[1];
    const format = process.env.EQUALITY_FORMAT;
    let api;
    if (format === 'global' || format === 'amd') {
      const sandbox = { SharedArrayBuffer: undefined, BigInt: undefined };
      vm.createContext(sandbox);
      vm.runInContext("Object.hasOwn = undefined; ['hasIndices', 'dotAll', 'unicodeSets'].forEach(flag => delete RegExp.prototype[flag]);", sandbox);
      if (format === 'amd') {
        sandbox.define = (_dependencies, factory) => { api = factory(); };
        sandbox.define.amd = {};
      }
      vm.runInContext(fs.readFileSync(entry, 'utf8'), sandbox, { filename: entry });
      if (format === 'global') api = sandbox.Equality;
    } else {
      api = require(entry);
    }
    for (const compare of Object.values(api)) {
      assert.equal(compare({ value: 1 }, { value: 1 }), true);
      assert.equal(compare({ value: 1 }, { value: 2 }), false);
      assert.equal(compare(new ArrayBuffer(4), new ArrayBuffer(4)), true);
      assert.throws(() => compare(/ab/gi, /ab/gi), /RegExp.*flag.*unavailable/i);
      assert.equal(compare(/ab/g, /other/i), false);
      assert.equal(compare(Object(1), Object(1)), true);
      assert.equal(compare(
        { [Symbol.toStringTag]: 'BigInt' },
        { [Symbol.toStringTag]: 'BigInt' }
      ), false);
      assert.equal(compare(new Uint8Array([1, 2]), new Uint8Array([1, 3])), false);
      assert.equal(compare(
        { [Symbol.toStringTag]: 'SharedArrayBuffer' },
        { [Symbol.toStringTag]: 'SharedArrayBuffer' }
      ), false);
    }
    assert.equal(api.isEqual.custom(1, '1', () => undefined, { mode: 'loose' }), true);
    assert.equal(api.isEqual.create(() => undefined, Object.create({ mode: 'loose' }))(1, '1'), false);
  `;
  const result = spawnSync(process.execPath, ['-e', source, entry], {
    encoding: 'utf8',
    timeout: 10000
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
