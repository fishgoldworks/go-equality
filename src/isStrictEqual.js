var checkStrictEquality = require("./checkStrictEquality");

/**
 * Determines whether two values are strictly equal.
 * 
 * Two values are considered strictly equal if they are:
 * - Primitive values whose types and values are the same
 * - Identical objects (comparing against itself)
 * - Objects that have the <code>equals</code> method and both return <code>true</code> when tested against each other
 * - Objects that have the same constructor and the same property names and values (including non-enumerable properties)
 * - Primitive <code>NaN</code> values or Number objects that represent <code>NaN</code>
 * 
 * These values are considered not equal:
 * - Primitive values whose types or values are different
 * - Objects that have a different constructor or property name or value (including non-enumerable properties)
 * - One of the objects has the equals method and it returns <code>false</code> when tested against the other value
 * - Functions
 * - <code>Symbol</code> values
 * @param {*} value The value to compare
 * @param {*} other The other value to compare with
 * @returns {boolean} <code>true</code> if the two values are strictly equal; <code>false</code> otherwise.
 * @example <caption>Equal values</caption>
 * // returns true
 * isStrictEqual(1, 1);
 * isStrictEqual([1, 2, 3], [1, 2, 3]);
 * isStrictEqual({name: "foo", value: 10}, {value: 10, name: "foo"});
 * isStrictEqual(NaN, NaN);
 * @example <caption>Not equal values</caption>
 * // returns false
 * isStrictEqual(1, "1");
 * isStrictEqual(1, new Number(1));
 * isStrictEqual(null, undefined);
 * isStrictEqual({}, {a: undefined});
 * isStrictEqual(function() {}, function() {});
 * isStrictEqual(Symbol("abc"), Symbol("abc"));
 * @since 1.0.0
 */
function isStrictEqual(value, other) {
  return checkStrictEquality(value, other);
}

module.exports = isStrictEqual;