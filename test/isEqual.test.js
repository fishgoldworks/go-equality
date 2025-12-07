/*
 * Copyright (c) 2022 Michael Ko
 * 
 * This work is licensed under the GNU LGPLv3 license.
 * <https://www.gnu.org/licenses/lgpl-3.0.en.html>.
 */

/* global Infinity, NaN */

"use strict";

var assert = require("chai").assert;
var isEqual = require("../src/isEqual");
var data = require("./data/testData");


suite("#isEqual", function () {

    test("equal primitives", function () {
        assert.equal(isEqual(undefined, undefined), true);
        assert.equal(isEqual(null, null), true);
        assert.equal(isEqual(true, true), true);
        assert.equal(isEqual(1, 1), true);
        assert.equal(isEqual(-0, +0), true);
        assert.equal(isEqual(Infinity, Infinity), true);
        assert.equal(isEqual(NaN, NaN), true);
        assert.equal(isEqual("abc", "abc"), true);
        assert.equal(isEqual(BigInt(1), BigInt(1)), true);
        assert.equal(isEqual(data.symbol1, data.symbol1), true);
    });

    test("not equal primitives", function () {
        assert.equal(isEqual(undefined, null), false);
        assert.equal(isEqual(null, undefined), false);
        assert.equal(isEqual(true, false), false);
        assert.equal(isEqual(false, 0), false);
        assert.equal(isEqual(true, 1), false);
        assert.equal(isEqual(true, "true"), false);
        assert.equal(isEqual(0, 0.00000000000001), false);
        assert.equal(isEqual(1, BigInt(1)), false);
        assert.equal(isEqual(1, "1"), false);
        assert.equal(isEqual(0, ""), false);
        assert.equal(isEqual("", " "), false);
        assert.equal(isEqual(data.symbol1, data.symbol2), false);
    });

    test("equal objects", function () {
        var obj = {};
        assert.equal(isEqual(obj, obj), true);
        assert.equal(isEqual(data.entity1, data.entity2), true);
        assert.equal(isEqual(new Boolean(true), new Boolean(true)), true);
        assert.equal(isEqual(new Number(1), new Number(1)), true);
        assert.equal(isEqual(new String("abc"), new String("abc")), true);
        assert.equal(isEqual([], []), true);
        assert.equal(isEqual([1, 2, 3], [1, 2, 3]), true);
        assert.equal(isEqual([[false], [1, 2], ["a", "b", "c"]], [[false], [1, 2], ["a", "b", "c"]]), true);
        assert.equal(isEqual({}, {}), true);
        assert.equal(isEqual({a: 1, b: "abc", c: true}, {a: 1, b: "abc", c: true}), true);
        assert.equal(isEqual({a: 1, b: "abc", c: true}, {b: "abc", a: 1, c: true}), true);
        assert.equal(isEqual({a: 1, b: "abc", c: true}, {a: new Number(1), b: new String("abc"), c: new Boolean(true)}), true);
        assert.equal(isEqual([{a: 1}, {b: true}], [{a: new Number(1)}, {b: new Boolean(true)}]), true);
        assert.equal(isEqual(data.fn1, data.fn1), true);
        assert.equal(isEqual(data.entity1, data.entity2), true);
        assert.equal(isEqual(data.entity2, data.entity1), true);
        assert.equal(isEqual(data.cyclic1, data.cyclic2), true);
        assert.equal(isEqual(data.cyclic4, data.cyclic5), true);
    });

    test("not equal objects", function () {
        assert.equal(isEqual([], [undefined]), false);
        assert.equal(isEqual([1, 2, 3], [3, 2, 1]), false);
        assert.equal(isEqual({}, {a: undefined}), false);
        assert.equal(isEqual({a: null}, {a: undefined}), false);
        assert.equal(isEqual({a: 1}, {b: 1}), false);
        assert.equal(isEqual(function () {}, function () {}), false);
        assert.equal(isEqual(data.entity1, data.entity3), false);
        assert.equal(isEqual(data.entity3, data.entity1), false);
        assert.equal(isEqual(data.item1, data.entity1), false);
        assert.equal(isEqual(data.item1, {name: 1}), false);
        assert.equal(isEqual(data.fn1, data.fn2), false);
        assert.equal(isEqual(data.fn1, data.fn3), false);
        assert.equal(isEqual(data.cyclic1, data.cyclic3), false);
        assert.equal(isEqual(data.cyclic4, data.cyclic6), false);
        assert.equal(isEqual(data.cyclic5, data.cyclic6), false);

    });

    test("equal primitive-object values", function () {
        assert.equal(isEqual(1, new Number(1)), true);
        assert.equal(isEqual(NaN, new Number(NaN)), true);
        assert.equal(isEqual("abc", new String("abc")), true);
        assert.equal(isEqual(true, new Boolean(true)), true);
    });

    test("not equal primitive-object values", function () {
        assert.equal(isEqual(1, new Number(-1)), false);
        assert.equal(isEqual(1, new String("1")), false);
        assert.equal(isEqual("", new String(" ")), false);
        assert.equal(isEqual(true, new Boolean(false)), false);
        assert.equal(isEqual(true, new String("true")), false);
        assert.equal(isEqual(false, new Number(0)), false);
    });
});