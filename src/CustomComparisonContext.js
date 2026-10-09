'use strict';

const ComparisonContext = require('./ComparisonContext');
const compareObjects = require('./compareObjects');

// Custom comparisons use the same graph engine. The callback must run before
// identity or native collection shortcuts can decide equality for a pair.
class CustomComparisonContext extends ComparisonContext {
  constructor(mode, customizer) {
    super(mode);
    this.customizer = customizer;
  }

  pair(left, right, queue = true) {
    // A local call avoids exposing the comparison context as the callback's this.
    // Pass the original values before unboxing wrappers or calling equals() methods.
    const customizer = this.customizer;
    const result = customizer(left, right);
    if (result === true || result === false) {
      return result;
    }
    if (result !== undefined) {
      throw new TypeError('Equality customizer must return true, false, or undefined.');
    }
    return super.pair(left, right, queue);
  }

  expand(node) {
    if (node.expanded || !node.valid) {
      return;
    }
    if (!compareObjects(node, this, true)) {
      this.invalidate(node);
    }
    node.expanded = true;
  }
}

module.exports = CustomComparisonContext;
