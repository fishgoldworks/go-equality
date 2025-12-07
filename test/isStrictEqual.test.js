/*
 * Copyright (c) 2022 Michael Ko
 *
 * This work is licensed under the GNU LGPLv3 license.
 * <https://www.gnu.org/licenses/lgpl-3.0.en.html>.
 */

/* global Infinity, NaN */

"use strict";

var assert = require("chai").assert;
var isStrictEqual = require("../src/isStrictEqual");
var data = require("./data/testData");

suite("#isStrictEqual", function () {
  // ---------------------------------------------------------------------
  // Primitive values (strict semantics)
  // ---------------------------------------------------------------------

  test("returns true for strictly equal primitive values", function () {
    assert.isTrue(isStrictEqual(undefined, undefined));
    assert.isTrue(isStrictEqual(null, null));
    assert.isTrue(isStrictEqual(true, true));
    assert.isTrue(isStrictEqual(false, false));
    assert.isTrue(isStrictEqual(1, 1));
    assert.isTrue(isStrictEqual(-0, +0));
    assert.isTrue(isStrictEqual(Infinity, Infinity));
    // custom semantics: treat NaN as strictly equal
    assert.isTrue(isStrictEqual(NaN, NaN));
    assert.isTrue(isStrictEqual("abc", "abc"));
    assert.isTrue(isStrictEqual(BigInt(1), BigInt(1)));
    assert.isTrue(isStrictEqual(data.symbol1, data.symbol1));
  });

  test("returns false for non-equal primitive values", function () {
    assert.isFalse(isStrictEqual(undefined, null));
    assert.isFalse(isStrictEqual(null, undefined));
    assert.isFalse(isStrictEqual(true, false));
    assert.isFalse(isStrictEqual(false, 0));
    assert.isFalse(isStrictEqual(true, "true"));
    assert.isFalse(isStrictEqual(0, 0.00000000000001));
    assert.isFalse(isStrictEqual(1, BigInt(1)));
    assert.isFalse(isStrictEqual(1, "1"));
    assert.isFalse(isStrictEqual(0, ""));
    assert.isFalse(isStrictEqual("", " "));
    assert.isFalse(isStrictEqual(data.symbol1, data.symbol2));
  });

  // ---------------------------------------------------------------------
  // Boxed primitives & primitive/boxed combinations
  // ---------------------------------------------------------------------

  test("returns true for equal boxed primitive objects", function () {
    assert.isTrue(isStrictEqual(new Boolean(true), new Boolean(true)));
    assert.isTrue(isStrictEqual(new Number(1), new Number(1)));
    assert.isTrue(isStrictEqual(new Number(NaN), new Number(NaN)));
    assert.isTrue(isStrictEqual(new String("abc"), new String("abc")));
  });

  test("returns false for non-equal boxed primitive objects", function () {
    // different underlying primitive values
    assert.isFalse(isStrictEqual(new Number(1), new Number(2)));
    assert.isFalse(isStrictEqual(new String("abc"), new String("abcd")));
    assert.isFalse(isStrictEqual(new Boolean(true), new Boolean(false)));

    // boxed NaN vs boxed non-NaN
    assert.isFalse(isStrictEqual(new Number(NaN), new Number(1)));
    assert.isFalse(isStrictEqual(new Number(1), new Number(NaN)));

    // cross-type wrappers
    assert.isFalse(isStrictEqual(new Number(1), new String("1")));
    assert.isFalse(isStrictEqual(new Boolean(true), new Number(1)));
  });

  test("returns false for primitive vs boxed primitive values", function () {
    // primitive vs matching boxed value
    assert.isFalse(isStrictEqual(1, new Number(1)));
    assert.isFalse(isStrictEqual(new Number(1), 1));
    assert.isFalse(isStrictEqual(NaN, new Number(NaN)));
    assert.isFalse(isStrictEqual(new Number(NaN), NaN));
    assert.isFalse(isStrictEqual("abc", new String("abc")));
    assert.isFalse(isStrictEqual(new String("abc"), "abc"));
    assert.isFalse(isStrictEqual(true, new Boolean(true)));
    assert.isFalse(isStrictEqual(new Boolean(true), true));

    // primitive vs non-matching boxed value
    assert.isFalse(isStrictEqual(1, new Number(-1)));
    assert.isFalse(isStrictEqual(new Number(-1), 1));
    assert.isFalse(isStrictEqual(1, new String("1")));
    assert.isFalse(isStrictEqual(new String("1"), 1));
    assert.isFalse(isStrictEqual("", new String(" ")));
    assert.isFalse(isStrictEqual(new String(" "), ""));
    assert.isFalse(isStrictEqual(true, new Boolean(false)));
    assert.isFalse(isStrictEqual(new Boolean(false), true));
    assert.isFalse(isStrictEqual(true, new String("true")));
    assert.isFalse(isStrictEqual(new String("true"), true));
    assert.isFalse(isStrictEqual(false, new Number(0)));
    assert.isFalse(isStrictEqual(new Number(0), false));
  });

  // ---------------------------------------------------------------------
  // Plain objects, arrays, functions & circular structures
  // ---------------------------------------------------------------------

  test("returns true for strictly equal object references", function () {
    var obj = {};
    assert.isTrue(isStrictEqual(obj, obj));
    assert.isTrue(isStrictEqual(data.fn1, data.fn1));
  });

  test("returns true for deeply equal plain objects and arrays (strict)", function () {
    assert.isTrue(isStrictEqual([], []));
    assert.isTrue(isStrictEqual([1, 2, 3], [1, 2, 3]));
    assert.isTrue(
            isStrictEqual(
                    [[false], [1, 2], ["a", "b", "c"]],
                    [[false], [1, 2], ["a", "b", "c"]]
                    )
            );

    assert.isTrue(isStrictEqual({}, {}));
    assert.isTrue(
            isStrictEqual(
                    {a: 1, b: "abc", c: true},
                    {a: 1, b: "abc", c: true}
            )
            );

    // property order should not matter
    assert.isTrue(
            isStrictEqual(
                    {a: 1, b: "abc", c: true},
                    {b: "abc", a: 1, c: true}
            )
            );
  });

  test("returns true for equal custom entities and circular structures (from test data)", function () {
    assert.isTrue(isStrictEqual(data.entity1, data.entity2));
    assert.isTrue(isStrictEqual(data.entity2, data.entity1));
    assert.isTrue(isStrictEqual(data.cyclic1, data.cyclic2));
    assert.isTrue(isStrictEqual(data.cyclic4, data.cyclic5));
  });

  test("returns false for non-equal objects/arrays/functions", function () {
    assert.isFalse(isStrictEqual([], [undefined]));
    assert.isFalse(isStrictEqual([1, 2, 3], [3, 2, 1]));
    assert.isFalse(isStrictEqual({}, {a: undefined}));
    assert.isFalse(isStrictEqual({a: 1}, {b: 1}));
    assert.isFalse(isStrictEqual({a: null}, {a: undefined}));

    // primitive vs boxed inside object
    assert.isFalse(isStrictEqual({a: true}, {a: new Boolean(true)}));
    assert.isFalse(isStrictEqual({a: new Boolean(true)}, {a: true}));

    // different function references should not be equal
    assert.isFalse(isStrictEqual(data.fn1, data.fn2));
    assert.isFalse(isStrictEqual(data.fn1, data.fn3));

    // test data objects
    assert.isFalse(isStrictEqual(data.entity1, data.entity3));
    assert.isFalse(isStrictEqual(data.entity3, data.entity1));
    assert.isFalse(isStrictEqual(data.item1, data.entity1));
    assert.isFalse(isStrictEqual(data.item1, {name: 1}));

    // circular structures: non-equal variants
    assert.isFalse(isStrictEqual(data.cyclic1, data.cyclic3));
    assert.isFalse(isStrictEqual(data.cyclic4, data.cyclic6));
    assert.isFalse(isStrictEqual(data.cyclic5, data.cyclic6));
  });

  // ---------------------------------------------------------------------
  // Arguments objects
  // ---------------------------------------------------------------------

  function getArgs() {
    return arguments;
  }

  test("treats arguments objects with same contents as strictly equal", function () {
    var a1 = getArgs(1, 2, 3);
    var a2 = getArgs(1, 2, 3);
    assert.isTrue(isStrictEqual(a1, a2));
  });

  test("treats arguments objects with different contents as not equal", function () {
    var a1 = getArgs(1, 2, 3);
    var a2 = getArgs(1, 2);
    assert.isFalse(isStrictEqual(a1, a2));
  });

  // ---------------------------------------------------------------------
  // Date
  // ---------------------------------------------------------------------

  test("returns true for equal Date values", function () {
    var d1 = new Date("2020-01-01T00:00:00.000Z");
    var d2 = new Date("2020-01-01T00:00:00.000Z");
    assert.isTrue(isStrictEqual(d1, d2));
  });

  test("returns false for non-equal Date values", function () {
    var d1 = new Date("2020-01-01T00:00:00.000Z");
    var d2 = new Date("2020-01-02T00:00:00.000Z");
    assert.isFalse(isStrictEqual(d1, d2));
  });

  // ---------------------------------------------------------------------
  // RegExp
  // ---------------------------------------------------------------------

  test("returns true for equal RegExp values", function () {
    var r1 = /abc/gi;
    var r2 = new RegExp("abc", "gi");
    assert.isTrue(isStrictEqual(r1, r2));
  });

  test("returns false for non-equal RegExp values", function () {
    assert.isFalse(isStrictEqual(/abc/g, /abc/i));
    assert.isFalse(isStrictEqual(/abc/g, /abcd/g));
  });

  // ---------------------------------------------------------------------
  // Map
  // ---------------------------------------------------------------------

  test("returns true for equal Map instances with primitive keys and values", function () {
    if (typeof Map === "undefined") {
      this.skip();
    }

    var m1 = new Map();
    m1.set("a", 1);
    m1.set("b", 2);

    var m2 = new Map();
    m2.set("a", 1);
    m2.set("b", 2);

    // insertion order shouldn't matter
    var m3 = new Map();
    m3.set("b", 2);
    m3.set("a", 1);

    assert.isTrue(isStrictEqual(m1, m2));
    assert.isTrue(isStrictEqual(m1, m3));
  });

  test("returns true for equal Map instances with deep object keys/values", function () {
    if (typeof Map === "undefined") {
      this.skip();
    }

    var k1 = {id: 1};
    var k2 = {id: 1};

    var m1 = new Map([[k1, {value: 10}]]);
    var m2 = new Map([[k2, {value: 10}]]);

    assert.isTrue(isStrictEqual(m1, m2));
  });

  test("returns false for non-equal Map instances", function () {
    if (typeof Map === "undefined") {
      this.skip();
    }

    var m1 = new Map([
      ["a", 1],
      ["b", 2]
    ]);
    var m2 = new Map([
      ["a", 1],
      ["b", 3]
    ]);
    var m3 = new Map([["a", 1]]);
    var m4 = new Map([["c", 1]]);

    assert.isFalse(isStrictEqual(m1, m2)); // different value
    assert.isFalse(isStrictEqual(m1, m3)); // different size
    assert.isFalse(isStrictEqual(m1, m4)); // different keys
  });

  // ---------------------------------------------------------------------
  // Set
  // ---------------------------------------------------------------------

  test("returns true for equal Set instances with primitive values", function () {
    if (typeof Set === "undefined") {
      this.skip();
    }

    var s1 = new Set([1, 2, 3]);
    var s2 = new Set([3, 2, 1]);

    assert.isTrue(isStrictEqual(s1, s2));
  });

  test("returns true for equal Set instances with deep object values", function () {
    if (typeof Set === "undefined") {
      this.skip();
    }

    var s1 = new Set([{id: 1}, {id: 2}]);
    var s2 = new Set([{id: 2}, {id: 1}]);

    assert.isTrue(isStrictEqual(s1, s2));
  });

  test("returns false for non-equal Set instances", function () {
    if (typeof Set === "undefined") {
      this.skip();
    }

    var s1 = new Set([1, 2, 3]);
    var s2 = new Set([1, 2]);
    var s3 = new Set([1, 2, 4]);

    assert.isFalse(isStrictEqual(s1, s2)); // different size
    assert.isFalse(isStrictEqual(s1, s3)); // different values
  });

  // ---------------------------------------------------------------------
  // ArrayBuffer, TypedArrays, DataView
  // ---------------------------------------------------------------------

  test("returns true for equal ArrayBuffer instances", function () {
    if (typeof ArrayBuffer === "undefined") {
      this.skip();
    }

    var ab1 = new ArrayBuffer(4);
    var ab2 = new ArrayBuffer(4);

    var v1 = new Uint8Array(ab1);
    var v2 = new Uint8Array(ab2);

    v1.set([1, 2, 3, 4]);
    v2.set([1, 2, 3, 4]);

    assert.isTrue(isStrictEqual(ab1, ab2));
  });

  test("returns false for non-equal ArrayBuffer instances", function () {
    if (typeof ArrayBuffer === "undefined") {
      this.skip();
    }

    var ab1 = new ArrayBuffer(4);
    var ab2 = new ArrayBuffer(4);

    var v1 = new Uint8Array(ab1);
    var v2 = new Uint8Array(ab2);

    v1.set([1, 2, 3, 4]);
    v2.set([1, 2, 3, 5]);

    assert.isFalse(isStrictEqual(ab1, ab2));
  });

  test("returns true for equal TypedArray instances", function () {
    if (typeof Uint8Array === "undefined") {
      this.skip();
    }

    var t1 = new Uint8Array([1, 2, 3]);
    var t2 = new Uint8Array([1, 2, 3]);

    assert.isTrue(isStrictEqual(t1, t2));
  });

  test("returns false for non-equal TypedArray instances", function () {
    if (typeof Uint8Array === "undefined") {
      this.skip();
    }

    var t1 = new Uint8Array([1, 2, 3]);
    var t2 = new Uint8Array([1, 2, 4]);

    assert.isFalse(isStrictEqual(t1, t2));
  });

  test("returns true for equal DataView instances over equal buffers", function () {
    if (typeof ArrayBuffer === "undefined" || typeof DataView === "undefined") {
      this.skip();
    }

    var buf1 = new ArrayBuffer(4);
    var buf2 = new ArrayBuffer(4);
    var dv1 = new DataView(buf1);
    var dv2 = new DataView(buf2);

    dv1.setUint8(0, 10);
    dv1.setUint8(1, 20);

    dv2.setUint8(0, 10);
    dv2.setUint8(1, 20);

    assert.isTrue(isStrictEqual(dv1, dv2));
  });

  test("returns false for non-equal DataView instances", function () {
    if (typeof ArrayBuffer === "undefined" || typeof DataView === "undefined") {
      this.skip();
    }

    var buf1 = new ArrayBuffer(4);
    var buf2 = new ArrayBuffer(4);
    var dv1 = new DataView(buf1);
    var dv2 = new DataView(buf2);

    dv1.setUint8(0, 10);
    dv2.setUint8(0, 11);

    assert.isFalse(isStrictEqual(dv1, dv2));
  });

  // ---------------------------------------------------------------------
  // Cross-type inequality checks
  // ---------------------------------------------------------------------

  test("returns false when comparing different built-in types", function () {
    if (typeof Map !== "undefined" && typeof Set !== "undefined") {
      assert.isFalse(isStrictEqual(new Map(), new Set()));
    }

    assert.isFalse(isStrictEqual(new Date(), {}));
    assert.isFalse(isStrictEqual(/abc/, "abc"));
    assert.isFalse(isStrictEqual(new Date(), Number(new Date().getTime())));
    assert.isFalse(isStrictEqual([], {}));

    if (typeof Map !== "undefined") {
      assert.isFalse(isStrictEqual(new Map(), {}));
    }
    if (typeof Set !== "undefined") {
      assert.isFalse(isStrictEqual(new Set(), []));
    }
  });
});