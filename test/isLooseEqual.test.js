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
const isLooseEqual = require('./helpers/api').isLooseEqual;
const data = require('./data/test-data');

suite('#isLooseEqual', function () {
  // -------------------------------------------------------------------------
  // Primitive values (loose semantics)
  // -------------------------------------------------------------------------

  test('returns true for equal primitive values (including loose matches)', function () {
    // Strictly equal cases
    assert.isTrue(isLooseEqual(undefined, undefined));
    assert.isTrue(isLooseEqual(null, null));
    assert.isTrue(isLooseEqual(true, true));
    assert.isTrue(isLooseEqual(1, 1));
    assert.isTrue(isLooseEqual(-0, +0));
    assert.isTrue(isLooseEqual(Infinity, Infinity));
    assert.isTrue(isLooseEqual(NaN, NaN));
    assert.isTrue(isLooseEqual('abc', 'abc'));
    assert.isTrue(isLooseEqual(BigInt(1), BigInt(1)));
    assert.isTrue(isLooseEqual(data.symbol1, data.symbol1));

    // Loose-equal primitives
    assert.isTrue(isLooseEqual(undefined, null));
    assert.isTrue(isLooseEqual(null, undefined));
    assert.isTrue(isLooseEqual(false, 0));
    assert.isTrue(isLooseEqual(true, 1));
    assert.isTrue(isLooseEqual(1, '1'));
    assert.isTrue(isLooseEqual(0, ''));
    // BigInt/Number loose equality (custom semantics)
    assert.isTrue(isLooseEqual(1, BigInt(1)));
    assert.isTrue(isLooseEqual(BigInt(1), 1));
  });

  test('returns false for non-equal primitive values', function () {
    assert.isFalse(isLooseEqual(true, false));
    assert.isFalse(isLooseEqual(false, undefined));
    assert.isFalse(isLooseEqual(false, null));
    assert.isFalse(isLooseEqual(false, 'false'));
    assert.isFalse(isLooseEqual(true, 'true'));
    assert.isFalse(isLooseEqual(0, 0.00000000000001));
    assert.isFalse(isLooseEqual('', ' '));
    assert.isFalse(isLooseEqual(data.symbol1, data.symbol2));
    // BigInt mismatches
    assert.isFalse(isLooseEqual(BigInt(1), BigInt(2)));
    assert.isFalse(isLooseEqual(BigInt(1), 2));
  });

  // -------------------------------------------------------------------------
  // Boxed primitives & primitive/boxed combinations
  // -------------------------------------------------------------------------

  test('returns true for equal boxed primitive objects', function () {
    assert.isTrue(isLooseEqual(new Boolean(true), new Boolean(true)));
    assert.isTrue(isLooseEqual(new Number(1), new Number(1)));
    assert.isTrue(isLooseEqual(new String('abc'), new String('abc')));
    // boxed NaN vs boxed NaN should also be equal
    assert.isTrue(isLooseEqual(new Number(NaN), new Number(NaN)));
  });

  test('returns false for non-equal boxed primitive objects', function () {
    // different underlying primitive values
    assert.isFalse(isLooseEqual(new Number(1), new Number(2)));
    assert.isFalse(isLooseEqual(new String('1'), new String('2')));
    assert.isFalse(isLooseEqual(new Boolean(true), new Boolean(false)));

    // boxed NaN vs boxed non-NaN
    assert.isFalse(isLooseEqual(new Number(NaN), new Number(1)));
    assert.isFalse(isLooseEqual(new Number(1), new Number(NaN)));
  });

  test('normalizes both sides of cross-type wrappers (v2 correction)', function () {
    assert.isTrue(isLooseEqual(new Number(1), new String('1')));
    assert.isTrue(isLooseEqual(new Boolean(true), new Number(1)));
  });

  test('returns true for equal primitive vs boxed primitive values (loose)', function () {
    // number <-> Number
    assert.isTrue(isLooseEqual(1, new Number(1)));
    assert.isTrue(isLooseEqual(new Number(1), 1));

    // NaN <-> Number(NaN)
    assert.isTrue(isLooseEqual(NaN, new Number(NaN)));
    assert.isTrue(isLooseEqual(new Number(NaN), NaN));

    // string <-> String
    assert.isTrue(isLooseEqual(1, new String('1')));
    assert.isTrue(isLooseEqual(new String('1'), 1));
    assert.isTrue(isLooseEqual('abc', new String('abc')));
    assert.isTrue(isLooseEqual(new String('abc'), 'abc'));

    // boolean <-> Boolean
    assert.isTrue(isLooseEqual(true, new Boolean(true)));
    assert.isTrue(isLooseEqual(new Boolean(true), true));

    // boolean/number loose equality via wrapper
    assert.isTrue(isLooseEqual(false, new Number(0)));
    assert.isTrue(isLooseEqual(new Number(0), false));
  });

  test('returns false for non-equal primitive vs boxed primitive values', function () {
    // number vs Number
    assert.isFalse(isLooseEqual(1, new Number(-1)));
    assert.isFalse(isLooseEqual(new Number(-1), 1));

    // string vs String
    assert.isFalse(isLooseEqual('', new String(' ')));
    assert.isFalse(isLooseEqual(new String(' '), ''));

    // boolean vs Boolean
    assert.isFalse(isLooseEqual(true, new Boolean(false)));
    assert.isFalse(isLooseEqual(new Boolean(false), true));

    // boolean vs String
    assert.isFalse(isLooseEqual(true, new String('true')));
    assert.isFalse(isLooseEqual(new String('true'), true));

    // NaN vs boxed non-NaN values
    assert.isFalse(isLooseEqual(NaN, new Number(1)));
    assert.isFalse(isLooseEqual(new Number(1), NaN));
  });

  // -------------------------------------------------------------------------
  // Plain objects, arrays, functions & circular structures
  // -------------------------------------------------------------------------

  test('returns true for strictly equal object references', function () {
    const obj = {};
    assert.isTrue(isLooseEqual(obj, obj));
    assert.isTrue(isLooseEqual(data.fn1, data.fn1));
  });

  test('returns true for deeply equal plain objects and arrays (loose semantics)', function () {
    assert.isTrue(isLooseEqual([], []));
    assert.isTrue(isLooseEqual([1, 2, 3], [1, 2, 3]));
    assert.isTrue(isLooseEqual([[false], [1, 2], ['a', 'b', 'c']], [[false], [1, 2], ['a', 'b', 'c']]));

    assert.isTrue(isLooseEqual({}, {}));

    // null vs undefined treated as loose-equal
    assert.isTrue(isLooseEqual({ a: null }, { a: undefined }));

    assert.isTrue(isLooseEqual({ a: 1, b: 'abc', c: true }, { a: 1, b: 'abc', c: true }));

    // property order should not matter
    assert.isTrue(isLooseEqual({ a: 1, b: 'abc', c: true }, { b: 'abc', a: 1, c: true }));

    // boxed values inside objects/arrays (loose)
    assert.isTrue(
      isLooseEqual(
        { a: 1, b: 'abc', c: true },
        {
          a: new Number(1),
          b: new String('abc'),
          c: new Boolean(true)
        }
      )
    );
    assert.isTrue(isLooseEqual([{ a: 1 }, { b: true }], [{ a: new Number(1) }, { b: new Boolean(true) }]));
  });

  test('returns true for loose-equal custom entities and circular structures (from test data)', function () {
    // strict-like entity equality
    assert.isTrue(isLooseEqual(data.entity1, data.entity2));
    assert.isTrue(isLooseEqual(data.entity2, data.entity1));

    // cyclic equal (same as isEqual)
    assert.isTrue(isLooseEqual(data.cyclic1, data.cyclic2));
    assert.isTrue(isLooseEqual(data.cyclic4, data.cyclic5));

    // additional loose-equal cyclic cases
    assert.isTrue(isLooseEqual(data.cyclic1, data.cyclic3));
    assert.isTrue(isLooseEqual(data.cyclic4, data.cyclic6));
    assert.isTrue(isLooseEqual(data.cyclic5, data.cyclic6));
  });

  test('returns false for non-equal objects/arrays/functions', function () {
    assert.isFalse(isLooseEqual([], [undefined]));
    assert.isFalse(isLooseEqual([1, 2, 3], [3, 2, 1]));
    assert.isFalse(isLooseEqual({}, { a: undefined }));
    assert.isFalse(isLooseEqual({ a: 1 }, { b: 1 }));

    // different function references should not be equal
    assert.isFalse(isLooseEqual(data.fn1, data.fn2));
    assert.isFalse(isLooseEqual(data.fn1, data.fn3));

    // test data objects
    assert.isFalse(isLooseEqual(data.entity1, data.entity3));
    assert.isFalse(isLooseEqual(data.entity3, data.entity1));

    // same properties, but different constructors
    assert.isFalse(isLooseEqual(data.item1, data.entity1));
  });

  // -------------------------------------------------------------------------
  // Arguments objects
  // -------------------------------------------------------------------------

  function getArgs() {
    return arguments;
  }

  test('treats arguments objects with same contents as loose-equal', function () {
    const a1 = getArgs(1, '2', 3);
    const a2 = getArgs('1', 2, 3);
    // 1 vs "1" and "2" vs 2 should be loose-equal
    assert.isTrue(isLooseEqual(a1, a2));
  });

  test('treats arguments objects with different contents as not equal', function () {
    const a1 = getArgs(1, 2, 3);
    const a2 = getArgs(1, 2);
    assert.isFalse(isLooseEqual(a1, a2));
  });

  // -------------------------------------------------------------------------
  // Date
  // -------------------------------------------------------------------------

  test('returns true for equal Date values', function () {
    const d1 = new Date('2020-01-01T00:00:00.000Z');
    const d2 = new Date('2020-01-01T00:00:00.000Z');
    assert.isTrue(isLooseEqual(d1, d2));
  });

  test('returns false for non-equal Date values', function () {
    const d1 = new Date('2020-01-01T00:00:00.000Z');
    const d2 = new Date('2020-01-02T00:00:00.000Z');
    assert.isFalse(isLooseEqual(d1, d2));
  });

  // -------------------------------------------------------------------------
  // RegExp
  // -------------------------------------------------------------------------

  test('returns true for equal RegExp values', function () {
    const r1 = /abc/gi;
    const r2 = new RegExp('abc', 'gi');
    assert.isTrue(isLooseEqual(r1, r2));
  });

  test('returns false for non-equal RegExp values', function () {
    assert.isFalse(isLooseEqual(/abc/g, /abc/i));
    assert.isFalse(isLooseEqual(/abc/g, /abcd/g));
  });

  // -------------------------------------------------------------------------
  // Map (including loose key/value equality)
  // -------------------------------------------------------------------------

  test('returns true for equal Map instances with primitive keys and values', function () {
    if (typeof Map === 'undefined') {
      this.skip();
    }

    const m1 = new Map();
    m1.set('a', 1);
    m1.set('b', '2');

    const m2 = new Map();
    m2.set('a', '1');
    m2.set('b', 2);

    // Loose 1 vs "1", "2" vs 2
    assert.isTrue(isLooseEqual(m1, m2));
  });

  test('returns true for equal Map instances with deep object keys/values (loose)', function () {
    if (typeof Map === 'undefined') {
      this.skip();
    }

    const k1 = { id: 1 };
    const k2 = { id: '1' };

    const m1 = new Map([[k1, { value: 10 }]]);
    const m2 = new Map([[k2, { value: '10' }]]);

    assert.isTrue(isLooseEqual(m1, m2));
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

    assert.isFalse(isLooseEqual(m1, m2)); // different value
    assert.isFalse(isLooseEqual(m1, m3)); // different size
    assert.isFalse(isLooseEqual(m1, m4)); // different keys
  });

  // -------------------------------------------------------------------------
  // Set (including loose value equality)
  // -------------------------------------------------------------------------

  test('returns true for equal Set instances with primitive values (loose)', function () {
    if (typeof Set === 'undefined') {
      this.skip();
    }

    const s1 = new Set([1, '2', 3]);
    const s2 = new Set(['1', 2, 3]);

    assert.isTrue(isLooseEqual(s1, s2));
  });

  test('returns true for equal Set instances with deep object values (loose)', function () {
    if (typeof Set === 'undefined') {
      this.skip();
    }

    const s1 = new Set([{ id: 1 }, { id: '2' }]);
    const s2 = new Set([{ id: '1' }, { id: 2 }]);

    assert.isTrue(isLooseEqual(s1, s2));
  });

  test('returns false for non-equal Set instances', function () {
    if (typeof Set === 'undefined') {
      this.skip();
    }

    const s1 = new Set([1, 2, 3]);
    const s2 = new Set([1, 2]);
    const s3 = new Set([1, 2, 4]);

    assert.isFalse(isLooseEqual(s1, s2)); // different size
    assert.isFalse(isLooseEqual(s1, s3)); // different values
  });

  // -------------------------------------------------------------------------
  // ArrayBuffer, TypedArrays, DataView (same semantics as strict equality)
  // -------------------------------------------------------------------------

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

    assert.isTrue(isLooseEqual(ab1, ab2));
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

    assert.isFalse(isLooseEqual(ab1, ab2));
  });

  test('returns true for equal TypedArray instances', function () {
    if (typeof Uint8Array === 'undefined') {
      this.skip();
    }

    const t1 = new Uint8Array([1, 2, 3]);
    const t2 = new Uint8Array([1, 2, 3]);

    assert.isTrue(isLooseEqual(t1, t2));
  });

  test('returns false for non-equal TypedArray instances', function () {
    if (typeof Uint8Array === 'undefined') {
      this.skip();
    }

    const t1 = new Uint8Array([1, 2, 3]);
    const t2 = new Uint8Array([1, 2, 4]);

    assert.isFalse(isLooseEqual(t1, t2));
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

    assert.isTrue(isLooseEqual(dv1, dv2));
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

    assert.isFalse(isLooseEqual(dv1, dv2));
  });

  // -------------------------------------------------------------------------
  // Cross-type inequality checks
  // -------------------------------------------------------------------------

  test('returns false when comparing incompatible built-in types', function () {
    if (typeof Map !== 'undefined' && typeof Set !== 'undefined') {
      assert.isFalse(isLooseEqual(new Map(), new Set()));
    }

    assert.isFalse(isLooseEqual(new Date(), {}));
    assert.isFalse(isLooseEqual(/abc/, 'abc'));
    assert.isFalse(isLooseEqual(new Date(), Number(new Date().getTime())));
    assert.isFalse(isLooseEqual([], {}));

    if (typeof Map !== 'undefined') {
      assert.isFalse(isLooseEqual(new Map(), {}));
    }
    if (typeof Set !== 'undefined') {
      assert.isFalse(isLooseEqual(new Set(), []));
    }
  });
});
