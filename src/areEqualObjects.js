var toString = Object.prototype.toString;

function shouldCompare(val1, val2, stack) {
  var seenVal1 = false;
  var seenVal2 = false;

  if (val1 && typeof val1 === 'object') {
    if (stack.indexOf(val1) === -1) {
      stack.push(val1);
    } else {
      seenVal1 = true;
    }
  }

  if (val2 && typeof val2 === 'object') {
    if (stack.indexOf(val2) === -1) {
      stack.push(val2);
    } else {
      seenVal2 = true;
    }
  }

  // only compare the objects if both of them have not been seen already
  // to prevent endless looping when there is a circular reference.
  return !seenVal1 || !seenVal2;
}

function areEqualObjects(obj, otherObj, stack, equalityChecker) {
  if (obj === otherObj) {
    // Handles primitives and identical object references (also functions)
    return true;
  }

  if (obj == null || otherObj == null) {
    // One is null/undefined and the other is not
    return false;
  }

  // Inline "isObjectLike" check
  var objType = typeof obj;
  var otherType = typeof otherObj;
  var objIsObjectLike = (objType === 'object' || objType === 'function');
  var otherIsObjectLike = (otherType === 'object' || otherType === 'function');

  if (!objIsObjectLike || !otherIsObjectLike) {
    // Fallback strict comparison for safety
    return obj === otherObj;
  }

  if (obj.constructor !== otherObj.constructor) {
    return false;
  }

  var objTag = toString.call(obj);
  var otherTag = toString.call(otherObj);

  if (objTag !== otherTag) {
    return false;
  }

  // --- Boxed primitive types (Number, String, Boolean) ---
  if (
          objTag === "[object Number]" ||
          objTag === "[object String]" ||
          objTag === "[object Boolean]"
          ) {
    var prim1 = obj.valueOf();
    var prim2 = otherObj.valueOf();

    // Numbers: allow NaN equality
    if (typeof prim1 === "number" && typeof prim2 === "number") {
      if (prim1 === prim2) {
        return true;
      }
      // NaN handling
      if (isNaN(prim1) && isNaN(prim2)) {
        return true;
      }
      return false;
    }

    // String / Boolean: strict primitive equality
    return prim1 === prim2;
  }

  // --- Special cases for built-ins (fast paths) ---

  // Date
  if (objTag === '[object Date]') {
    return obj.getTime() === otherObj.getTime();
  }

  // RegExp
  if (objTag === '[object RegExp]') {
    return obj.source === otherObj.source &&
            obj.flags === otherObj.flags;
  }

  // ArrayBuffer
  if (objTag === '[object ArrayBuffer]') {
    if (obj.byteLength !== otherObj.byteLength) {
      return false;
    }
    var view1 = new Uint8Array(obj);
    var view2 = new Uint8Array(otherObj);
    for (var i = 0; i < view1.length; i++) {
      if (view1[i] !== view2[i]) {
        return false;
      }
    }
    return true;
  }

  // Typed arrays & DataView (inline "isArrayBufferView")
  var hasArrayBuffer =
          typeof ArrayBuffer !== 'undefined' &&
          typeof ArrayBuffer.isView === 'function';

  var isView1 = hasArrayBuffer && ArrayBuffer.isView(obj);
  if (isView1) {
    var isView2 = hasArrayBuffer && ArrayBuffer.isView(otherObj);
    if (!isView2) {
      return false;
    }

    if (obj.byteLength !== otherObj.byteLength) {
      return false;
    }

    // DataView: compare underlying bytes
    if (objTag === '[object DataView]') {
      for (var dvIdx = 0; dvIdx < obj.byteLength; dvIdx++) {
        if (obj.getUint8(dvIdx) !== otherObj.getUint8(dvIdx)) {
          return false;
        }
      }
      return true;
    }

    // Typed arrays: element-by-element
    if (obj.length !== otherObj.length) {
      return false;
    }
    for (var taIdx = 0; taIdx < obj.length; taIdx++) {
      if (obj[taIdx] !== otherObj[taIdx]) {
        return false;
      }
    }
    return true;
  }

  // Functions – only equal if they are strictly equal (already handled at top).
  if (objType === 'function' && otherType === 'function') {
    return false;
  }

  // Map
  if (objTag === '[object Map]') {
    if (obj.size !== otherObj.size) {
      return false;
    }

    var matchedKeys = [];
    var mapIter1 = obj.entries();
    var entry1 = mapIter1.next();
    while (!entry1.done) {
      var key1 = entry1.value[0];
      var val1 = entry1.value[1];

      if (otherObj.has(key1)) {
        var otherValFast = otherObj.get(key1);
        if (shouldCompare(val1, otherValFast, stack) &&
                !equalityChecker(val1, otherValFast, stack)) {
          return false;
        }
        entry1 = mapIter1.next();
        continue;
      }

      // Slow path: search by deep-equal key
      var found = false;
      var mapIter2 = otherObj.entries();
      var entry2 = mapIter2.next();
      while (!entry2.done) {
        var key2 = entry2.value[0];
        var val2 = entry2.value[1];

        if (matchedKeys.indexOf(key2) !== -1) {
          entry2 = mapIter2.next();
          continue;
        }

        if (shouldCompare(key1, key2, stack) &&
                equalityChecker(key1, key2, stack)) {
          // Keys match, now compare values
          if (shouldCompare(val1, val2, stack) &&
                  !equalityChecker(val1, val2, stack)) {
            return false;
          }
          matchedKeys.push(key2);
          found = true;
          break;
        }

        entry2 = mapIter2.next();
      }

      if (!found) {
        return false;
      }

      entry1 = mapIter1.next();
    }

    return true;
  }

  // Set
  if (objTag === '[object Set]') {
    if (obj.size !== otherObj.size) {
      return false;
    }

    var used = [];
    var setIter1 = obj.values();
    var v1Res = setIter1.next();
    while (!v1Res.done) {
      var v1 = v1Res.value;

      // Fast path using reference/primitive equality
      if (otherObj.has(v1)) {
        v1Res = setIter1.next();
        continue;
      }

      // Slow path: deep-equal search
      var setIter2 = otherObj.values();
      var v2Res = setIter2.next();
      var foundSet = false;
      while (!v2Res.done) {
        var v2 = v2Res.value;

        if (used.indexOf(v2) !== -1) {
          v2Res = setIter2.next();
          continue;
        }

        if (shouldCompare(v1, v2, stack) &&
                equalityChecker(v1, v2, stack)) {
          used.push(v2);
          foundSet = true;
          break;
        }

        v2Res = setIter2.next();
      }

      if (!foundSet) {
        return false;
      }

      v1Res = setIter1.next();
    }

    return true;
  }

  // Array & arguments
  if (objTag === '[object Array]' || objTag === '[object Arguments]') {
    if (obj.length !== otherObj.length) {
      return false;
    }

    for (var i = 0; i < obj.length; i++) {
      if (!shouldCompare(obj[i], otherObj[i], stack)) {
        continue;
      }
      if (!equalityChecker(obj[i], otherObj[i], stack)) {
        return false;
      }
    }

    return true;
  }

  // --- Fallback: plain objects or other non-special built-ins ---

  var props1 = Object.keys(obj).sort();
  var props2 = Object.keys(otherObj).sort();

  if (props1.length !== props2.length) {
    return false;
  }

  for (var k = 0; k < props1.length; k++) {
    if (props1[k] !== props2[k]) {
      return false;
    }
  }

  for (var j = 0; j < props1.length; j++) {
    var key = props1[j];
    var valObj1 = obj[key];
    var valObj2 = otherObj[key];

    if (!shouldCompare(valObj1, valObj2, stack)) {
      continue;
    }

    if (!equalityChecker(valObj1, valObj2, stack)) {
      return false;
    }
  }

  return true;
}

module.exports = areEqualObjects;