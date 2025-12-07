/*
 * Copyright (c) 2022 Michael Ko
 * 
 * This work is licensed under the GNU LGPLv3 license.
 * <https://www.gnu.org/licenses/lgpl-3.0.en.html>.
 */

/* global Infinity, NaN */

"use strict";

var assert = require("chai").assert;
var isLooseEqual = require("../src/isLooseEqual");
var data = require("./data/testData");


suite("#isLooseEqual", function () {

    test("equal primitives", function () {
        assert.equal(isLooseEqual(undefined, undefined), true);
        assert.equal(isLooseEqual(null, null), true);
        assert.equal(isLooseEqual(true, true), true);
        assert.equal(isLooseEqual(1, 1), true);
        assert.equal(isLooseEqual(-0, +0), true);
        assert.equal(isLooseEqual(Infinity, Infinity), true);
        assert.equal(isLooseEqual(NaN, NaN), true);
        assert.equal(isLooseEqual("abc", "abc"), true);
        assert.equal(isLooseEqual(BigInt(1), BigInt(1)), true);
        assert.equal(isLooseEqual(undefined, null), true);
        assert.equal(isLooseEqual(null, undefined), true);
        assert.equal(isLooseEqual(false, 0), true);
        assert.equal(isLooseEqual(true, 1), true);
        assert.equal(isLooseEqual(1, "1"), true);
        assert.equal(isLooseEqual(0, ""), true);
        assert.equal(isLooseEqual(1, BigInt(1)), true);
        assert.equal(isLooseEqual(data.symbol1, data.symbol1), true);
    });

    test("not equal primitives", function () {
        assert.equal(isLooseEqual(true, false), false);
        assert.equal(isLooseEqual(false, undefined), false);
        assert.equal(isLooseEqual(false, null), false);
        assert.equal(isLooseEqual(false, "false"), false);
        assert.equal(isLooseEqual(true, "true"), false);
        assert.equal(isLooseEqual(0, 0.00000000000001), false);
        assert.equal(isLooseEqual("", " "), false);
        assert.equal(isLooseEqual(data.symbol1, data.symbol2), false);
    });

    test("equal objects", function () {
        var obj = {};
        assert.equal(isLooseEqual(obj, obj), true);
        assert.equal(isLooseEqual(data.entity1, data.entity2), true);
        assert.equal(isLooseEqual(new Boolean(true), new Boolean(true)), true);
        assert.equal(isLooseEqual(new Number(1), new Number(1)), true);
        assert.equal(isLooseEqual(new String("abc"), new String("abc")), true);
        assert.equal(isLooseEqual([], []), true);
        assert.equal(isLooseEqual([1, 2, 3], [1, 2, 3]), true);
        assert.equal(isLooseEqual([[false], [1, 2], ["a", "b", "c"]], [[false], [1, 2], ["a", "b", "c"]]), true);
        assert.equal(isLooseEqual({}, {}), true);
        assert.equal(isLooseEqual({a: null}, {a: undefined}), true);
        assert.equal(isLooseEqual({a: 1, b: "abc", c: true}, {a: 1, b: "abc", c: true}), true);
        assert.equal(isLooseEqual({a: 1, b: "abc", c: true}, {b: "abc", a: 1, c: true}), true);
        assert.equal(isLooseEqual({a: 1, b: "abc", c: true}, {a: new Number(1), b: new String("abc"), c: new Boolean(true)}), true);
        assert.equal(isLooseEqual([{a: 1}, {b: true}], [{a: new Number(1)}, {b: new Boolean(true)}]), true);
        assert.equal(isLooseEqual(data.fn1, data.fn1), true);
        assert.equal(isLooseEqual(data.entity1, data.entity2), true);
        assert.equal(isLooseEqual(data.entity2, data.entity1), true);
        assert.equal(isLooseEqual(data.item1, {name: 1}), true);
        assert.equal(isLooseEqual(data.cyclic1, data.cyclic2), true);
        assert.equal(isLooseEqual(data.cyclic4, data.cyclic5), true);
        assert.equal(isLooseEqual(data.cyclic1, data.cyclic3), true);
        assert.equal(isLooseEqual(data.cyclic4, data.cyclic6), true);
        assert.equal(isLooseEqual(data.cyclic5, data.cyclic6), true);
    });

    test("not equal objects", function () {
        assert.equal(isLooseEqual([], [undefined]), false);
        assert.equal(isLooseEqual([1, 2, 3], [3, 2, 1]), false);
        assert.equal(isLooseEqual({}, {a: undefined}), false);
        assert.equal(isLooseEqual({a: 1}, {b: 1}), false);
        assert.equal(isLooseEqual(data.fn1, data.fn2), false);
        assert.equal(isLooseEqual(data.fn1, data.fn3), false);
        assert.equal(isLooseEqual(data.entity1, data.entity3), false);
        assert.equal(isLooseEqual(data.entity3, data.entity1), false);
        assert.equal(isLooseEqual(data.item1, data.entity1), false);
    });

    test("equal primitive-object values", function () {
        assert.equal(isLooseEqual(1, new Number(1)), true);
        assert.equal(isLooseEqual(NaN, new Number(NaN)), true);
        assert.equal(isLooseEqual(1, new String("1")), true);
        assert.equal(isLooseEqual("abc", new String("abc")), true);
        assert.equal(isLooseEqual(true, new Boolean(true)), true);
        assert.equal(isLooseEqual(false, new Number(0)), true);
    });

    test("not equal primitive-object values", function () {
        assert.equal(isLooseEqual(1, new Number(-1)), false);
        assert.equal(isLooseEqual("", new String(" ")), false);
        assert.equal(isLooseEqual(true, new Boolean(false)), false);
        assert.equal(isLooseEqual(true, new String("true")), false);
    });
});