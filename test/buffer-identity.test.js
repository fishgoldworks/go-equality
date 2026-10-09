'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

// A separate process removes Buffer before any comparison module is loaded.
// In bundle runs, helpers/api also leaves the receiving VM without Buffer.
if (process.env.EQUALITY_WITHOUT_BUFFER) {
  globalThis.Buffer = undefined;
}
const api = require('./helpers/api');
const routes = [
  ['isEqual', api.isEqual],
  ['isStrictEqual', api.isStrictEqual],
  ['isLooseEqual', api.isLooseEqual],
  ...['default', 'strict', 'loose'].flatMap((mode) => [
    ['custom/' + mode, (a, b) => api.isEqual.custom(a, b, () => undefined, { mode })],
    ['create/' + mode, api.isEqual.create(() => undefined, { mode })]
  ])
];

for (const [name, compare] of routes) {
  for (const behaviour of ['accept', 'veto', 'throw', 'invalid']) {
    test(name + ': Buffer-shaped application hook preserves ' + behaviour, () => {
      const sentinel = new Error('application hook failure');
      const ApplicationBuffer = class Buffer extends Uint8Array {
        static isBuffer() {
          throw new Error('must not inspect application metadata');
        }
        static from() {
          throw new Error('must not inspect application metadata');
        }
        static alloc() {
          throw new Error('must not inspect application metadata');
        }
        equals() {
          if (behaviour === 'accept') {
            return true;
          }
          if (behaviour === 'veto') {
            return false;
          }
          if (behaviour === 'throw') {
            throw sentinel;
          }
          return 'invalid';
        }
      };
      const a = new ApplicationBuffer([1]);
      const b = new ApplicationBuffer([behaviour === 'accept' ? 2 : 1]);
      for (const [left, right] of [
        [a, b],
        [b, a]
      ]) {
        if (behaviour === 'throw') {
          assert.throws(
            () => compare(left, right),
            (error) => error === sentinel
          );
        } else if (behaviour === 'invalid') {
          assert.throws(() => compare(left, right), { name: 'TypeError' });
        } else {
          assert.equal(compare(left, right), behaviour === 'accept');
        }
      }
    });
  }
  test(name + ': ordinary byte arrays do not need a Buffer global', () => {
    assert.equal(compare(new Uint8Array([1]), new Uint8Array([1])), true);
    assert.equal(compare(new Uint8Array([1]), new Uint8Array([2])), false);
  });
}

if (!process.env.EQUALITY_WITHOUT_BUFFER) {
  test('application hooks are not guessed to be native when Buffer is unavailable', () => {
    const result = spawnSync(process.execPath, [__filename], {
      encoding: 'utf8',
      timeout: 30000,
      env: { ...process.env, EQUALITY_WITHOUT_BUFFER: '1' }
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}
