var checkEquality = require("./checkEquality");

/**
 * Determines whether two values are equal.
 * 
 * Two values are considered equal if they are:
 * - Primitive values whose types and values are the same
 * - Identical objects (comparing against itself)
 * - One of them is a primitive wrapper object whose value is the same as the other value
 * - Objects that have the same property names and equal values (including non-enumerable properties)
 * - Objects that have the <code>equals</code> method and both return <code>true</code> when tested against each other
 * - <code>NaN</code> values
 * 
 * These values are considered not equal:
 * - Primitive values whose types or values are different
 * - Objects that have a different constructor or property name or value (including non-enumerable properties)
 * - One of the objects has the equals method and it returns <code>false</code> when tested against the other value
 * - Functions
 * - <code>Symbol</code> values
 * @param {*} value The value to compare
 * @param {*} other The other value to compare with
 * @returns {boolean} <code>true</code> if the two values are considered equal; <code>false</code> otherwise.
 * @example <caption>Equal values</caption>
 * // returns true
 * isEqual(1, 1);
 * isEqual(1, new Number(1));
 * isEqual([1, 2, 3], [1, 2, 3]);
 * isEqual({name: "foo", value: 10}, {value: 10, name: "foo"});
 * isEqual(NaN, NaN);
 * @example <caption>Not equal values</caption>
 * // returns false
 * isEqual(1, "1");
 * isEqual(null, undefined);
 * isEqual({}, {a: undefined});
 * isEqual([1, 2, 3], [2, 3, 1]);
 * isEqual(function() {}, function() {});
 * isEqual(Symbol("abc"), Symbol("abc"));
 * @since 1.0.0
 */
function isEqual(value, other) {
  return checkEquality(value, other);
}

module.exports = isEqual;