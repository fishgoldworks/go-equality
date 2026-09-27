'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isEqual } = require('./helpers/api');
const { graphEqual } = require('./helpers/oracle');

function make(seed, variant = 0) {
  let state = seed >>> 0;
  const random = (limit) => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) % limit;
  const nodes = Array.from({ length: 5 }, () => [() => ({}), () => [], () => new Map(), () => new Set()][random(4)]());
  // Include both unequal and custom-equivalent leaves, with overlapping
  // relations. No production helper or candidate pruning is used by the oracle.
  const leaves = [0, 1, 2, 3, 'A', 'a', 'B', 'b', null, undefined, NaN, true, false];
  const value = () => (random(3) ? nodes[random(nodes.length)] : leaves[random(leaves.length)]);
  for (const node of nodes) {
    for (let i = 0, count = random(4); i < count; i++) {
      if (node instanceof Map) {
        node.set(value(), value());
      } else if (node instanceof Set) {
        node.add(value());
      } else if (Array.isArray(node)) {
        node.push(value());
      } else {
        node['p' + i] = value();
      }
    }
  }
  if (variant === 2) {
    nodes[random(5)].extra = 'changed';
  }
  if (variant) {
    for (const node of nodes) {
      if (node instanceof Map) {
        const entries = [...node].reverse();
        node.clear();
        entries.forEach(([k, v]) => node.set(k, v));
      }
      if (node instanceof Set) {
        const entries = [...node].reverse();
        node.clear();
        entries.forEach((v) => node.add(v));
      }
    }
  }
  return nodes;
}

const rules = {
  fallback: () => undefined,
  caseInsensitive: (a, b) =>
    typeof a === 'string' && typeof b === 'string' ? a.toLowerCase() === b.toLowerCase() : undefined,
  adjacentNumbers: (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1 : undefined),
  rejectIdenticalNumbers: (a, b) => (typeof a === 'number' && typeof b === 'number' && a === b ? false : undefined)
};
for (const mode of ['default', 'strict', 'loose']) {
  for (const [name, customizer] of Object.entries(rules)) {
    test(`custom graph oracle: ${mode}/${name}, 300 seeds with reordered, changed and independent graphs`, () => {
      const compare = isEqual.create(customizer, { mode });
      const standard = mode === 'default' ? 'isEqual' : mode === 'strict' ? 'isStrictEqual' : 'isLooseEqual';
      for (let seed = 1; seed <= 300; seed++) {
        const a = make(seed);
        for (const [variant, b] of [
          [1, make(seed, 1)],
          [2, make(seed, 2)],
          [3, make(seed + 7919)]
        ]) {
          const message = `${seed}/${variant}`;
          assert.equal(compare(a, b), graphEqual(a, b, standard, customizer), message);
          assert.equal(compare(b, a), graphEqual(b, a, standard, customizer), message + ' reversed');
        }
      }
    });
  }
}

test('custom cyclic matching: a chosen key can be invalidated after a value was accepted', () => {
  const custom = (a, b) =>
    typeof a === 'string' && typeof b === 'string' ? a.toLowerCase() === b.toLowerCase() : undefined;
  for (const mode of ['default', 'strict', 'loose']) {
    const compare = isEqual.create(custom, { mode });
    const a = { name: 'UP' },
      b = { name: 'up' },
      c = { name: 'wrong' };
    a.next = b;
    b.next = c;
    c.next = c;
    const left = new Map([
      [a, 'X'],
      [b, 'Y']
    ]);
    const right = new Map([
      [b, 'x'],
      [c, 'y']
    ]);
    assert.equal(compare(left, right), false);
    assert.equal(compare(right, left), false);
  }
});
