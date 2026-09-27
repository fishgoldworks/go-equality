'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const api = require('./helpers/api');

for (const [name, compare] of Object.entries(api)) {
  // These sizes straddle byte/bit boundaries and the rejection-compaction threshold.
  for (const size of [7, 8, 9, 63, 64, 65, 66, 127, 128, 129]) {
    for (const kind of ['Set', 'Map']) {
      test(name + ': structural ' + kind + ', size ' + size, () => {
        const make = (reverse) => {
          const records = Array.from({ length: size }, (_, i) => ({ id: reverse ? size - 1 - i : i }));
          return kind === 'Set' ? new Set(records) : new Map(records.map((key) => [key, 'v' + key.id]));
        };
        const a = make(false),
          b = make(true);
        assert.equal(compare(a, b), true);
        assert.equal(compare(b, a), true);
        const key = kind === 'Set' ? b.values().next().value : b.keys().next().value;
        key.id = -1;
        assert.equal(compare(a, b), false);
        assert.equal(compare(b, a), false);
      });
    }
  }
  test(name + ': settled pair sharing across multiple collection parents', () => {
    const a = { id: 1 },
      b = { id: 1 },
      c = { id: 2 },
      d = { id: 2 };
    const left = [
      new Set([a, c]),
      new Set([c, a]),
      { x: a, y: c },
      new Map([
        [a, c],
        [c, a]
      ])
    ];
    const right = [
      new Set([d, b]),
      new Set([b, d]),
      { x: b, y: d },
      new Map([
        [d, b],
        [b, d]
      ])
    ];
    assert.equal(compare(left, right), true);
    assert.equal(compare(right, left), true);
    d.id = 3;
    assert.equal(compare(left, right), false);
    assert.equal(compare(right, left), false);
  });
  test(name + ': collection candidates retain nonlocal cyclic failures', () => {
    const make = (reverse, fail) => {
      const values = Array.from({ length: 70 }, (_, i) => ({ id: i }));
      const set = new Set(reverse ? values.toReversed() : values);
      for (const value of values) {
        value.parent = set;
      }
      if (fail) {
        values[35].tail = { tail: { id: -1 } };
      } else {
        values[35].tail = { tail: { id: 1 } };
      }
      return set;
    };
    const a = make(false, false),
      b = make(true, false),
      c = make(true, true);
    assert.equal(compare(a, b), true);
    assert.equal(compare(b, a), true);
    assert.equal(compare(a, c), false);
    assert.equal(compare(c, a), false);
  });
  test(name + ': custom hook leaves can override structural differences', () => {
    class Atom {
      constructor(id, decoration) {
        this.id = id;
        this.decoration = decoration;
      }
      equals(other) {
        return other instanceof Atom && this.id === other.id;
      }
    }
    const a = new Set(Array.from({ length: 70 }, (_, i) => new Atom(i, 'left')));
    const b = new Set(Array.from({ length: 70 }, (_, i) => new Atom(69 - i, 'right')));
    assert.equal(compare(a, b), true);
    assert.equal(compare(b, a), true);
  });
  test(name + ': many candidate failures with sparse identity-key matches', () => {
    const keys = Array.from({ length: 70 }, (_, i) => ({ id: i }));
    const a = new Map(keys.map((key, i) => [key, { id: i }]));
    const b = new Map(keys.toReversed().map((key) => [key, { id: key.id }]));
    assert.equal(compare(a, b), true);
    assert.equal(compare(b, a), true);
    b.get(keys[35]).id = -1;
    assert.equal(compare(a, b), false);
    assert.equal(compare(b, a), false);
  });
}

for (const [name, compare] of Object.entries(api)) {
  test(name + ': dense rejected columns still allow value-driven reassignment', () => {
    const filler = Array.from({ length: 65 }, (_, i) => ({ v: 'filler-' + i }));
    const left = [{ v: 0 }, { v: '' }, ...filler];
    const right = [...filler.map((x) => ({ v: x.v })), { v: '' }, { v: '0' }];
    const expected = name === 'isLooseEqual';
    assert.equal(compare(new Set(left), new Set(right)), expected);
    assert.equal(compare(new Set(right), new Set(left)), expected);
    const a = new Map(left.map((key) => [key, 1]));
    const b = new Map(right.map((key) => [key, 1]));
    assert.equal(compare(a, b), expected);
    assert.equal(compare(b, a), expected);
  });
  test(name + ': self-cyclic leaves remain equal after transient indexing', () => {
    const make = (reverse) => {
      const nodes = Array.from({ length: 70 }, (_, i) => ({ id: i }));
      for (const node of nodes) {
        node.self = node;
      }
      return new Set(reverse ? nodes.toReversed() : nodes);
    };
    const a = make(false),
      b = make(true);
    assert.equal(compare(a, b), true);
    assert.equal(compare(b, a), true);
    b.values().next().value.id = -1;
    assert.equal(compare(a, b), false);
    assert.equal(compare(b, a), false);
  });
}
