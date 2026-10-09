'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const api = require('./helpers/api');
const { perfectMatching, graphEqual } = require('./helpers/oracle');

// Check all 512 possible match patterns between two groups of three values,
// comparing each pattern in both directions.
for (let bits = 0; bits < 512; bits++) {
  const matrix = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => !!(bits & (1 << (i * 3 + j))))
  );
  const expected = perfectMatching(matrix);
  class V {
    constructor(side, index) {
      this.side = side;
      this.index = index;
    }
    equals(other) {
      return (
        other instanceof V &&
        this.side !== other.side &&
        (this.side === 'left' ? matrix[this.index][other.index] : matrix[other.index][this.index])
      );
    }
  }
  for (const [name, compare] of Object.entries(api)) {
    test(name + ': exhaustive 3x3 matching matrix ' + bits, () => {
      const a = [0, 1, 2].map((i) => new V('left', i));
      const b = [2, 0, 1].map((i) => new V('right', i));
      for (const [left, right] of [
        [new Set(a), new Set(b)],
        [new Map(a.map((x) => [x, 0])), new Map(b.map((x) => [x, 0]))]
      ]) {
        assert.equal(compare(left, right), expected);
        assert.equal(compare(right, left), expected);
      }
    });
  }
}
function random(seed) {
  let state = seed >>> 0;
  return (n) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % n;
  };
}
const primitives = [null, undefined, 0, 1, 2, '0', '1', false, true, NaN];
function model(seed) {
  const r = random(seed);
  return Array.from({ length: 5 }, () => ({
    kind: r(4),
    items: Array.from({ length: 1 + r(3) }, () => [
      r(2) ? { ref: r(5) } : { value: primitives[r(primitives.length)] },
      r(2) ? { ref: r(5) } : { value: primitives[r(primitives.length)] }
    ])
  }));
}
function materialize(spec, reverse = false, mutate = false) {
  const nodes = spec.map((n) => (n.kind === 0 ? {} : n.kind === 1 ? [] : n.kind === 2 ? new Set() : new Map()));
  const value = (v) => (Object.hasOwn(v, 'ref') ? nodes[v.ref] : v.value);
  spec.forEach((n, i) => {
    const node = nodes[i];
    // Build first, then reorder entries. Repeated keys must keep their final
    // assigned value in both versions.
    n.items.forEach(([k, v], j) => {
      if (n.kind === 0) {
        node['p' + j] = value(v);
      } else if (n.kind === 1) {
        node.push(value(v));
      } else if (n.kind === 2) {
        node.add(value(v));
      } else {
        node.set(value(k), value(v));
      }
    });
    if (reverse && node instanceof Set) {
      const entries = [...node].reverse();
      node.clear();
      entries.forEach((x) => node.add(x));
    }
    if (reverse && node instanceof Map) {
      const entries = [...node].reverse();
      node.clear();
      entries.forEach(([k, v]) => node.set(k, v));
    }
  });
  if (mutate) {
    nodes[seedIndex(spec)].extra = 'changed';
  }
  return nodes;
}
function seedIndex(spec) {
  return spec[0].kind % spec.length;
}
for (let seed = 1; seed <= 300; seed++) {
  for (const [name, compare] of Object.entries(api)) {
    test(name + ': cyclic graph reference oracle seed ' + seed, () => {
      const spec = model(seed);
      const a = materialize(spec),
        b = materialize(spec, true),
        c = materialize(spec, true, true),
        d = materialize(model(seed + 1999));
      for (const [left, right] of [
        [a, b],
        [a, c],
        [a, d]
      ]) {
        const expected = graphEqual(left, right, name);
        assert.equal(compare(left, right), expected, 'forward');
        assert.equal(compare(right, left), expected, 'reverse');
      }
    });
  }
}
function tree(r, depth = 0) {
  if (depth === 4 || r(3) === 0) {
    return primitives[r(primitives.length)];
  }
  const values = Array.from({ length: r(4) }, () => tree(r, depth + 1));
  return r(2) ? values : Object.fromEntries(values.map((v, i) => ['k' + i, v]));
}
for (const name of ['isEqual', 'isStrictEqual']) {
  test(name + ': 1000 acyclic differential pairs in shared Node semantics', () => {
    const r = random(214122);
    for (let i = 0; i < 1000; i++) {
      const a = tree(r),
        b = i % 2 ? structuredClone(a) : tree(r);
      assert.equal(api[name](a, b), isDeepStrictEqual(a, b), 'pair ' + i);
    }
  });
}
