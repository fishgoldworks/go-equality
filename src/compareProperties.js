'use strict';

function ownKeys(value, kind) {
  const keys = Reflect.ownKeys(value);
  if (kind === 'Arguments') {
    // Reading arguments.callee in strict mode throws; it is engine bookkeeping.
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
  // other strings and symbols (ECMA-262 [[OwnPropertyKeys]]). Their elements
  // were already compared, so skip those keys without filtering each one.
  const start = kind === 'TypedArray' ? length : 0;
  let otherKeySet;
  for (let i = start; i < keys.length; i++) {
    // Compare the captured key lists. A proxy can expose keys that disagree
    // with its property descriptors, so a separate own-property check can differ.
    if (keys[i] !== otherKeys[i]) {
      if (!otherKeySet) {
        otherKeySet = new Set(otherKeys);
      }
      if (!otherKeySet.has(keys[i])) {
        return false;
      }
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
