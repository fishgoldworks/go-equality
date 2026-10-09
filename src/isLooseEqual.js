'use strict';

const compare = require('./compare');

/**
 * Determines whether two values are deeply equal, allowing primitive conversions
 * such as `1` matching `'1'`.
 *
 * Compares nested contents of arrays and supported objects. The conversions also
 * apply inside nested data.
 * Primitive wrappers use their contained values; ordinary object constructors
 * may differ. Arbitrary objects are not converted into primitive values.
 *
 * Applicable `equals()` methods can override the standard rules. Errors from
 * getters, proxy traps, invoked methods and invalid binary views propagate.
 *
 * @param {*} value The first value to compare.
 * @param {*} other The second value to compare.
 * @returns {boolean} `true` if the values are deeply equal under loose
 * comparison rules; otherwise `false`.
 * @throws {TypeError} If an invoked `equals()` method returns a non-boolean.
 * @see https://github.com/koyote130708/go-equality/blob/master/docs/API.md#islooseequalvalue-other
 */
function isLooseEqual(value, other) {
  return compare(value, other, 'loose');
}

module.exports = isLooseEqual;
