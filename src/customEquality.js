'use strict';

const CustomComparisonContext = require('./CustomComparisonContext');
const hasOwn = Object.prototype.hasOwnProperty;

function configuration(customizer, options) {
  if (typeof customizer !== 'function') {
    throw new TypeError('Equality customizer must be a function.');
  }
  if (options === undefined) {
    return 'default';
  }
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Equality options must be an object.');
  }
  for (const key of Reflect.ownKeys(options)) {
    if (key !== 'mode') {
      throw new TypeError('Unknown equality option; only mode is supported.');
    }
  }
  // Ignore inherited options and read an own mode getter at most once.
  const mode = hasOwn.call(options, 'mode') ? options.mode : undefined;
  if (mode === undefined) {
    return 'default';
  }
  if (mode !== 'default' && mode !== 'strict' && mode !== 'loose') {
    throw new TypeError('Equality mode must be default, strict, or loose.');
  }
  return mode;
}

/**
 * Determines whether two values are deeply equal, using your callback to override
 * individual comparisons.
 *
 * Return `true` or `false` from the callback to decide a pair, or `undefined` to use
 * the selected mode. The callback receives original values before identity
 * checks, wrapper unboxing and `equals()` methods; it can reject identical values.
 * It must be synchronous and leave inputs unchanged, and may skip nested pairs.
 * Errors from getters, proxies, invoked user code and invalid binary views propagate.
 *
 * @param {*} value The first value to compare.
 * @param {*} other The second value to compare.
 * @param {Function} customizer A callback returning `boolean` or `undefined`.
 * @param {Object} [options] Options selecting a fallback mode; an omitted `mode` selects `'default'`.
 * @returns {boolean} `true` if the values are equal under the custom rules
 * and fallback mode; otherwise `false`.
 * @throws {TypeError} If configuration or an invoked callback or hook result is invalid.
 * @see https://github.com/koyote130708/go-equality/blob/master/docs/API.md#isequalcustomvalue-other-customizer-options
 */
function custom(value, other, customizer, options) {
  const mode = configuration(customizer, options);
  return new CustomComparisonContext(mode, customizer).run(value, other);
}

/**
 * Creates a reusable function for deep comparison using your callback and a saved
 * fallback mode.
 *
 * Validates the configuration once and saves the fallback mode. The returned
 * function compares values with the same rules as `custom()`; creation does not
 * call the callback. Each comparison has fresh state and does not cache results.
 *
 * @param {Function} customizer A synchronous callback returning `boolean` or `undefined`.
 * @param {Object} [options] Options selecting a fallback mode; an omitted `mode` selects `'default'`.
 * @returns {Function} A function that compares two values and returns a `boolean`.
 * @throws {TypeError} If configuration is invalid. Comparison errors, including
 * invalid callback results, occur when the returned function is called.
 * @see https://github.com/koyote130708/go-equality/blob/master/docs/API.md#isequalcreatecustomizer-options
 */
function create(customizer, options) {
  const mode = configuration(customizer, options);
  // Keep only the configuration. Each call gets fresh comparison state,
  // even after an exception or a change to previously compared data.
  return function isCustomEqual(value, other) {
    return new CustomComparisonContext(mode, customizer).run(value, other);
  };
}

module.exports = { custom, create };
