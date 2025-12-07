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

var equalityChecker = function (val, other, stack) {
    if (val === other) {
        return true;
    } else if (val instanceof Object && other instanceof Object) {
        return areEqualObjects(val, other, stack, equalityChecker, true);
    }
    return false;
};

var areEqualObjs = function (obj, otherObj) {
    return areEqualObjects(obj, otherObj, [], equalityChecker, true);
};


suite("#areEqualObjs", function () {

    test("equal objects", function () {
        var obj = {};
        assert.equal(areEqualObjs(obj, obj), true);
        assert.equal(areEqualObjs(data.entity1, data.entity2), true);
        assert.equal(areEqualObjs(new Boolean(true), new Boolean(true)), true);
        assert.equal(areEqualObjs(new Number(1), new Number(1)), true);
        assert.equal(areEqualObjs(new String("abc"), new String("abc")), true);
        assert.equal(areEqualObjs([], []), true);
        assert.equal(areEqualObjs([1, 2, 3], [1, 2, 3]), true);
        assert.equal(areEqualObjs([[false], [1, 2], ["a", "b", "c"]], [[false], [1, 2], ["a", "b", "c"]]), true);
        assert.equal(areEqualObjs({}, {}), true);
        assert.equal(areEqualObjs({a: 1, b: "abc", c: true}, {a: 1, b: "abc", c: true}), true);
        assert.equal(areEqualObjs({a: 1, b: "abc", c: true}, {b: "abc", a: 1, c: true}), true);
        assert.equal(areEqualObjs(data.fn1, data.fn1), true);
        assert.equal(areEqualObjs(data.entity1, data.entity2), true);
        assert.equal(areEqualObjs(data.entity2, data.entity1), true);
        assert.equal(areEqualObjs(data.cyclic1, data.cyclic2), true);
        assert.equal(areEqualObjs(data.cyclic4, data.cyclic5), true);
    });

    test("not equal objects", function () {
        assert.equal(areEqualObjs([], [undefined]), false);
        assert.equal(areEqualObjs([1, 2, 3], [3, 2, 1]), false);
        assert.equal(areEqualObjs({}, {a: undefined}), false);
        assert.equal(areEqualObjs({a: 1}, {b: 1}), false);
        assert.equal(areEqualObjs({a: null}, {a: undefined}), false);
        assert.equal(areEqualObjs({a: 1}, {a: new Number(1)}), false);
        assert.equal(areEqualObjs({b: "abc"}, {b: new String("abc")}), false);
        assert.equal(areEqualObjs({c: true}, {c: new Boolean(true)}), false);
        assert.equal(areEqualObjs(function () {}, function () {}), false);
        assert.equal(areEqualObjs(data.entity1, data.entity3), false);
        assert.equal(areEqualObjs(data.entity3, data.entity1), false);
        assert.equal(areEqualObjs(data.item1, data.entity1), false);
        assert.equal(areEqualObjs(data.item1, {name: 1}), false);
        assert.equal(areEqualObjs(data.fn1, data.fn2), false);
        assert.equal(areEqualObjs(data.fn1, data.fn3), false);
        assert.equal(areEqualObjs(data.cyclic1, data.cyclic3), false);
        assert.equal(areEqualObjs(data.cyclic4, data.cyclic6), false);
        assert.equal(areEqualObjs(data.cyclic5, data.cyclic6), false);
    });
});