'use strict';

const CustomComparisonContext = require('./CustomComparisonContext');

function configuration(customizer, options) {
  if (typeof customizer !== 'function') throw new TypeError('Equality customizer must be a function.');
  if (options === undefined) return 'default';
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Equality options must be an object.');
  }
  for (const key of Reflect.ownKeys(options)) {
    if (key !== 'mode') throw new TypeError('Unknown equality option; only mode is supported.');
  }
  // Ignore inherited options; read a getter at most once when snapshotting.
  const mode = Object.hasOwn(options, 'mode') ? options.mode : undefined;
  if (mode === undefined) return 'default';
  if (mode !== 'default' && mode !== 'strict' && mode !== 'loose') {
    throw new TypeError('Equality mode must be default, strict, or loose.');
  }
  return mode;
}

function custom(value, other, customizer, options) {
  const mode = configuration(customizer, options);
  return new CustomComparisonContext(mode, customizer).run(value, other);
}

function create(customizer, options) {
  const mode = configuration(customizer, options);
  // Retain configuration only. Graph/candidate caches are new for EVERY call,
  // including calls following an exception or a change to previously used data.
  return function isCustomEqual(value, other) {
    return new CustomComparisonContext(mode, customizer).run(value, other);
  };
}

module.exports = { custom, create };
