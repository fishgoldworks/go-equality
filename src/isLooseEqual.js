var checkLooseEquality = require("./checkLooseEquality");

/**
 * Determines whether two values are loosely equal.
 * 
 * Two values are considered loosely equal if they are:
 * - Primitive values whose types are the same or compatible and the values are equal (after conversion if required)
 * - Identical objects (comparing against itself)
 * - One of them is a primitive wrapper object whose value is the same as the other value
 * - Objects that have the same property names and loosely equal values (including non-enumerable properties)
 * - Objects that have the <code>equals</code> method and both return <code>true</code> when tested against each other
 * - <code>NaN</code> values
 * 
 * These values are considered not equal:
 * - Primitive values whose types are not compatible or values are different
 * - Objects that have a different property name or value (including non-enumerable properties)
 * - One of the objects has the equals method and it returns <code>false</code> when tested against the other value
 * - Functions
 * - <code>Symbol</code> values
 * @param {*} value The value to compare
 * @param {*} other The other value to compare with
 * @returns {boolean} <code>true</code> if the two values are loosely equal; <code>false</code> otherwise.
 * @example <caption>Equal values</caption>
 * // returns true
 * isLooseEqual(null, undefined);
 * isLooseEqual(1, "1");
 * isLooseEqual(1, new Number(1));
 * isLooseEqual(1, BigInt(1));
 * isLooseEqual(1, true);
 * isLooseEqual(NaN, NaN);
 * @example <caption>Not equal values</caption>
 * // returns false
 * isLooseEqual(true, "true");
 * isLooseEqual(false, undefined);
 * isLooseEqual({}, {a: undefined});
 * isLooseEqual("abc", ["a", "b", "c"]);
 * isLooseEqual([1, 2, 3], [2, 3, 1]);
 * isLooseEqual(function() {}, function() {});
 * isLooseEqual(Symbol("abc"), Symbol("abc"));
 * @since 1.0.0
 */
function isLooseEqual(value, other) {
  return checkLooseEquality(value, other);
}

module.exports = isLooseEqual;