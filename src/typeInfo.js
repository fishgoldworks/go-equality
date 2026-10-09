'use strict';

// Save native methods so overrides such as map.entries or date.valueOf
// cannot change which built-in contents are compared.
const objectToString = Object.prototype.toString;
const hasOwn = Object.prototype.hasOwnProperty;
const getter = (prototype, name) => Object.getOwnPropertyDescriptor(prototype, name).get;
const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedName = getter(typedPrototype, Symbol.toStringTag);
const typedLength = getter(typedPrototype, 'length');
const typedValues = typedPrototype.values;
const dataLength = getter(DataView.prototype, 'byteLength');
const dataOffset = getter(DataView.prototype, 'byteOffset');
const dataBuffer = getter(DataView.prototype, 'buffer');
const mapSize = getter(Map.prototype, 'size');
const setSize = getter(Set.prototype, 'size');
const bufferLength = getter(ArrayBuffer.prototype, 'byteLength');
const sharedLength =
  typeof SharedArrayBuffer === 'function' ? optionalGetter(SharedArrayBuffer.prototype, 'byteLength') : null;
const dateValue = Date.prototype.getTime;
const regexpSource = getter(RegExp.prototype, 'source');
const regexpFlags = [];
for (const [name, flag] of [
  ['hasIndices', 'd'],
  ['global', 'g'],
  ['ignoreCase', 'i'],
  ['multiline', 'm'],
  ['dotAll', 's'],
  ['unicode', 'u'],
  ['unicodeSets', 'v'],
  ['sticky', 'y']
]) {
  const read = optionalGetter(RegExp.prototype, name);
  if (read) {
    regexpFlags.push(read);
  } else {
    try {
      // An unsupported flag is harmless. A supported flag without its getter
      // cannot be compared safely using overridable instance properties.
      new RegExp('', flag);
      regexpFlags.push(null);
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        throw error;
      }
    }
  }
}
const missingRegExpFlags = regexpFlags.indexOf(null) !== -1;
const unboxers = {
  Number: Number.prototype.valueOf,
  String: String.prototype.valueOf,
  Boolean: Boolean.prototype.valueOf,
  Symbol: Symbol.prototype.valueOf
};
if (typeof BigInt === 'function') {
  // A missing own method must not fall through to Object.prototype.valueOf.
  const descriptor = Object.getOwnPropertyDescriptor(BigInt.prototype, 'valueOf');
  if (descriptor && typeof descriptor.value === 'function') {
    unboxers.BigInt = descriptor.value;
  }
}

function optionalGetter(prototype, name) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
  return descriptor && typeof descriptor.get === 'function' ? descriptor.get : null;
}

function flagBits(value) {
  if (missingRegExpFlags) {
    return null;
  }
  let flags = 0;
  for (let i = 0; i < regexpFlags.length; i++) {
    if (regexpFlags[i].call(value)) {
      flags |= 1 << i;
    }
  }
  return flags;
}

function intrinsicInfo(value, name) {
  if (hasOwn.call(unboxers, name)) {
    return { kind: name, boxed: true, value: unboxers[name].call(value) };
  }
  switch (name) {
    case 'Map':
      return { kind: name, size: mapSize.call(value) };
    case 'Set':
      return { kind: name, size: setSize.call(value) };
    case 'Date':
      return { kind: name, value: dateValue.call(value) };
    case 'RegExp':
      return { kind: name, source: regexpSource.call(value), flags: flagBits(value) };
    case 'ArrayBuffer':
      return { kind: name, length: bufferLength.call(value) };
    case 'SharedArrayBuffer':
      return sharedLength ? { kind: name, length: sharedLength.call(value) } : null;
    default:
      return null;
  }
}

function tryIntrinsic(value, name) {
  // Catch TypeErrors only while native methods check a built-in type. Errors
  // from getters, equals methods, proxy traps and other comparisons pass through.
  try {
    return intrinsicInfo(value, name);
  } catch (error) {
    if (error instanceof TypeError) {
      return null;
    }
    throw error;
  }
}

const ARRAY = Object.freeze({ kind: 'Array' });
const OBJECT = Object.freeze({ kind: 'Object' });
const ARGUMENTS = Object.freeze({ kind: 'Arguments' });
const DATA_VIEW = Object.freeze({ kind: 'DataView' });
const OPAQUE = Object.freeze({ kind: 'Opaque' });

function typeInfo(value) {
  if (Array.isArray(value)) {
    return ARRAY;
  }
  if (ArrayBuffer.isView(value)) {
    const name = typedName.call(value);
    return name ? { kind: 'TypedArray', name } : DATA_VIEW;
  }
  const tag = objectToString.call(value).slice(8, -1);
  const intrinsic = tryIntrinsic(value, tag);
  if (intrinsic) {
    return intrinsic;
  }

  // A Symbol.toStringTag label can be changed or forged. Probe native methods
  // to find the actual built-in type, including when its label is hidden.
  if (Symbol.toStringTag in value) {
    for (const name of ['Map', 'Set', 'Date', 'RegExp', 'ArrayBuffer', 'SharedArrayBuffer', ...Object.keys(unboxers)]) {
      if (name === tag) {
        continue;
      }
      const found = tryIntrinsic(value, name);
      if (found) {
        return found;
      }
    }
    return OPAQUE;
  }
  if (tag === 'Object') {
    return OBJECT;
  }
  if (tag === 'Arguments') {
    return ARGUMENTS;
  }
  return OPAQUE;
}

module.exports = {
  typeInfo,
  mapEntries: Map.prototype.entries,
  mapKeys: Map.prototype.keys,
  mapHas: Map.prototype.has,
  mapGet: Map.prototype.get,
  setValues: Set.prototype.values,
  setHas: Set.prototype.has,
  typedName,
  typedLength,
  typedValues,
  dataLength,
  dataOffset,
  dataBuffer
};
