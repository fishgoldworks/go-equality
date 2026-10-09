'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const api = require('./helpers/api');

// R04 protects the same value policy at the root, required-child and collection
// entry boundaries. Singleton collections avoid testing assignment algorithms here.
const routes = [
  ['isEqual', api.isEqual, 'default'],
  ['isLooseEqual', api.isLooseEqual, 'loose'],
  ['isStrictEqual', api.isStrictEqual, 'strict'],
  ['isEqual.loose', api.isEqual.loose, 'loose'],
  ['isEqual.strict', api.isEqual.strict, 'strict']
];
const key = Symbol('value');
const boundaries = [
  ['root', (value) => value],
  ['array element', (value) => [value]],
  ['record property', (value) => ({ value })],
  ['hidden property', (value) => Object.defineProperty({}, 'value', { value })],
  ['symbol property', (value) => ({ [key]: value })],
  ['Set member', (value) => new Set([value])],
  ['Map key', (value) => new Map([[value, 'entry']])],
  ['Map value', (value) => new Map([['entry', value]])]
];

function checkBoundaries(compare, left, right, expected, label) {
  for (const [name, wrap] of boundaries) {
    assert.equal(compare(wrap(left), wrap(right)), expected, label + ' / ' + name);
    assert.equal(compare(wrap(right), wrap(left)), expected, label + ' / ' + name + ' / reversed');
  }
}

// Expected results are explicit contract fixtures, not calls to the comparator
// or a copy of its coercion implementation. "same" is the default/strict result.
const numericText = [
  ['hexadecimal number text', 16, '0x10', false, true],
  ['binary number text', 2, '0b10', false, true],
  ['exponent number text', 1000, '1e3', false, true],
  ['hexadecimal bigint text', 16n, '0x10', false, true],
  ['exponent text is not bigint syntax', 1000n, '1e3', false, false],
  ['fractional text is not bigint syntax', 1n, '1.0', false, false],
  ['empty text and zero bigint', 0n, '', false, true],
  ['non-breaking-space text and zero', 0, '\u00a0', false, true],
  ['non-breaking-space text and zero bigint', 0n, '\u00a0', false, true],
  ['non-whitespace text and zero', 0, '\u200b', false, false],
  ['non-whitespace text and zero bigint', 0n, '\u200b', false, false],
  ['different numeric strings stay different', '01', '1', false, false],
  ['infinity text and infinity', Infinity, 'Infinity', false, true],
  ['NaN text is not NaN', NaN, 'NaN', false, false]
];
const numericBoundaries = [
  ['exact bigint beyond safe integer', 9007199254740992n, 9007199254740992, false, true],
  ['rounded neighbour differs from bigint', 9007199254740993n, 9007199254740992, false, false],
  ['negative rounded neighbour differs', -9007199254740993n, -9007199254740992, false, false],
  ['huge exactly represented integer', 2n ** 1023n, 2 ** 1023, false, true],
  ['huge adjacent integer is not rounded to match', 2n ** 1023n + 1n, 2 ** 1023, false, false],
  ['bigint cannot equal positive infinity', 2n ** 1024n, Infinity, false, false],
  ['number fraction is not truncated', 1n, 1.0000000000000002, false, false],
  ['positive and negative infinities differ', Infinity, -Infinity, false, false],
  ['NaNs match', NaN, NaN, true, true],
  ['signed zeros match', -0, 0, true, true],
  ['negative zero and zero bigint', -0, 0n, false, true]
];
const sharedSymbol = Symbol('shared');
const symbolBoundaries = [
  ['same local symbol', sharedSymbol, sharedSymbol, true, true],
  ['distinct symbols with the same description', Symbol('shared'), Symbol('shared'), false, false],
  ['local and registered symbols differ', Symbol('shared'), Symbol.for('shared'), false, false],
  ['symbol and its string representation differ', sharedSymbol, 'Symbol(shared)', false, false],
  ['symbol and number differ without conversion', sharedSymbol, 0, false, false],
  ['symbol and bigint differ without conversion', sharedSymbol, 0n, false, false]
];
const wrappers = [0, -0, NaN, Infinity, 'text', false, 0n, 9007199254740993n, sharedSymbol];
const foreignBox = vm.runInNewContext('(value) => Object(value)');

for (const [name, compare, mode] of routes) {
  for (const [partition, cases] of [
    ['numeric text grammar', numericText],
    ['numeric precision boundaries', numericBoundaries],
    ['symbol identity boundaries', symbolBoundaries]
  ]) {
    test(name + ': ' + partition + ' agrees at root and nested boundaries', () => {
      for (const [label, left, right, same, loose] of cases) {
        checkBoundaries(compare, left, right, mode === 'loose' ? loose : same, label);
      }
    });
  }

  test(name + ': boxed precision and mixed wrapper kinds follow the selected mode', () => {
    for (const [label, left, right, same, loose] of [...numericText, ...numericBoundaries, ...symbolBoundaries]) {
      const expected = mode === 'loose' ? loose : same;
      checkBoundaries(compare, Object(left), Object(right), expected, label + ' / both boxed');
      checkBoundaries(compare, Object(left), right, mode === 'strict' ? false : expected, label + ' / left boxed');
      checkBoundaries(compare, left, Object(right), mode === 'strict' ? false : expected, label + ' / right boxed');
    }
  });

  test(name + ': foreign wrappers unbox but strict comparison preserves constructors', () => {
    for (const value of wrappers) {
      const local = Object(value);
      const foreign = foreignBox(value);
      checkBoundaries(compare, local, foreign, mode !== 'strict', 'local versus foreign wrapper');
      checkBoundaries(compare, foreign, value, mode !== 'strict', 'foreign wrapper versus primitive');
      checkBoundaries(compare, foreign, foreignBox(value), true, 'same foreign constructor');
    }
  });

  test(name + ': ordinary values do not execute coercion or equality hooks against a primitive', () => {
    for (const object of [{}, [], new Date(0), Object.create(null)]) {
      for (const property of ['valueOf', 'toString', Symbol.toPrimitive, 'equals']) {
        Object.defineProperty(object, property, {
          get() {
            throw new Error('An object/primitive mismatch must not read ' + String(property));
          }
        });
      }
      checkBoundaries(compare, object, 0, false, 'non-wrapper object versus number');
      checkBoundaries(compare, object, 0n, false, 'non-wrapper object versus bigint');
    }
  });

  test(name + ': callable values remain identity-only without reading their properties', () => {
    function callback() {}
    const inaccessible = new Proxy(callback, {
      get() {
        throw new Error('Do not inspect a function while comparing identity');
      }
    });
    const revocable = Proxy.revocable(function other() {}, {});
    revocable.revoke();
    for (const fn of [inaccessible, revocable.proxy, class Example {}]) {
      checkBoundaries(compare, fn, fn, true, 'same callable');
      checkBoundaries(compare, fn, callback, false, 'different callable');
      checkBoundaries(compare, fn, Object(0), false, 'callable versus wrapper');
    }
  });

  if (mode !== 'strict') {
    test(name + ': wrapper normalisation ignores conversion hooks and unrelated property getters', () => {
      for (const value of wrappers) {
        const decorated = Object(value);
        for (const property of ['valueOf', 'toString', Symbol.toPrimitive, 'equals', 'constructor', key]) {
          Object.defineProperty(decorated, property, {
            get() {
              throw new Error('Unboxing must not read ' + String(property));
            }
          });
        }
        checkBoundaries(compare, decorated, value, true, 'decorated wrapper versus primitive');
        checkBoundaries(compare, decorated, Object(value), true, 'decorated wrapper versus fresh wrapper');
      }
    });
  }
}
