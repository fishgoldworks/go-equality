"use strict";

const compare = require('./compare');

/**
 * Deep equality with primitive coercion and constructor-independent structure.
 * NaN equals NaN; +0 equals -0. Identical references always compare equal.
 * Supports cycles, unordered Maps/Sets, own non-enumerable/symbol properties
 * and bilateral boolean equals() methods. See README for the full contract.
 * @param {*} value The first value.
 * @param {*} other The second value.
 * @returns {boolean} Whether the values compare equal under this mode.
 * @throws {TypeError} When a custom equals() method returns a non-boolean.
 * Exceptions from invoked user code and invalid detached views propagate.
 */
function isLooseEqual(value, other) {
  return compare(value, other, 'loose');
}

module.exports = isLooseEqual;
