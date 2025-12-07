var areEqualObjects = require("./areEqualObjects");
var unwrap = require("./unwrap");

function checkEquality(value, other, stack) {
  // Unwrap boxed primitives (Number, String, Boolean)
  value = value instanceof Object ? unwrap(value) : value;
  other = other instanceof Object ? unwrap(other) : other;

  // Strict equality for primitives and identical references
  if (value === other) {
    return true;
  }

  // Deep compare objects via areEqualObjects
  if (value instanceof Object && other instanceof Object) {
    return areEqualObjects(value, other, stack || [], checkEquality);
  }

  // Treat NaN as equal to NaN (custom semantics)
  if (typeof value === "number" && typeof other === "number" && isNaN(value) && isNaN(other)) {
    return true;
  }

  return false;
}

module.exports = checkEquality;