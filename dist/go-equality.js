/*! go-equality v2.0.0 | Copyright (c) 2022-2026 Michael Ko | LGPL-3.0-only */
(function (root, factory) {
  if (typeof module === 'object' && module !== null && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.Equality = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const modules = [
function(module, exports, __require) {
"use strict";
exports.isEqual = __require(1);
exports.isLooseEqual = __require(12);
exports.isStrictEqual = __require(11);

},
function(module, exports, __require) {
"use strict";

const compare = __require(2);

/**
 * Deep value equality with genuine primitive wrappers unboxed.
 * NaN equals NaN; +0 equals -0. Identical references always compare equal.
 * Supports cycles, unordered Maps/Sets, own non-enumerable/symbol properties
 * and bilateral boolean equals() methods. See README for the full contract.
 * @param {*} value The first value.
 * @param {*} other The second value.
 * @returns {boolean} Whether the values compare equal under this mode.
 * @throws {TypeError} When a custom equals() method returns a non-boolean.
 * Exceptions from invoked user code and invalid detached views propagate.
 */
function isEqual(value, other) {
  return compare(value, other, 'default');
}

module.exports = isEqual;

// Stable aliases: extracting a method never depends on an implicit receiver.
const { custom, create } = __require(9);
Object.defineProperties(module.exports, {
  strict: { value: __require(11) },
  loose: { value: __require(12) },
  custom: { value: custom },
  create: { value: create }
});

},
function(module, exports, __require) {
'use strict';

const ComparisonContext = __require(3);

module.exports = function compare(value, other, mode) {
  if (value === other) return true;
  // Browser document.all is an object despite its unusual typeof-undefined result.
  const leftType = typeof value;
  const rightType = typeof other;
  const leftObject = value !== null && (leftType === 'object' || leftType === 'function' || (leftType === 'undefined' && value !== undefined));
  const rightObject = other !== null && (rightType === 'object' || rightType === 'function' || (rightType === 'undefined' && other !== undefined));
  if (!leftObject && !rightObject) return (value !== value && other !== other) || (mode === 'loose' && value == other);
  if (leftType === 'function' || rightType === 'function') return false;
  return new ComparisonContext(mode).run(value, other);
};

},
function(module, exports, __require) {
'use strict';

const compareObjects = __require(4);
const { typeInfo } = __require(8);

// Include browser HTMLDDA objects without allocating primitive wrappers.
const isObject = value => value !== null && (typeof value === 'object' || (typeof value === 'undefined' && value !== undefined));
const sameValueZero = (a, b) => a === b || (a !== a && b !== b);

class ComparisonContext {
  constructor(mode) {
    this.mode = mode;
    // The context never escapes one synchronous comparison. Its nodes already
    // hold their inputs strongly; Map avoids a WeakMap allocation for EVERY row.
    this.pairs = new Map();
    this.types = new Map();
    this.pending = [];
  }

  info(value) {
    let info = this.types.get(value);
    if (!info) {
      info = typeInfo(value);
      this.types.set(value, info);
    }
    return info;
  }

  pair(left, right, queue = true) {
    if (left === right) return true;
    if (typeof left === 'function' || typeof right === 'function') return false;
    let leftObject = isObject(left);
    let rightObject = isObject(right);
    if (this.mode !== 'strict') {
      if (leftObject) {
        const info = this.info(left);
        if (info.boxed) { left = info.value; leftObject = false; }
      }
      if (rightObject) {
        const info = this.info(right);
        if (info.boxed) { right = info.value; rightObject = false; }
      }
    }
    if (!leftObject && !rightObject) {
      // Deliberately limit coercion to primitives: [] is not equal to 0.
      return sameValueZero(left, right) || (this.mode === 'loose' && left == right);
    }
    if (!leftObject || !rightObject) return false;
    const first = this.pairs.get(left);
    if (first) {
      if (first.right === right) return this.reference(first);
      const known = first.alternatives && first.alternatives.get(right);
      if (known) return this.reference(known);
    }
    const node = {
      left, right, valid: true, expanded: false, queued: queue,
      dependants: null, watchers: null, collection: null,
      alternatives: null, hasDependencies: false
    };
    if (!first) this.pairs.set(left, node);
    else {
      if (!first.alternatives) first.alternatives = new Map();
      first.alternatives.set(right, node);
    }
    if (queue) this.pending.push(node);
    return node;
  }

  reference(node) {
    if (!node.valid) return false;
    // A fully checked leaf has no provisional assumptions to invalidate. Self
    // edges are tautologies in the greatest-fixed-point relation, not blockers.
    return node.expanded && !node.hasDependencies && !node.collection ? true : node;
  }

  probe(left, right) {
    // Most rejected collection candidates are settled leaves. Expand them now
    // without first retaining a queue entry for every unsuccessful trial.
    const ref = this.pair(left, right, false);
    if (typeof ref === 'boolean') return ref;
    const unexpanded = !ref.expanded;
    this.expand(ref);
    if (!ref.queued && !ref.hasDependencies && !ref.collection) {
      // The collection edge cache retains the boolean result. A settled leaf
      // cannot later be invalidated; provisional graph nodes MUST stay indexed.
      this.forgetLeaf(ref);
      return ref.valid;
    }
    // Only a newly expanded collection needs its initial matching queued here.
    // Re-enqueuing an already expanded cyclic ancestor would never terminate.
    if (unexpanded && ref.collection) this.enqueue(ref);
    return this.reference(ref);
  }

  forgetLeaf(node) {
    const first = this.pairs.get(node.left);
    if (first === node) {
      // An index header that also owns alternative pairs must remain available.
      if (!node.alternatives) this.pairs.delete(node.left);
    } else first.alternatives.delete(node.right);
  }

  expand(node) {
    if (node.expanded || !node.valid) return;
    if (!compareObjects(node, this)) this.invalidate(node);
    node.expanded = true;
  }

  enqueue(node) {
    if (node.valid && !node.queued) { node.queued = true; this.pending.push(node); }
  }

  watch(parent, ref) {
    if (typeof ref !== 'boolean') {
      // Probing a later edge can disprove an earlier edge on the same
      // augmenting path. A newly attached observer must see that failure too.
      if (!ref.valid) { this.enqueue(parent); return; }
      if (!ref.watchers) ref.watchers = new Set();
      ref.watchers.add(parent);
    }
  }

  require(parent, ref) {
    if (typeof ref === 'boolean') return ref;
    if (!ref.valid) return false;
    if (ref === parent) return true;
    parent.hasDependencies = true;
    // Most deterministic children have just one parent. Allocate an array only
    // for genuine sharing; adjacent duplicate dependencies need no new entry.
    const parents = ref.dependants;
    if (!parents) ref.dependants = parent;
    else if (Array.isArray(parents)) {
      if (parents[parents.length - 1] !== parent) parents.push(parent);
    } else if (parents !== parent) ref.dependants = [parents, parent];
    return true;
  }

  invalidate(node) {
    const invalid = [node];
    while (invalid.length) {
      const current = invalid.pop();
      if (!current.valid) continue;
      current.valid = false;
      // Required property/value edges propagate failure immediately. Only
      // alternative collection edges need a queued matching repair.
      if (current.watchers) for (const parent of current.watchers) this.enqueue(parent);
      const parents = current.dependants;
      if (Array.isArray(parents)) {
        for (const parent of parents) if (parent.valid) invalid.push(parent);
      } else if (parents && parents.valid) invalid.push(parents);
    }
  }

  run(left, right) {
    const root = this.pair(left, right);
    if (typeof root === 'boolean') return root;
    // A finite, monotone greatest fixed point: assumptions only turn false.
    // Drain/reuse the FIFO queue rather than retaining a processed entry for
    // every level of a deep chain. Mandatory invalidation is also iterative.
    let next = 0;
    while (this.pending.length && root.valid) {
      const node = this.pending[next];
      this.pending[next++] = null;
      if (next === this.pending.length) { this.pending.length = 0; next = 0; }
      node.queued = false;
      if (!node.valid) continue;
      this.expand(node);
      if (node.valid && node.collection && !node.collection.validate()) this.invalidate(node);
    }
    return root.valid;
  }
}

module.exports = ComparisonContext;

},
function(module, exports, __require) {
'use strict';

const compareProperties = __require(5);
const compareCollections = __require(6);
const { typedLength, typedValues, dataLength, dataOffset, dataBuffer } = __require(8);

// Call the hook itself, not a user-controlled property named call.
const apply = Reflect.apply;

function hook(object, method, other) {
  const result = apply(method, object, [other]);
  if (typeof result !== 'boolean') throw new TypeError('equals() must return a boolean.');
  return result;
}

function sameNumber(a, b) {
  return a === b || (a !== a && b !== b);
}

function bytesEqual(a, b) {
  const length = a.length;
  if (length !== b.length) return false;
  let start = 0;
  // These byte views are created internally, not supplied/overridden by users.
  // Aligned word comparisons cover identical bytes on either endianness; keep
  // unaligned views and the final 0-3 bytes on the ordinary byte path.
  if (length >= 64 && (a.byteOffset & 3) === 0 && (b.byteOffset & 3) === 0) {
    const count = Math.floor(length / 4);
    const left = new Uint32Array(a.buffer, a.byteOffset, count);
    const right = new Uint32Array(b.buffer, b.byteOffset, count);
    for (let i = 0; i < count; i++) if (left[i] !== right[i]) return false;
    start = count * 4;
  }
  for (let i = start; i < length; i++) if (a[i] !== b[i]) return false;
  return true;
}

module.exports = function compareObjects(node, context, custom = false) {
  const a = node.left;
  const b = node.right;
  const leftHook = a.equals;
  const rightHook = b.equals;
  const hasLeftHook = typeof leftHook === 'function';
  const hasRightHook = typeof rightHook === 'function';
  if (hasLeftHook && !hook(a, leftHook, b)) return false;
  if (hasRightHook && !hook(b, rightHook, a)) return false;
  if (hasLeftHook && hasRightHook) return true;

  if (context.mode !== 'loose' && a.constructor !== b.constructor) return false;
  const ai = context.info(a);
  const bi = context.info(b);
  if (ai.kind !== bi.kind) return false;
  const kind = ai.kind;
  let length = 0;

  if (ai.boxed) {
    if (!sameNumber(ai.value, bi.value)) return false;
  } else {
    switch (kind) {
      case 'Object':
      case 'Arguments':
        break;
      case 'Array':
        if (a.length !== b.length) return false;
        break;
      case 'Date':
        if (!sameNumber(ai.value, bi.value)) return false;
        break;
      case 'RegExp':
        if (ai.source !== bi.source || ai.flags !== bi.flags) return false;
        break;
      case 'Map':
      case 'Set': {
        if (ai.size !== bi.size) return false;
        if (!compareCollections(node, context, kind === 'Map', ai.size, custom)) return false;
        break;
      }
      case 'ArrayBuffer':
      case 'SharedArrayBuffer':
        if (ai.length !== bi.length || !bytesEqual(new Uint8Array(a), new Uint8Array(b))) return false;
        break;
      case 'DataView': {
        const al = dataLength.call(a);
        const bl = dataLength.call(b);
        if (al !== bl || !bytesEqual(
          new Uint8Array(dataBuffer.call(a), dataOffset.call(a), al),
          new Uint8Array(dataBuffer.call(b), dataOffset.call(b), bl)
        )) return false;
        break;
      }
      case 'TypedArray':
        if (ai.name !== bi.name) return false;
        // Intrinsic iterator creation validates detached/out-of-bounds views.
        typedValues.call(a);
        typedValues.call(b);
        length = typedLength.call(a);
        if (length !== typedLength.call(b)) return false;
        if (custom) {
          // Elements are exposed values; internal byte/Date payloads are not.
          for (let i = 0; i < length; i++) {
            if (!context.require(node, context.pair(a[i], b[i]))) return false;
          }
        } else {
          for (let i = 0; i < length; i++) if (!sameNumber(a[i], b[i])) return false;
        }
        break;
      default:
        return false;
    }
  }
  return compareProperties(node, context, kind, length, custom);
};

},
function(module, exports, __require) {
'use strict';

const hasOwn = Object.prototype.hasOwnProperty;

function ownKeys(value, kind) {
  const keys = Reflect.ownKeys(value);
  if (kind === 'Arguments') {
    // Strict arguments.callee is a poison accessor, not application state.
    return keys.filter(key => key !== 'callee' && key !== Symbol.iterator);
  }
  return keys;
}

module.exports = function compareProperties(node, context, kind, length = 0, custom = false) {
  const a = node.left;
  const b = node.right;
  const keys = ownKeys(a, kind);
  const otherKeys = ownKeys(b, kind);
  if (keys.length !== otherKeys.length) return false;
  // Real typed arrays enumerate validated element indices first, followed by
  // other strings and symbols (ECMA-262 [[OwnPropertyKeys]]). The numeric
  // payload was already checked; skip it without filtering/converting every key.
  const start = kind === 'TypedArray' ? length : 0;
  for (let i = start; i < keys.length; i++) {
    // The corresponding own key already proves membership in the usual
    // same-order case. Different insertion orders still compare unordered.
    if (keys[i] !== otherKeys[i] && !hasOwn.call(b, keys[i])) return false;
  }
  if (custom) {
    for (let i = start; i < keys.length; i++) {
      const key = keys[i];
      if (!context.require(node, context.pair(a[key], b[key]))) return false;
    }
    return true;
  }
  for (let i = start; i < keys.length; i++) {
    const key = keys[i];
    const left = a[key];
    const right = b[key];
    // Most ordinary properties are equal primitives or shared references.
    if (left !== right && !context.require(node, context.pair(left, right))) return false;
  }
  return true;
};

},
function(module, exports, __require) {
'use strict';

const CollectionMatcher = __require(7);
const { mapEntries, mapKeys, mapHas, mapGet, setValues, setHas } = __require(8);

// null means structural/unboxing candidates are possible. Functions are atomic:
// distinct functions never compare equal, even when they have equals() methods.
function keyDomain(collection, iterate) {
  let domain = 'empty';
  for (const key of iterate.call(collection)) {
    const type = key === null ? 'null' : typeof key;
    // HTMLDDA is not a primitive undefined key; native membership and loose
    // primitive coercion are not interchangeable for this browser object.
    if (type === 'object' || (type === 'undefined' && key !== undefined)) return null;
    if (domain === 'empty') domain = type;
    else if (domain !== type) domain = 'mixed';
  }
  return domain;
}

function nativeRelation(a, b, iterate, mode) {
  const left = keyDomain(a, iterate);
  if (left === null) return false;
  const right = keyDomain(b, iterate);
  // SameValueZero is exactly the relation on atomic keys in default/strict
  // mode. Loose mode needs a homogeneous type on BOTH sides: native-key
  // matches among mixed types might need reassignment when values differ.
  return right !== null && (mode !== 'loose' || (left !== 'mixed' && left === right));
}

module.exports = function compareCollections(node, context, isMap, size, custom = false) {
  if (size === 0) return true;
  const a = node.left;
  const b = node.right;
  if (!custom && !isMap) {
    let allPresent = true;
    for (const value of setValues.call(a)) {
      if (!setHas.call(b, value)) { allPresent = false; break; }
    }
    // A full native identity matching proves equality in every mode, including
    // sets of shared object references. It does not reserve a partial matching.
    if (allPresent) return true;
    if (nativeRelation(a, b, setValues, context.mode)) return false;
  } else if (!custom && nativeRelation(a, b, mapKeys, context.mode)) {
    for (const [key, value] of mapEntries.call(a)) {
      if (!mapHas.call(b, key)) return false;
      const other = mapGet.call(b, key);
      if (value !== other && !context.require(node, context.pair(value, other))) return false;
    }
    return true;
  }
  const iterate = isMap ? mapEntries : setValues;
  node.collection = new CollectionMatcher(node, context, Array.from(iterate.call(a)), Array.from(iterate.call(b)), isMap);
  return true;
};

},
function(module, exports, __require) {
'use strict';

// Lazy bipartite matching. Native hits are preferred, not reserved: loose or
// custom equality may need an augmenting path to reassign an earlier match.
class CollectionMatcher {
  constructor(node, context, left, right, isMap) {
    this.node = node;
    this.context = context;
    this.left = left;
    this.right = right;
    this.isMap = isMap;
    this.size = left.length;
    this.leftMatch = new Int32Array(this.size).fill(-1);
    this.rightMatch = new Int32Array(this.size).fill(-1);
    this.edges = new Array(this.size);
    this.rejected = null;
    this.rejectionCounts = null;
    this.rightIndex = new Map();
    for (let i = 0; i < right.length; i++) this.rightIndex.set(isMap ? right[i][0] : right[i], i);
    this.visited = null;
    this.parent = null;
    this.rows = null;
  }

  edge(i, j) {
    const rejected = this.rejected && this.rejected[i];
    if (rejected && (rejected[j >>> 3] & (1 << (j & 7)))) return false;
    let row = this.edges[i];
    if (!row) this.edges[i] = row = new Map();
    let ref = row.get(j);
    if (ref === undefined) {
      const a = this.left[i];
      const b = this.right[j];
      ref = this.context.probe(this.isMap ? a[0] : a, this.isMap ? b[0] : b);
      if (this.isMap && ref !== false) {
        const value = this.context.probe(a[1], b[1]);
        if (value === false || ref === true) ref = value;
        else if (value !== true) ref = [ref, value];
      }
      if (ref === false) this.reject(i, j, row, rejected);
      else row.set(j, ref);
    }
    // Settled leaves and failures use booleans, with no reference-array or
    // watcher allocation. Only genuinely provisional key/value pairs need two.
    if (typeof ref === 'boolean') return ref;
    return Array.isArray(ref) ? ref[0].valid && ref[1].valid : ref.valid;
  }

  reject(i, j, row, rejected) {
    if (rejected) {
      rejected[j >>> 3] |= 1 << (j & 7);
      return;
    }
    row.set(j, false);
    if (!this.rejectionCounts) this.rejectionCounts = new Uint8Array(this.size);
    if (++this.rejectionCounts[i] !== 64) return;
    // Sparse/identity rows remain Maps. After many settled failures, retain one
    // bit per rejected column rather than a Map entry per failed candidate.
    // Positive and provisional edges MUST remain references, not optimistic bits.
    if (!this.rejected) this.rejected = new Array(this.size);
    const bits = this.rejected[i] = new Uint8Array(Math.ceil(this.size / 8));
    for (const [column, ref] of row) {
      if (ref === false) {
        bits[column >>> 3] |= 1 << (column & 7);
        row.delete(column);
      }
    }
  }

  preferred(i) {
    return this.rightIndex.get(this.isMap ? this.left[i][0] : this.left[i]);
  }

  assign(i, j) {
    this.leftMatch[i] = j;
    this.rightMatch[j] = i;
    const ref = this.edges[i].get(j);
    // Recheck a collection when a CHOSEN edge is disproved, not every rejected
    // candidate. Old watchers may remain safely: removing one would need ref
    // counts when several chosen edges share the same pair.
    if (Array.isArray(ref)) {
      this.context.watch(this.node, ref[0]);
      this.context.watch(this.node, ref[1]);
    } else this.context.watch(this.node, ref);
  }

  augment(start) {
    const preferred = this.preferred(start);
    if (preferred !== undefined && this.rightMatch[preferred] === -1 && this.edge(start, preferred)) {
      this.assign(start, preferred);
      return true;
    }
    // Reuse scratch space across searches. Parent slots are written before
    // use; only the visited mask needs resetting for each augmenting path.
    if (!this.visited) {
      this.visited = new Uint8Array(this.size);
      this.parent = new Int32Array(this.size);
      this.rows = new Int32Array(this.size);
    } else this.visited.fill(0);
    const visited = this.visited;
    const parent = this.parent;
    const rows = this.rows;
    rows[0] = start;
    let count = 1;
    for (let next = 0; next < count; next++) {
      const i = rows[next];
      const first = this.preferred(i);
      for (let step = -1; step < this.size; step++) {
        const j = step === -1 ? first : step;
        if (j === undefined || (step !== -1 && j === first) || visited[j] || !this.edge(i, j)) continue;
        visited[j] = 1;
        parent[j] = i;
        const previous = this.rightMatch[j];
        if (previous !== -1) {
          rows[count++] = previous;
          continue;
        }
        let column = j;
        while (column !== -1) {
          const row = parent[column];
          const oldColumn = this.leftMatch[row];
          this.assign(row, column);
          column = oldColumn;
        }
        return true;
      }
    }
    return false;
  }

  validate() {
    // Invalidated cyclic assumptions can reopen assignments. Only the absence
    // of a full matching disproves a collection, not an individual candidate.
    for (let i = 0; i < this.size; i++) {
      const j = this.leftMatch[i];
      if (j !== -1 && !this.edge(i, j)) {
        this.leftMatch[i] = -1;
        this.rightMatch[j] = -1;
      }
    }
    for (let i = 0; i < this.size; i++) {
      if (this.leftMatch[i] === -1 && !this.augment(i)) return false;
    }
    return true;
  }
}

module.exports = CollectionMatcher;

},
function(module, exports, __require) {
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

},
function(module, exports, __require) {
'use strict';

const CustomComparisonContext = __require(10);

function configuration(customizer, options) {
  if (typeof customizer !== 'function') throw new TypeError('Equality customizer must be a function.');
  if (options === undefined) return 'default';
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Equality options must be an object.');
  }
  for (const key of Reflect.ownKeys(options)) {
    if (key !== 'mode') throw new TypeError('Unknown equality option; only mode is supported.');
  }
  // Ignore inherited options; read a getter at most once when snapshotting.
  const mode = Object.hasOwn(options, 'mode') ? options.mode : undefined;
  if (mode === undefined) return 'default';
  if (mode !== 'default' && mode !== 'strict' && mode !== 'loose') {
    throw new TypeError('Equality mode must be default, strict, or loose.');
  }
  return mode;
}

function custom(value, other, customizer, options) {
  const mode = configuration(customizer, options);
  return new CustomComparisonContext(mode, customizer).run(value, other);
}

function create(customizer, options) {
  const mode = configuration(customizer, options);
  // Retain configuration only. Graph/candidate caches are new for EVERY call,
  // including calls following an exception or a change to previously used data.
  return function isCustomEqual(value, other) {
    return new CustomComparisonContext(mode, customizer).run(value, other);
  };
}

module.exports = { custom, create };

},
function(module, exports, __require) {
'use strict';

const ComparisonContext = __require(3);
const compareObjects = __require(4);

// Opt-in traversal shares the existing graph engine, but never lets an identity
// or native-membership shortcut bypass a caller's decision on a reached pair.
class CustomComparisonContext extends ComparisonContext {
  constructor(mode, customizer) {
    super(mode);
    this.customizer = customizer;
  }

  pair(left, right, queue = true) {
    // A local call avoids exposing the comparison context as the callback's this.
    // Original values reach the customizer before unboxing or instance hooks.
    const customizer = this.customizer;
    const result = customizer(left, right);
    if (result === true || result === false) return result;
    if (result !== undefined) {
      throw new TypeError('Equality customizer must return true, false, or undefined.');
    }
    return super.pair(left, right, queue);
  }

  expand(node) {
    if (node.expanded || !node.valid) return;
    if (!compareObjects(node, this, true)) this.invalidate(node);
    node.expanded = true;
  }
}

module.exports = CustomComparisonContext;

},
function(module, exports, __require) {
"use strict";

const compare = __require(2);

/**
 * Deep equality preserving primitive types, wrappers and constructors.
 * NaN equals NaN; +0 equals -0. Identical references always compare equal.
 * Supports cycles, unordered Maps/Sets, own non-enumerable/symbol properties
 * and bilateral boolean equals() methods. See README for the full contract.
 * @param {*} value The first value.
 * @param {*} other The second value.
 * @returns {boolean} Whether the values compare equal under this mode.
 * @throws {TypeError} When a custom equals() method returns a non-boolean.
 * Exceptions from invoked user code and invalid detached views propagate.
 */
function isStrictEqual(value, other) {
  return compare(value, other, 'strict');
}

module.exports = isStrictEqual;

},
function(module, exports, __require) {
"use strict";

const compare = __require(2);

/**
 * Deep equality with primitive coercion and constructor-independent structure.
 * NaN equals NaN; +0 equals -0. Identical references always compare equal.
 * Supports cycles, unordered Maps/Sets, own non-enumerable/symbol properties
 * and bilateral boolean equals() methods. See README for the full contract.
 * @param {*} value The first value.
 * @param {*} other The second value.
 * @returns {boolean} Whether the values compare equal under this mode.
 * @throws {TypeError} When a custom equals() method returns a non-boolean.
 * Exceptions from invoked user code and invalid detached views propagate.
 */
function isLooseEqual(value, other) {
  return compare(value, other, 'loose');
}

module.exports = isLooseEqual;

}
  ];
  const cache = Object.create(null);
  function __require(id) {
    if (cache[id]) return cache[id].exports;
    const module = { exports: {} };
    cache[id] = module;
    modules[id](module, module.exports, __require);
    return module.exports;
  }
  return __require(0);
});
