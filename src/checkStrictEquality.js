var areEqualObjects = require("./areEqualObjects");

function checkStrictEquality(value, other, stack) {
  // Strict equality for primitives and identical references
  if (value === other) {
    return true;
  }

  // Deep compare objects via areEqualObjects using strict semantics
  if (value instanceof Object && other instanceof Object) {
    return areEqualObjects(value, other, stack || [], checkStrictEquality);
  }

  // Treat NaN as strictly equal to NaN (custom semantics)
  if (typeof value === "number" && typeof other === "number" && isNaN(value) && isNaN(other)) {
    return true;
  }

  return false;
}

module.exports = checkStrictEquality;