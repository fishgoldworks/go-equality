'use strict';

const CollectionMatcher = require('./matchCollection');
const { mapEntries, mapKeys, mapHas, mapGet, setValues, setHas } = require('./typeInfo');

// null means structural/unboxing candidates are possible. Functions are atomic:
// distinct functions never compare equal, even when they have equals() methods.
function keyDomain(collection, iterate) {
  let domain = 'empty';
  for (const key of iterate.call(collection)) {
    const type = key === null ? 'null' : typeof key;
    // HTMLDDA is not a primitive undefined key; native membership and loose
    // primitive coercion are not interchangeable for this browser object.
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
  // SameValueZero is exactly the relation on atomic keys in default/strict
  // mode. Loose mode needs a homogeneous type on BOTH sides: native-key
  // matches among mixed types might need reassignment when values differ.
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
    // A full native identity matching proves equality in every mode, including
    // sets of shared object references. It does not reserve a partial matching.
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
