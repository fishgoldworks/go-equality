'use strict';

const compare = require('./compare');

/**
 * Determines whether two values are deeply equal, preserving primitive types and
 * distinguishing wrapper objects from primitive values.
 *
 * Compares nested contents of arrays and supported objects, so separate objects
 * can compare equal. A primitive wrapper stays distinct from its primitive value;
 * two wrappers can match by their contained values and own properties.
 * Resolved `constructor` properties must match with `===` unless applicable
 * `equals()` methods override that check.
 *
 * Errors from getters, proxy traps, invoked methods and invalid binary views
 * propagate to the caller.
 *
 * @param {*} value The first value to compare.
 * @param {*} other The second value to compare.
 * @returns {boolean} `true` if the values are deeply equal under strict
 * comparison rules; otherwise `false`.
 * @throws {TypeError} If an invoked `equals()` method returns a non-boolean.
 * @see https://github.com/koyote130708/go-equality/blob/master/docs/API.md#isstrictequalvalue-other
 */
function isStrictEqual(value, other) {
  return compare(value, other, 'strict');
}

module.exports = isStrictEqual;
