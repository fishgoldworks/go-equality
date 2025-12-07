/*
 * Copyright (c) 2022 Michael Ko
 * 
 * This work is licensed under the GNU LGPLv3 license.
 * <https://www.gnu.org/licenses/lgpl-3.0.en.html>.
 */

/* global Infinity, NaN */

"use strict";

var assert = require("chai").assert;
var areEqualObjects = require("../src/areEqualObjects");
var data = require("./data/testData");

// Internal equality checker used for recursion in these tests.
// - Primitives: strict equality only
// - Objects: defer to areEqualObjects with the same checker
var equalityChecker = function (val, other, stack) {
  if (val === other) {
    return true;
  } else if (val instanceof Object && other instanceof Object) {
    return areEqualObjects(val, other, stack, equalityChecker);
  }
  return false;
};

// Convenience wrapper that always passes a fresh stack.
var areEqualObjs = function (obj, otherObj) {
  return areEqualObjects(obj, otherObj, [], equalityChecker);
};

suite("#areEqualObjects", function () {

  suite("primitive and non-object-like values", function () {
    test("returns true for strictly equal primitive values", function () {
      assert.isTrue(areEqualObjs(undefined, undefined));
      assert.isTrue(areEqualObjs(null, null));
      assert.isTrue(areEqualObjs(true, true));
      assert.isTrue(areEqualObjs(false, false));
      assert.isTrue(areEqualObjs(1, 1));
      assert.isTrue(areEqualObjs("abc", "abc"));

      // Strict primitive behaviour: NaN !== NaN here (no special-casing)
      assert.isFalse(areEqualObjs(NaN, NaN));

      // BigInt & Symbol: strict primitive behaviour
      assert.isTrue(areEqualObjs(BigInt(1), BigInt(1)));
      assert.isFalse(areEqualObjs(BigInt(1), BigInt(2)));
      assert.isTrue(areEqualObjs(data.symbol1, data.symbol1));
      assert.isFalse(areEqualObjs(data.symbol1, data.symbol2));
    });

    test("returns false when one side is null/undefined and the other is not", function () {
      assert.isFalse(areEqualObjs(null, undefined));
      assert.isFalse(areEqualObjs(undefined, null));
      assert.isFalse(areEqualObjs(null, {}));
      assert.isFalse(areEqualObjs({}, null));
    });

    test("returns false for non-strictly equal primitives", function () {
      assert.isFalse(areEqualObjs(1, "1"));
      assert.isFalse(areEqualObjs(0, false));
      assert.isFalse(areEqualObjs("", 0));
    });

    test("returns false for primitive vs boxed primitive at top level", function () {
      // areEqualObjects is an object comparer; it does not unwrap primitives
      assert.isFalse(areEqualObjs(1, new Number(1)));
      assert.isFalse(areEqualObjs(new Number(1), 1));

      assert.isFalse(areEqualObjs("abc", new String("abc")));
      assert.isFalse(areEqualObjs(new String("abc"), "abc"));

      assert.isFalse(areEqualObjs(true, new Boolean(true)));
      assert.isFalse(areEqualObjs(new Boolean(true), true));
    });
  });

  suite("plain objects and arrays", function () {
    test("equal plain objects and arrays with same structure and values", function () {
      var obj = {};
      assert.isTrue(areEqualObjs(obj, obj));

      assert.isTrue(areEqualObjs(data.entity1, data.entity2));

      assert.isTrue(areEqualObjs([], []));
      assert.isTrue(areEqualObjs([1, 2, 3], [1, 2, 3]));
      assert.isTrue(
              areEqualObjs(
                      [[false], [1, 2], ["a", "b", "c"]],
                      [[false], [1, 2], ["a", "b", "c"]]
                      )
              );

      assert.isTrue(areEqualObjs({}, {}));
      assert.isTrue(
              areEqualObjs(
                      {a: 1, b: "abc", c: true},
                      {a: 1, b: "abc", c: true}
              )
              );
      assert.isTrue(
              areEqualObjs(
                      {a: 1, b: "abc", c: true},
                      {b: "abc", a: 1, c: true} // different key order
              )
              );
    });

    test("not equal when structure or keys differ", function () {
      assert.isFalse(areEqualObjs([], [undefined]));
      assert.isFalse(areEqualObjs([1, 2, 3], [3, 2, 1]));

      assert.isFalse(areEqualObjs({}, {a: undefined}));
      assert.isFalse(areEqualObjs({a: 1}, {b: 1}));
      assert.isFalse(areEqualObjs({a: null}, {a: undefined}));

      // Boxed vs primitive values are not treated as equal here
      assert.isFalse(areEqualObjs({a: 1}, {a: new Number(1)}));
      assert.isFalse(areEqualObjs({b: "abc"}, {b: new String("abc")}));
      assert.isFalse(areEqualObjs({c: true}, {c: new Boolean(true)}));
    });

    test("arguments objects are treated like arrays", function () {
      function getArgs() {
        return arguments;
      }

      var args1 = getArgs(1, 2, 3);
      var args2 = getArgs(1, 2, 3);
      var args3 = getArgs(1, 2, 3, 4);

      assert.isTrue(areEqualObjs(args1, args2));
      assert.isFalse(areEqualObjs(args1, args3));
    });
  });

  suite("boxed primitives and constructor / tag checks", function () {
    test("boxed primitives of same type and value are equal", function () {
      assert.isTrue(areEqualObjs(new Boolean(true), new Boolean(true)));
      assert.isTrue(areEqualObjs(new Number(1), new Number(1)));
      assert.isTrue(areEqualObjs(new String("abc"), new String("abc")));
    });

    test("boxed primitives with different value or type are not equal", function () {
      assert.isFalse(areEqualObjs(new Number(1), new Number(2)));
      assert.isFalse(areEqualObjs(new String("1"), new String("2")));
      assert.isFalse(areEqualObjs(new Boolean(true), new Boolean(false)));

      // Different constructors / tags
      assert.isFalse(areEqualObjs(new Number(1), new String("1")));
    });

    test("objects with different constructors are not equal even if shape matches", function () {
      function Custom() {
        this.a = 1;
      }
      var plain = {a: 1};
      var custom = new Custom();

      assert.isFalse(areEqualObjs(plain, custom));
      assert.isFalse(areEqualObjs(custom, plain));
    });
  });

  suite("functions", function () {
    test("same function reference is equal", function () {
      assert.isTrue(areEqualObjs(data.fn1, data.fn1));
    });

    test("different function instances are not equal", function () {
      assert.isFalse(areEqualObjs(function () {}, function () {}));
      assert.isFalse(areEqualObjs(data.fn1, data.fn2));
      assert.isFalse(areEqualObjs(data.fn1, data.fn3));
    });
  });

  suite("circular and shared references", function () {
    test("equal cyclic object graphs are treated as equal", function () {
      assert.isTrue(areEqualObjs(data.cyclic1, data.cyclic2));
      assert.isTrue(areEqualObjs(data.cyclic4, data.cyclic5));
    });

    test("different cyclic graphs are not equal", function () {
      assert.isFalse(areEqualObjs(data.cyclic1, data.cyclic3));
      assert.isFalse(areEqualObjs(data.cyclic4, data.cyclic6));
      assert.isFalse(areEqualObjs(data.cyclic5, data.cyclic6));
    });
  });

  suite("special built-in objects", function () {

    suite("Date", function () {
      test("dates with same timestamp are equal", function () {
        var d1 = new Date(1234567890);
        var d2 = new Date(1234567890);
        assert.isTrue(areEqualObjs(d1, d2));
      });

      test("dates with different timestamp are not equal", function () {
        var d1 = new Date(1234567890);
        var d2 = new Date(1234567891);
        assert.isFalse(areEqualObjs(d1, d2));
      });
    });

    suite("RegExp", function () {
      test("regexps with same source and flags are equal", function () {
        var r1 = /abc/gi;
        var r2 = /abc/gi;
        assert.isTrue(areEqualObjs(r1, r2));
      });

      test("regexps with different source or flags are not equal", function () {
        assert.isFalse(areEqualObjs(/abc/g, /abcd/g));
        assert.isFalse(areEqualObjs(/abc/g, /abc/i));
      });
    });

    suite("ArrayBuffer and views", function () {
      test("ArrayBuffer with identical bytes is equal", function () {
        if (typeof ArrayBuffer === "undefined") {
          this.skip();
        }

        var buf1 = new ArrayBuffer(4);
        var buf2 = new ArrayBuffer(4);
        var v1 = new Uint8Array(buf1);
        var v2 = new Uint8Array(buf2);

        v1[0] = 1;
        v1[1] = 2;
        v1[2] = 3;
        v1[3] = 4;
        v2[0] = 1;
        v2[1] = 2;
        v2[2] = 3;
        v2[3] = 4;

        assert.isTrue(areEqualObjs(buf1, buf2));
      });

      test("ArrayBuffer with different bytes is not equal", function () {
        if (typeof ArrayBuffer === "undefined") {
          this.skip();
        }

        var buf1 = new ArrayBuffer(4);
        var buf2 = new ArrayBuffer(4);
        var v1 = new Uint8Array(buf1);
        var v2 = new Uint8Array(buf2);

        v1[0] = 1;
        v2[0] = 2;

        assert.isFalse(areEqualObjs(buf1, buf2));
      });

      test("typed arrays with same type and contents are equal", function () {
        if (typeof Uint8Array === "undefined") {
          this.skip();
        }

        var a = new Uint8Array([1, 2, 3]);
        var b = new Uint8Array([1, 2, 3]);
        assert.isTrue(areEqualObjs(a, b));
      });

      test("typed arrays with different length or contents are not equal", function () {
        if (typeof Uint8Array === "undefined") {
          this.skip();
        }

        var a = new Uint8Array([1, 2, 3]);
        var b = new Uint8Array([1, 2]);
        var c = new Uint8Array([1, 2, 4]);

        assert.isFalse(areEqualObjs(a, b));
        assert.isFalse(areEqualObjs(a, c));
      });

      test("DataView with identical underlying bytes is equal", function () {
        if (typeof ArrayBuffer === "undefined" || typeof DataView === "undefined") {
          this.skip();
        }

        var buf1 = new ArrayBuffer(2);
        var buf2 = new ArrayBuffer(2);
        var v1 = new DataView(buf1);
        var v2 = new DataView(buf2);

        v1.setUint8(0, 10);
        v1.setUint8(1, 20);
        v2.setUint8(0, 10);
        v2.setUint8(1, 20);

        assert.isTrue(areEqualObjs(v1, v2));
      });

      test("DataView with different bytes is not equal", function () {
        if (typeof ArrayBuffer === "undefined" || typeof DataView === "undefined") {
          this.skip();
        }

        var buf1 = new ArrayBuffer(2);
        var buf2 = new ArrayBuffer(2);
        var v1 = new DataView(buf1);
        var v2 = new DataView(buf2);

        v1.setUint8(0, 10);
        v1.setUint8(1, 20);
        v2.setUint8(0, 10);
        v2.setUint8(1, 21);

        assert.isFalse(areEqualObjs(v1, v2));
      });

      test("typed arrays of different constructor types are not equal even with same contents", function () {
        if (typeof Uint8Array === "undefined" || typeof Int8Array === "undefined") {
          this.skip();
        }

        var t1 = new Uint8Array([1, 2, 3]);
        var t2 = new Int8Array([1, 2, 3]);

        assert.isFalse(areEqualObjs(t1, t2));
      });
    });

    suite("Map", function () {
      test("maps with the same primitive keys and equal values are equal", function () {
        if (typeof Map === "undefined") {
          this.skip();
        }

        var m1 = new Map();
        var m2 = new Map();

        m1.set("a", 1);
        m1.set("b", {x: 1});

        m2.set("a", 1);
        m2.set("b", {x: 1});

        assert.isTrue(areEqualObjs(m1, m2));
      });

      test("maps with different sizes or keys are not equal", function () {
        if (typeof Map === "undefined") {
          this.skip();
        }

        var m1 = new Map();
        var m2 = new Map();

        m1.set("a", 1);
        m2.set("a", 1);
        m2.set("b", 2);

        assert.isFalse(areEqualObjs(m1, m2));

        var m3 = new Map();
        var m4 = new Map();
        m3.set("a", 1);
        m4.set("b", 1);
        assert.isFalse(areEqualObjs(m3, m4));
      });

      test("maps with object keys matched by deep equality (slow path) are equal", function () {
        if (typeof Map === "undefined") {
          this.skip();
        }

        var key1a = {id: 1};
        var key1b = {id: 1};
        var m1 = new Map();
        var m2 = new Map();

        m1.set(key1a, {value: 10});
        m2.set(key1b, {value: 10});

        assert.isTrue(areEqualObjs(m1, m2));
      });

      test("maps with equal keys but different values are not equal", function () {
        if (typeof Map === "undefined") {
          this.skip();
        }

        var m1 = new Map();
        var m2 = new Map();

        m1.set("a", {x: 1});
        m2.set("a", {x: 2});

        assert.isFalse(areEqualObjs(m1, m2));
      });
    });

    suite("Set", function () {
      test("sets with the same primitive values are equal", function () {
        if (typeof Set === "undefined") {
          this.skip();
        }

        var s1 = new Set([1, 2, 3]);
        var s2 = new Set([1, 2, 3]);
        assert.isTrue(areEqualObjs(s1, s2));
      });

      test("sets with different sizes or members are not equal", function () {
        if (typeof Set === "undefined") {
          this.skip();
        }

        var s1 = new Set([1, 2, 3]);
        var s2 = new Set([1, 2, 3, 4]);
        var s3 = new Set([1, 3, 4]);

        assert.isFalse(areEqualObjs(s1, s2));
        assert.isFalse(areEqualObjs(s1, s3));
      });

      test("sets with object values matched by deep equality (slow path) are equal", function () {
        if (typeof Set === "undefined") {
          this.skip();
        }

        var v1a = {id: 1};
        var v1b = {id: 1};

        var s1 = new Set([v1a]);
        var s2 = new Set([v1b]);

        assert.isTrue(areEqualObjs(s1, s2));
      });

      test("sets with deep-equal keys but differing nested values are not equal", function () {
        if (typeof Set === "undefined") {
          this.skip();
        }

        var s1 = new Set([{id: 1, value: 10}]);
        var s2 = new Set([{id: 1, value: 20}]);
        assert.isFalse(areEqualObjs(s1, s2));
      });
    });
  });

  suite("mixed-type and cross-type comparisons", function () {
    test("different tags (e.g. Array vs Object) are not equal", function () {
      assert.isFalse(areEqualObjs([], {}));
      assert.isFalse(areEqualObjs({}, []));
    });

    test("object vs primitive is not equal", function () {
      assert.isFalse(areEqualObjs({}, 1));
      assert.isFalse(areEqualObjs(1, {}));
    });

    test("Map vs plain object or Set vs Array are not equal", function () {
      if (typeof Map !== "undefined") {
        var m = new Map();
        m.set("a", 1);
        assert.isFalse(areEqualObjs(m, {a: 1}));
        assert.isFalse(areEqualObjs({a: 1}, m));
      }

      if (typeof Set !== "undefined") {
        var s = new Set([1, 2, 3]);
        var arr = [1, 2, 3];

        assert.isFalse(areEqualObjs(s, arr));
        assert.isFalse(areEqualObjs(arr, s));
      }
    });
  });
});