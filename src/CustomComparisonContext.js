'use strict';

const ComparisonContext = require('./ComparisonContext');
const compareObjects = require('./compareObjects');

// Opt-in traversal shares the existing graph engine, but never lets an identity
// or native-membership shortcut bypass a caller's decision on a reached pair.
class CustomComparisonContext extends ComparisonContext {
  constructor(mode, customizer) {
    super(mode);
    this.customizer = customizer;
  }

  pair(left, right, queue = true) {
    // A local call avoids exposing the comparison context as the callback's this.
    // Original values reach the customizer before unboxing or instance hooks.
    const customizer = this.customizer;
    const result = customizer(left, right);
    if (result === true || result === false) return result;
    if (result !== undefined) {
      throw new TypeError('Equality customizer must return true, false, or undefined.');
    }
    return super.pair(left, right, queue);
  }

  expand(node) {
    if (node.expanded || !node.valid) return;
    if (!compareObjects(node, this, true)) this.invalidate(node);
    node.expanded = true;
  }
}

module.exports = CustomComparisonContext;
