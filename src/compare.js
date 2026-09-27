'use strict';

const ComparisonContext = require('./ComparisonContext');

module.exports = function compare(value, other, mode) {
  if (value === other) return true;
  // Browser document.all is an object despite its unusual typeof-undefined result.
  const leftType = typeof value;
  const rightType = typeof other;
  const leftObject = value !== null && (leftType === 'object' || leftType === 'function' || (leftType === 'undefined' && value !== undefined));
  const rightObject = other !== null && (rightType === 'object' || rightType === 'function' || (rightType === 'undefined' && other !== undefined));
  if (!leftObject && !rightObject) return (value !== value && other !== other) || (mode === 'loose' && value == other);
  if (leftType === 'function' || rightType === 'function') return false;
  return new ComparisonContext(mode).run(value, other);
};
