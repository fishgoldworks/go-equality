'use strict';

const compare = require('./compare');

/**
 * Determines whether two values are deeply equal.
 *
 * Compares nested contents of arrays and supported objects, so separate objects
 * can compare equal. Primitive wrappers are compared as their contained values:
 * `Object(1)` equals `1`, but the number `1` does not equal the string `'1'`.
 *
 * Applicable `equals()` methods can override the standard rules. Errors from
 * getters, proxy traps, invoked methods and invalid binary views propagate.
 *
 * @param {*} value The first value to compare.
 * @param {*} other The second value to compare.
 * @returns {boolean} `true` if the values are deeply equal; otherwise `false`.
 * @throws {TypeError} If an invoked `equals()` method returns a non-boolean.
 * @see https://github.com/koyote130708/go-equality/blob/master/docs/API.md#isequalvalue-other
 */
function isEqual(value, other) {
  return compare(value, other, 'default');
}

module.exports = isEqual;

// These aliases can be destructured and called without an object bound as this.
const { custom, create } = require('./customEquality');
Object.defineProperties(module.exports, {
  strict: { value: require('./isStrictEqual') },
  loose: { value: require('./isLooseEqual') },
  custom: { value: custom },
  create: { value: create }
});
