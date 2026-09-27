'use strict';

// Capture intrinsics: user overrides such as map.entries or date.valueOf must
// not replace the built-in payload being compared.
const objectToString = Object.prototype.toString;
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
const sharedLength = typeof SharedArrayBuffer === 'undefined' ? null : getter(SharedArrayBuffer.prototype, 'byteLength');
const dateValue = Date.prototype.getTime;
const regexpSource = getter(RegExp.prototype, 'source');
const regexpFlags = ['hasIndices', 'global', 'ignoreCase', 'multiline', 'dotAll', 'unicode', 'unicodeSets', 'sticky']
  .map(name => Object.getOwnPropertyDescriptor(RegExp.prototype, name)?.get).filter(Boolean);
const unboxers = {
  Number: Number.prototype.valueOf,
  String: String.prototype.valueOf,
  Boolean: Boolean.prototype.valueOf,
  BigInt: BigInt.prototype.valueOf,
  Symbol: Symbol.prototype.valueOf
};

function flagBits(value) {
  let flags = 0;
  for (let i = 0; i < regexpFlags.length; i++) if (regexpFlags[i].call(value)) flags |= 1 << i;
  return flags;
}

function intrinsicInfo(value, name) {
  if (Object.hasOwn(unboxers, name)) return { kind: name, boxed: true, value: unboxers[name].call(value) };
  switch (name) {
    case 'Map': return { kind: name, size: mapSize.call(value) };
    case 'Set': return { kind: name, size: setSize.call(value) };
    case 'Date': return { kind: name, value: dateValue.call(value) };
    case 'RegExp': return { kind: name, source: regexpSource.call(value), flags: flagBits(value) };
    case 'ArrayBuffer': return { kind: name, length: bufferLength.call(value) };
    case 'SharedArrayBuffer': return sharedLength ? { kind: name, length: sharedLength.call(value) } : null;
    default: return null;
  }
}

function tryIntrinsic(value, name) {
  // Only intrinsic brand probes are caught here. User getters, equals methods,
  // proxy traps and comparisons outside this function retain their exceptions.
  try { return intrinsicInfo(value, name); } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

const ARRAY = Object.freeze({ kind: 'Array' });
const OBJECT = Object.freeze({ kind: 'Object' });
const ARGUMENTS = Object.freeze({ kind: 'Arguments' });
const DATA_VIEW = Object.freeze({ kind: 'DataView' });
const OPAQUE = Object.freeze({ kind: 'Opaque' });

function typeInfo(value) {
  if (Array.isArray(value)) return ARRAY;
  if (ArrayBuffer.isView(value)) {
    const name = typedName.call(value);
    return name ? { kind: 'TypedArray', name } : DATA_VIEW;
  }
  const tag = objectToString.call(value).slice(8, -1);
  const intrinsic = tryIntrinsic(value, tag);
  if (intrinsic) return intrinsic;

  // Symbol.toStringTag is not a trustworthy brand. Recognise supported built-ins
  // even when their tag is masked; never call payload methods on a forged tag.
  if (Symbol.toStringTag in value) {
    for (const name of ['Map', 'Set', 'Date', 'RegExp', 'ArrayBuffer', 'SharedArrayBuffer', ...Object.keys(unboxers)]) {
      if (name === tag) continue;
      const found = tryIntrinsic(value, name);
      if (found) return found;
    }
    return OPAQUE;
  }
  if (tag === 'Object') return OBJECT;
  if (tag === 'Arguments') return ARGUMENTS;
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
  typedLength,
  typedValues,
  dataLength,
  dataOffset,
  dataBuffer
};
