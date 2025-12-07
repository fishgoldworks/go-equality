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

    test("equal primitives", function () {
        assert.equal(isStrictEqual(undefined, undefined), true);
        assert.equal(isStrictEqual(null, null), true);
        assert.equal(isStrictEqual(true, true), true);
        assert.equal(isStrictEqual(1, 1), true);
        assert.equal(isStrictEqual(-0, +0), true);
        assert.equal(isStrictEqual(Infinity, Infinity), true);
        assert.equal(isStrictEqual(NaN, NaN), true);
        assert.equal(isStrictEqual("abc", "abc"), true);
        assert.equal(isStrictEqual(BigInt(1), BigInt(1)), true);
        assert.equal(isStrictEqual(data.symbol1, data.symbol1), true);
    });

    test("not equal primitives", function () {
        assert.equal(isStrictEqual(undefined, null), false);
        assert.equal(isStrictEqual(null, undefined), false);
        assert.equal(isStrictEqual(true, false), false);
        assert.equal(isStrictEqual(false, 0), false);
        assert.equal(isStrictEqual(true, "true"), false);
        assert.equal(isStrictEqual(0, 0.00000000000001), false);
        assert.equal(isStrictEqual(1, BigInt(1)), false);
        assert.equal(isStrictEqual(1, "1"), false);
        assert.equal(isStrictEqual(0, ""), false);
        assert.equal(isStrictEqual("", " "), false);
        assert.equal(isStrictEqual(data.symbol1, data.symbol2), false);
    });

    test("equal objects", function () {
        var obj = {};
        assert.equal(isStrictEqual(obj, obj), true);
        assert.equal(isStrictEqual(data.entity1, data.entity2), true);
        assert.equal(isStrictEqual(new Boolean(true), new Boolean(true)), true);
        assert.equal(isStrictEqual(new Number(1), new Number(1)), true);
        assert.equal(isStrictEqual(new Number(NaN), new Number(NaN)), true);
        assert.equal(isStrictEqual(new String("abc"), new String("abc")), true);
        assert.equal(isStrictEqual([], []), true);
        assert.equal(isStrictEqual([1, 2, 3], [1, 2, 3]), true);
        assert.equal(isStrictEqual([[false], [1, 2], ["a", "b", "c"]], [[false], [1, 2], ["a", "b", "c"]]), true);
        assert.equal(isStrictEqual({}, {}), true);
        assert.equal(isStrictEqual({a: 1, b: "abc", c: true}, {a: 1, b: "abc", c: true}), true);
        assert.equal(isStrictEqual({a: 1, b: "abc", c: true}, {b: "abc", a: 1, c: true}), true);
        assert.equal(isStrictEqual(data.fn1, data.fn1), true);
        assert.equal(isStrictEqual(data.entity1, data.entity2), true);
        assert.equal(isStrictEqual(data.entity2, data.entity1), true);
        assert.equal(isStrictEqual(data.cyclic1, data.cyclic2), true);
        assert.equal(isStrictEqual(data.cyclic4, data.cyclic5), true);
    });

    test("not equal objects", function () {
        assert.equal(isStrictEqual([], [undefined]), false);
        assert.equal(isStrictEqual([1, 2, 3], [3, 2, 1]), false);
        assert.equal(isStrictEqual({}, {a: undefined}), false);
        assert.equal(isStrictEqual({a: 1}, {b: 1}), false);
        assert.equal(isStrictEqual({a: null}, {a: undefined}), false);
        assert.equal(isStrictEqual({a: true}, {a: new Boolean(true)}), false);
        assert.equal(isStrictEqual(data.fn1, data.fn2), false);
        assert.equal(isStrictEqual(data.fn1, data.fn3), false);
        assert.equal(isStrictEqual(data.entity1, data.entity3), false);
        assert.equal(isStrictEqual(data.entity3, data.entity1), false);
        assert.equal(isStrictEqual(data.item1, data.entity1), false);
        assert.equal(isStrictEqual(data.item1, {name: 1}), false);
        assert.equal(isStrictEqual(data.cyclic1, data.cyclic3), false);
        assert.equal(isStrictEqual(data.cyclic4, data.cyclic6), false);
        assert.equal(isStrictEqual(data.cyclic5, data.cyclic6), false);
    });

    test("not equal primitive-object values", function () {
        assert.equal(isStrictEqual(1, new Number(1)), false);
        assert.equal(isStrictEqual(NaN, new Number(NaN)), false);
        assert.equal(isStrictEqual("abc", new String("abc")), false);
        assert.equal(isStrictEqual(true, new Boolean(true)), false);
        assert.equal(isStrictEqual(1, new Number(-1)), false);
        assert.equal(isStrictEqual(1, new String("1")), false);
        assert.equal(isStrictEqual("", new String(" ")), false);
        assert.equal(isStrictEqual(true, new Boolean(false)), false);
        assert.equal(isStrictEqual(true, new String("true")), false);
        assert.equal(isStrictEqual(false, new Number(0)), false);
    });
});