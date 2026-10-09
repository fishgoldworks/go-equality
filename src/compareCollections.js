'use strict';

const CollectionMatcher = require('./matchCollection');
const { mapEntries, mapKeys, mapHas, mapGet, setValues, setHas } = require('./typeInfo');

// null means keys may need structural comparison or wrapper unboxing.
// In these standard modes, functions match only by reference.
function keyDomain(collection, iterate) {
  let domain = 'empty';
  for (const key of iterate.call(collection)) {
    const type = key === null ? 'null' : typeof key;
    // document.all is an object despite its typeof result. It must not use
    // the native-key shortcut for primitive undefined values.
    if (type === 'object' || (type === 'undefined' && key !== undefined)) {
      return null;
    }
    if (domain === 'empty') {
      domain = type;
    } else if (domain !== type) {
      domain = 'mixed';
    }
  }
  return domain;
}

function nativeRelation(a, b, iterate, mode) {
  const left = keyDomain(a, iterate);
  if (left === null) {
    return false;
  }
  const right = keyDomain(b, iterate);
  // Native SameValueZero checks match default/strict rules for these keys.
  // Loose mode also requires one common type across both collections; mixed
  // types may need matches reassigned when the associated values differ.
  return right !== null && (mode !== 'loose' || (left !== 'mixed' && left === right));
}

module.exports = function compareCollections(node, context, isMap, size, custom = false) {
  if (size === 0) {
    return true;
  }
  const a = node.left;
  const b = node.right;
  if (!custom && !isMap) {
    let allPresent = true;
    for (const value of setValues.call(a)) {
      if (!setHas.call(b, value)) {
        allPresent = false;
        break;
      }
    }
    // If every member is present, these same-sized Sets match in each standard
    // mode, including shared object members. Partial matches reserve nothing.
    if (allPresent) {
      return true;
    }
    if (nativeRelation(a, b, setValues, context.mode)) {
      return false;
    }
  } else if (!custom && nativeRelation(a, b, mapKeys, context.mode)) {
    for (const [key, value] of mapEntries.call(a)) {
      if (!mapHas.call(b, key)) {
        return false;
      }
      const other = mapGet.call(b, key);
      if (value !== other && !context.require(node, context.pair(value, other))) {
        return false;
      }
    }
    return true;
  }
  const iterate = isMap ? mapEntries : setValues;
  node.collection = new CollectionMatcher(
    node,
    context,
    Array.from(iterate.call(a)),
    Array.from(iterate.call(b)),
    isMap
  );
  return true;
};
