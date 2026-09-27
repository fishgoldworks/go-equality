'use strict';

const hasOwn = Object.prototype.hasOwnProperty;

function ownKeys(value, kind) {
  const keys = Reflect.ownKeys(value);
  if (kind === 'Arguments') {
    // Strict arguments.callee is a poison accessor, not application state.
    return keys.filter((key) => key !== 'callee' && key !== Symbol.iterator);
  }
  return keys;
}

module.exports = function compareProperties(node, context, kind, length = 0, custom = false) {
  const a = node.left;
  const b = node.right;
  const keys = ownKeys(a, kind);
  const otherKeys = ownKeys(b, kind);
  if (keys.length !== otherKeys.length) {
    return false;
  }
  // Real typed arrays enumerate validated element indices first, followed by
  // other strings and symbols (ECMA-262 [[OwnPropertyKeys]]). The numeric
  // payload was already checked; skip it without filtering/converting every key.
  const start = kind === 'TypedArray' ? length : 0;
  for (let i = start; i < keys.length; i++) {
    // The corresponding own key already proves membership in the usual
    // same-order case. Different insertion orders still compare unordered.
    if (keys[i] !== otherKeys[i] && !hasOwn.call(b, keys[i])) {
      return false;
    }
  }
  if (custom) {
    for (let i = start; i < keys.length; i++) {
      const key = keys[i];
      if (!context.require(node, context.pair(a[key], b[key]))) {
        return false;
      }
    }
    return true;
  }
  for (let i = start; i < keys.length; i++) {
    const key = keys[i];
    const left = a[key];
    const right = b[key];
    // Most ordinary properties are equal primitives or shared references.
    if (left !== right && !context.require(node, context.pair(left, right))) {
      return false;
    }
  }
  return true;
};
