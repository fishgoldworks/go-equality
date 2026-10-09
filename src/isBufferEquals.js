'use strict';

const { typedName } = require('./typeInfo');
// The environment supplies the trusted native constructor before module load.
// Without it, never guess native identity from application names or metadata.
const bufferPrototype = typeof Buffer === 'function' ? Buffer.prototype : null;
const bufferEquals = bufferPrototype && dataProperty(bufferPrototype, 'equals');

function dataProperty(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor && descriptor.value;
}

module.exports = function isBufferEquals(value, method) {
  if (!bufferPrototype || !ArrayBuffer.isView(value) || typedName.call(value) !== 'Uint8Array') {
    return false;
  }
  // An own method, accessor or subclass override is an application hook.
  // Walk descriptors without invoking constructors, getters or isBuffer.
  let owner = value;
  while (owner) {
    const descriptor = Object.getOwnPropertyDescriptor(owner, 'equals');
    if (descriptor) {
      if (owner === value || descriptor.value !== method) {
        return false;
      }
      return owner === bufferPrototype && method === bufferEquals;
    }
    owner = Object.getPrototypeOf(owner);
  }
  return false;
};
