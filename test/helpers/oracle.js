'use strict';
// Deliberately independent, slow reference for small, stable object/array/Map/Set
// graphs. It eagerly enumerates EVERY object pair and EVERY possible matching.
// It shares no production code, lazy-edge strategy, queue or augmenting paths.
const isObject = (value) => value !== null && typeof value === 'object';
function perfectMatching(matrix) {
  const used = new Set();
  function search(row) {
    if (row === matrix.length) {
      return true;
    }
    for (let column = 0; column < matrix.length; column++) {
      if (!used.has(column) && matrix[row][column]) {
        used.add(column);
        if (search(row + 1)) {
          return true;
        }
        used.delete(column);
      }
    }
    return false;
  }
  return search(0);
}
function collect(root) {
  const result = [];
  const ids = new Map();
  function add(value) {
    if (isObject(value) && !ids.has(value)) {
      ids.set(value, result.length);
      result.push(value);
    }
  }
  add(root);
  for (let i = 0; i < result.length; i++) {
    const value = result[i];
    for (const key of Reflect.ownKeys(value)) {
      add(value[key]);
    }
    if (value instanceof Map) {
      for (const [key, item] of value) {
        add(key);
        add(item);
      }
    }
    if (value instanceof Set) {
      for (const item of value) {
        add(item);
      }
    }
  }
  return { nodes: result, ids };
}
function graphEqual(left, right, mode, customizer) {
  const a = collect(left),
    b = collect(right);
  const relation = a.nodes.map(() => b.nodes.map(() => true));
  function equal(x, y) {
    const decision = customizer ? customizer(x, y) : undefined;
    if (decision !== undefined) {
      return decision;
    }
    if (x === y) {
      return true;
    }
    const xo = isObject(x),
      yo = isObject(y);
    if (xo !== yo) {
      return false;
    }
    if (xo) {
      return relation[a.ids.get(x)][b.ids.get(y)];
    }
    // eslint-disable-next-line eqeqeq -- Loose primitive comparison is the documented equality contract.
    return (x !== x && y !== y) || (mode === 'isLooseEqual' && x == y);
  }
  function valid(x, y) {
    const decision = customizer ? customizer(x, y) : undefined;
    if (decision !== undefined) {
      return decision;
    }
    if (x === y) {
      return true;
    }
    const tag = (v) => (Array.isArray(v) ? 'array' : v instanceof Map ? 'map' : v instanceof Set ? 'set' : 'object');
    if (tag(x) !== tag(y)) {
      return false;
    }
    // Array length is structural; a value callback cannot waive it indirectly.
    if (Array.isArray(x) && x.length !== y.length) {
      return false;
    }
    const keys = Reflect.ownKeys(x);
    if (keys.length !== Reflect.ownKeys(y).length) {
      return false;
    }
    if (!keys.every((k) => Object.hasOwn(y, k) && equal(x[k], y[k]))) {
      return false;
    }
    if (x instanceof Set) {
      if (x.size !== y.size) {
        return false;
      }
      return perfectMatching([...x].map((v) => [...y].map((w) => equal(v, w))));
    }
    if (x instanceof Map) {
      if (x.size !== y.size) {
        return false;
      }
      return perfectMatching([...x].map(([k, v]) => [...y].map(([l, w]) => equal(k, l) && equal(v, w))));
    }
    return true;
  }
  let changed;
  do {
    changed = false;
    for (let i = 0; i < a.nodes.length; i++) {
      for (let j = 0; j < b.nodes.length; j++) {
        if (relation[i][j] && !valid(a.nodes[i], b.nodes[j])) {
          relation[i][j] = false;
          changed = true;
        }
      }
    }
  } while (changed);
  return equal(left, right);
}
module.exports = { perfectMatching, graphEqual };
