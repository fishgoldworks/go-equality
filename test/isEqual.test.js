/*
 * Copyright (c) 2022 Michael Ko
 *
 * SPDX-License-Identifier: MIT
 * See LICENSE.md for the full licence text.
 */

'use strict';

const { describe: suite, it: test } = require('node:test');
const strictAssert = require('node:assert/strict');
const assert = {
  isTrue: (value) => strictAssert.equal(value, true),
  isFalse: (value) => strictAssert.equal(value, false)
};
const isEqual = require('./helpers/api').isEqual;
const data = require('./data/test-data');

suite('#isEqual', function () {
  // ---------------------------------------------------------------------
  // Primitive values
  // ---------------------------------------------------------------------

  test('returns true for equal primitive values', function () {
    assert.isTrue(isEqual(undefined, undefined));
    assert.isTrue(isEqual(null, null));
    assert.isTrue(isEqual(true, true));
    assert.isTrue(isEqual(false, false));
    assert.isTrue(isEqual(1, 1));
    assert.isTrue(isEqual(-0, +0));
    assert.isTrue(isEqual(Infinity, Infinity));
    assert.isTrue(isEqual(NaN, NaN));
    assert.isTrue(isEqual('abc', 'abc'));
    assert.isTrue(isEqual(BigInt(1), BigInt(1)));
    assert.isTrue(isEqual(data.symbol1, data.symbol1));
  });

  test('returns false for non-equal primitive values', function () {
    assert.isFalse(isEqual(undefined, null));
    assert.isFalse(isEqual(null, undefined));
    assert.isFalse(isEqual(true, false));
    assert.isFalse(isEqual(false, 0));
    assert.isFalse(isEqual(true, 1));
    assert.isFalse(isEqual(true, 'true'));
    assert.isFalse(isEqual(0, 0.00000000000001));
    assert.isFalse(isEqual(1, BigInt(1)));
    assert.isFalse(isEqual(1, '1'));
    assert.isFalse(isEqual(0, ''));
    assert.isFalse(isEqual('', ' '));
    assert.isFalse(isEqual(data.symbol1, data.symbol2));
  });

  // ---------------------------------------------------------------------
  // Boxed primitives & primitive/boxed combinations
  // ---------------------------------------------------------------------

  test('returns true for equal boxed primitive objects', function () {
    assert.isTrue(isEqual(new Boolean(true), new Boolean(true)));
    assert.isTrue(isEqual(new Number(1), new Number(1)));
    assert.isTrue(isEqual(new String('abc'), new String('abc')));
    // boxed NaN vs boxed NaN should also be considered equal
    assert.isTrue(isEqual(new Number(NaN), new Number(NaN)));
  });

  test('returns false for non-equal boxed primitive objects', function () {
    // different underlying primitive values
    assert.isFalse(isEqual(new Number(1), new Number(2)));
    assert.isFalse(isEqual(new String('1'), new String('2')));
    assert.isFalse(isEqual(new Boolean(true), new Boolean(false)));

    // boxed NaN vs boxed non-NaN
    assert.isFalse(isEqual(new Number(NaN), new Number(1)));
    assert.isFalse(isEqual(new Number(NaN), new Number(Infinity)));

    // cross-type wrappers
    assert.isFalse(isEqual(new Number(1), new String('1')));
    assert.isFalse(isEqual(new Boolean(true), new Number(1)));
  });

  test('returns true for equal primitive vs boxed primitive values', function () {
    assert.isTrue(isEqual(1, new Number(1)));
    assert.isTrue(isEqual(new Number(1), 1));

    assert.isTrue(isEqual(NaN, new Number(NaN)));
    assert.isTrue(isEqual(new Number(NaN), NaN));

    assert.isTrue(isEqual('abc', new String('abc')));
    assert.isTrue(isEqual(new String('abc'), 'abc'));

    assert.isTrue(isEqual(true, new Boolean(true)));
    assert.isTrue(isEqual(new Boolean(true), true));
  });

  test('returns false for non-equal primitive vs boxed primitive values', function () {
    // number vs Number
    assert.isFalse(isEqual(1, new Number(-1)));
    assert.isFalse(isEqual(new Number(-1), 1));

    // string vs String
    assert.isFalse(isEqual(1, new String('1')));
    assert.isFalse(isEqual(new String('1'), 1));
    assert.isFalse(isEqual('', new String(' ')));
    assert.isFalse(isEqual(new String(' '), ''));

    // boolean vs Boolean
    assert.isFalse(isEqual(true, new Boolean(false)));
    assert.isFalse(isEqual(new Boolean(false), true));

    // boolean vs String
    assert.isFalse(isEqual(true, new String('true')));
    assert.isFalse(isEqual(new String('true'), true));

    // boolean vs Number
    assert.isFalse(isEqual(false, new Number(0)));
    assert.isFalse(isEqual(new Number(0), false));

    // NaN vs boxed non-NaN values
    assert.isFalse(isEqual(NaN, new Number(1)));
    assert.isFalse(isEqual(new Number(1), NaN));
  });

  // ---------------------------------------------------------------------
  // Plain objects, arrays, functions & circular structures
  // ---------------------------------------------------------------------

  test('returns true for strictly equal object references', function () {
    const obj = {};
    assert.isTrue(isEqual(obj, obj));
    assert.isTrue(isEqual(data.fn1, data.fn1));
  });

  test('returns true for deeply equal plain objects and arrays', function () {
    assert.isTrue(isEqual([], []));
    assert.isTrue(isEqual([1, 2, 3], [1, 2, 3]));
    assert.isTrue(isEqual([[false], [1, 2], ['a', 'b', 'c']], [[false], [1, 2], ['a', 'b', 'c']]));

    assert.isTrue(isEqual({}, {}));
    assert.isTrue(isEqual({ a: 1, b: 'abc', c: true }, { a: 1, b: 'abc', c: true }));

    // property order should not matter
    assert.isTrue(isEqual({ a: 1, b: 'abc', c: true }, { b: 'abc', a: 1, c: true }));

    // boxed values inside objects/arrays
    assert.isTrue(
      isEqual(
        { a: 1, b: 'abc', c: true },
        {
          a: new Number(1),
          b: new String('abc'),
          c: new Boolean(true)
        }
      )
    );
    assert.isTrue(isEqual([{ a: 1 }, { b: true }], [{ a: new Number(1) }, { b: new Boolean(true) }]));
  });

  test('returns true for equal custom entities and circular structures (from test data)', function () {
    assert.isTrue(isEqual(data.entity1, data.entity2));
    assert.isTrue(isEqual(data.entity2, data.entity1));
    assert.isTrue(isEqual(data.cyclic1, data.cyclic2));
    assert.isTrue(isEqual(data.cyclic4, data.cyclic5));
  });

  test('returns false for non-equal objects/arrays/functions', function () {
    assert.isFalse(isEqual([], [undefined]));
    assert.isFalse(isEqual([1, 2, 3], [3, 2, 1]));
    assert.isFalse(isEqual({}, { a: undefined }));
    assert.isFalse(isEqual({ a: null }, { a: undefined }));
    assert.isFalse(isEqual({ a: 1 }, { b: 1 }));

    // different function references should not be equal
    assert.isFalse(
      isEqual(
        function () {},
        function () {}
      )
    );

    // test data objects
    assert.isFalse(isEqual(data.entity1, data.entity3));
    assert.isFalse(isEqual(data.entity3, data.entity1));
    assert.isFalse(isEqual(data.item1, data.entity1));
    assert.isFalse(isEqual(data.item1, { name: 1 }));
    assert.isFalse(isEqual(data.fn1, data.fn2));
    assert.isFalse(isEqual(data.fn1, data.fn3));

    // circular structures: non-equal variants
    assert.isFalse(isEqual(data.cyclic1, data.cyclic3));
    assert.isFalse(isEqual(data.cyclic4, data.cyclic6));
    assert.isFalse(isEqual(data.cyclic5, data.cyclic6));
  });

  // ---------------------------------------------------------------------
  // Arguments objects
  // ---------------------------------------------------------------------

  function getArgs() {
    return arguments;
  }

  test('treats arguments objects with same contents as equal', function () {
    const a1 = getArgs(1, 2, 3);
    const a2 = getArgs(1, 2, 3);
    assert.isTrue(isEqual(a1, a2));
  });

  test('treats arguments objects with different contents as not equal', function () {
    const a1 = getArgs(1, 2, 3);
    const a2 = getArgs(1, 2);
    assert.isFalse(isEqual(a1, a2));
  });

  // ---------------------------------------------------------------------
  // Date
  // ---------------------------------------------------------------------

  test('returns true for equal Date values', function () {
    const d1 = new Date('2020-01-01T00:00:00.000Z');
    const d2 = new Date('2020-01-01T00:00:00.000Z');
    assert.isTrue(isEqual(d1, d2));
  });

  test('returns false for non-equal Date values', function () {
    const d1 = new Date('2020-01-01T00:00:00.000Z');
    const d2 = new Date('2020-01-02T00:00:00.000Z');
    assert.isFalse(isEqual(d1, d2));
  });

  // ---------------------------------------------------------------------
  // RegExp
  // ---------------------------------------------------------------------

  test('returns true for equal RegExp values', function () {
    const r1 = /abc/gi;
    const r2 = new RegExp('abc', 'gi');
    assert.isTrue(isEqual(r1, r2));
  });

  test('returns false for non-equal RegExp values', function () {
    assert.isFalse(isEqual(/abc/g, /abc/i));
    assert.isFalse(isEqual(/abc/g, /abcd/g));
  });

  // ---------------------------------------------------------------------
  // Map
  // ---------------------------------------------------------------------

  test('returns true for equal Map instances with primitive keys', function () {
    if (typeof Map === 'undefined') {
      this.skip();
    }

    const m1 = new Map();
    m1.set('a', 1);
    m1.set('b', 2);

    const m2 = new Map();
    m2.set('a', 1);
    m2.set('b', 2);

    // insertion order shouldn't matter
    const m3 = new Map();
    m3.set('b', 2);
    m3.set('a', 1);

    assert.isTrue(isEqual(m1, m2));
    assert.isTrue(isEqual(m1, m3));
  });

  test('returns true for equal Map instances with deep object keys/values', function () {
    if (typeof Map === 'undefined') {
      this.skip();
    }

    const k1 = { id: 1 };
    const k2 = { id: 1 };

    const m1 = new Map([[k1, { value: 10 }]]);
    const m2 = new Map([[k2, { value: 10 }]]);

    assert.isTrue(isEqual(m1, m2));
  });

  test('returns false for non-equal Map instances', function () {
    if (typeof Map === 'undefined') {
      this.skip();
    }

    const m1 = new Map([
      ['a', 1],
      ['b', 2]
    ]);
    const m2 = new Map([
      ['a', 1],
      ['b', 3]
    ]);
    const m3 = new Map([['a', 1]]);
    const m4 = new Map([['c', 1]]);

    assert.isFalse(isEqual(m1, m2)); // different value
    assert.isFalse(isEqual(m1, m3)); // different size
    assert.isFalse(isEqual(m1, m4)); // different keys
  });

  // ---------------------------------------------------------------------
  // Set
  // ---------------------------------------------------------------------

  test('returns true for equal Set instances with primitive values', function () {
    if (typeof Set === 'undefined') {
      this.skip();
    }

    const s1 = new Set([1, 2, 3]);
    const s2 = new Set([3, 2, 1]);

    assert.isTrue(isEqual(s1, s2));
  });

  test('returns true for equal Set instances with deep object values', function () {
    if (typeof Set === 'undefined') {
      this.skip();
    }

    const s1 = new Set([{ id: 1 }, { id: 2 }]);
    const s2 = new Set([{ id: 2 }, { id: 1 }]);

    assert.isTrue(isEqual(s1, s2));
  });

  test('returns false for non-equal Set instances', function () {
    if (typeof Set === 'undefined') {
      this.skip();
    }

    const s1 = new Set([1, 2, 3]);
    const s2 = new Set([1, 2]);
    const s3 = new Set([1, 2, 4]);

    assert.isFalse(isEqual(s1, s2)); // different size
    assert.isFalse(isEqual(s1, s3)); // different values
  });

  // ---------------------------------------------------------------------
  // ArrayBuffer, TypedArrays, DataView
  // ---------------------------------------------------------------------

  test('returns true for equal ArrayBuffer instances', function () {
    if (typeof ArrayBuffer === 'undefined') {
      this.skip();
    }

    const ab1 = new ArrayBuffer(4);
    const ab2 = new ArrayBuffer(4);

    const v1 = new Uint8Array(ab1);
    const v2 = new Uint8Array(ab2);

    v1.set([1, 2, 3, 4]);
    v2.set([1, 2, 3, 4]);

    assert.isTrue(isEqual(ab1, ab2));
  });

  test('returns false for non-equal ArrayBuffer instances', function () {
    if (typeof ArrayBuffer === 'undefined') {
      this.skip();
    }

    const ab1 = new ArrayBuffer(4);
    const ab2 = new ArrayBuffer(4);

    const v1 = new Uint8Array(ab1);
    const v2 = new Uint8Array(ab2);

    v1.set([1, 2, 3, 4]);
    v2.set([1, 2, 3, 5]);

    assert.isFalse(isEqual(ab1, ab2));
  });

  test('returns true for equal TypedArray instances', function () {
    if (typeof Uint8Array === 'undefined') {
      this.skip();
    }

    const t1 = new Uint8Array([1, 2, 3]);
    const t2 = new Uint8Array([1, 2, 3]);

    assert.isTrue(isEqual(t1, t2));
  });

  test('returns false for non-equal TypedArray instances', function () {
    if (typeof Uint8Array === 'undefined') {
      this.skip();
    }

    const t1 = new Uint8Array([1, 2, 3]);
    const t2 = new Uint8Array([1, 2, 4]);

    assert.isFalse(isEqual(t1, t2));
  });

  test('returns true for equal DataView instances over equal buffers', function () {
    if (typeof ArrayBuffer === 'undefined' || typeof DataView === 'undefined') {
      this.skip();
    }

    const buf1 = new ArrayBuffer(4);
    const buf2 = new ArrayBuffer(4);
    const dv1 = new DataView(buf1);
    const dv2 = new DataView(buf2);

    dv1.setUint8(0, 10);
    dv1.setUint8(1, 20);

    dv2.setUint8(0, 10);
    dv2.setUint8(1, 20);

    assert.isTrue(isEqual(dv1, dv2));
  });

  test('returns false for non-equal DataView instances', function () {
    if (typeof ArrayBuffer === 'undefined' || typeof DataView === 'undefined') {
      this.skip();
    }

    const buf1 = new ArrayBuffer(4);
    const buf2 = new ArrayBuffer(4);
    const dv1 = new DataView(buf1);
    const dv2 = new DataView(buf2);

    dv1.setUint8(0, 10);
    dv2.setUint8(0, 11);

    assert.isFalse(isEqual(dv1, dv2));
  });

  // ---------------------------------------------------------------------
  // Cross-type inequality checks
  // ---------------------------------------------------------------------

  test('returns false when comparing different built-in types', function () {
    if (typeof Map !== 'undefined' && typeof Set !== 'undefined') {
      assert.isFalse(isEqual(new Map(), new Set()));
    }

    assert.isFalse(isEqual(new Date(), {}));
    assert.isFalse(isEqual(/abc/, 'abc'));
    assert.isFalse(isEqual(new Date(), Number(new Date().getTime())));
    assert.isFalse(isEqual([], {}));

    if (typeof Map !== 'undefined') {
      assert.isFalse(isEqual(new Map(), {}));
    }
    if (typeof Set !== 'undefined') {
      assert.isFalse(isEqual(new Set(), []));
    }
  });
});
