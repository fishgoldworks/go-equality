var areEqualObjects = require("./areEqualObjects");

function checkLooseEquality(value, other, stack) {
  // JS loose equality (primitives + same references)
  if (value == other) {
    return true;
  }

  // Both are object-like -> structural comparison
  if (value instanceof Object && other instanceof Object) {
    return areEqualObjects(value, other, stack || [], checkLooseEquality);
  }

  // NaN (including boxed Number)
  if (
          (typeof value === "number" || value instanceof Number) &&
          (typeof other === "number" || other instanceof Number) &&
          isNaN(value) &&
          isNaN(other)
          ) {
    return true;
  }

  return false;
}

module.exports = checkLooseEquality;