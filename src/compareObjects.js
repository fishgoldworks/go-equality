'use strict';

const compareProperties = require('./compareProperties');
const compareCollections = require('./compareCollections');
const { typedLength, typedValues, dataLength, dataOffset, dataBuffer } = require('./typeInfo');

// Call the hook itself, not a user-controlled property named call.
const apply = Reflect.apply;

function hook(object, method, other) {
  const result = apply(method, object, [other]);
  if (typeof result !== 'boolean') {
    throw new TypeError('equals() must return a boolean.');
  }
  return result;
}

function sameNumber(a, b) {
  return a === b || (a !== a && b !== b);
}

function bytesEqual(a, b) {
  const length = a.length;
  if (length !== b.length) {
    return false;
  }
  let start = 0;
  // These byte views are created internally, not supplied/overridden by users.
  // Aligned word comparisons cover identical bytes on either endianness; keep
  // unaligned views and the final 0-3 bytes on the ordinary byte path.
  if (length >= 64 && (a.byteOffset & 3) === 0 && (b.byteOffset & 3) === 0) {
    const count = Math.floor(length / 4);
    const left = new Uint32Array(a.buffer, a.byteOffset, count);
    const right = new Uint32Array(b.buffer, b.byteOffset, count);
    for (let i = 0; i < count; i++) {
      if (left[i] !== right[i]) {
        return false;
      }
    }
    start = count * 4;
  }
  for (let i = start; i < length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

module.exports = function compareObjects(node, context, custom = false) {
  const a = node.left;
  const b = node.right;
  const leftHook = a.equals;
  const rightHook = b.equals;
  const hasLeftHook = typeof leftHook === 'function';
  const hasRightHook = typeof rightHook === 'function';
  if (hasLeftHook && !hook(a, leftHook, b)) {
    return false;
  }
  if (hasRightHook && !hook(b, rightHook, a)) {
    return false;
  }
  if (hasLeftHook && hasRightHook) {
    return true;
  }

  if (context.mode !== 'loose' && a.constructor !== b.constructor) {
    return false;
  }
  const ai = context.info(a);
  const bi = context.info(b);
  if (ai.kind !== bi.kind) {
    return false;
  }
  const kind = ai.kind;
  let length = 0;

  if (ai.boxed) {
    if (!sameNumber(ai.value, bi.value)) {
      return false;
    }
  } else {
    switch (kind) {
      case 'Object':
      case 'Arguments':
        break;
      case 'Array':
        if (a.length !== b.length) {
          return false;
        }
        break;
      case 'Date':
        if (!sameNumber(ai.value, bi.value)) {
          return false;
        }
        break;
      case 'RegExp':
        if (ai.source !== bi.source || ai.flags !== bi.flags) {
          return false;
        }
        break;
      case 'Map':
      case 'Set': {
        if (ai.size !== bi.size) {
          return false;
        }
        if (!compareCollections(node, context, kind === 'Map', ai.size, custom)) {
          return false;
        }
        break;
      }
      case 'ArrayBuffer':
      case 'SharedArrayBuffer':
        if (ai.length !== bi.length || !bytesEqual(new Uint8Array(a), new Uint8Array(b))) {
          return false;
        }
        break;
      case 'DataView': {
        const al = dataLength.call(a);
        const bl = dataLength.call(b);
        if (
          al !== bl ||
          !bytesEqual(
            new Uint8Array(dataBuffer.call(a), dataOffset.call(a), al),
            new Uint8Array(dataBuffer.call(b), dataOffset.call(b), bl)
          )
        ) {
          return false;
        }
        break;
      }
      case 'TypedArray':
        if (ai.name !== bi.name) {
          return false;
        }
        // Intrinsic iterator creation validates detached/out-of-bounds views.
        typedValues.call(a);
        typedValues.call(b);
        length = typedLength.call(a);
        if (length !== typedLength.call(b)) {
          return false;
        }
        if (custom) {
          // Elements are exposed values; internal byte/Date payloads are not.
          for (let i = 0; i < length; i++) {
            if (!context.require(node, context.pair(a[i], b[i]))) {
              return false;
            }
          }
        } else {
          for (let i = 0; i < length; i++) {
            if (!sameNumber(a[i], b[i])) {
              return false;
            }
          }
        }
        break;
      default:
        return false;
    }
  }
  return compareProperties(node, context, kind, length, custom);
};
