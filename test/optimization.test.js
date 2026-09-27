'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const api = require('./helpers/api');

for (const [name, compare] of Object.entries(api)) {
  const check = (label, make, expected) => test(name + ': optimisation guard - ' + label, () => {
    const [a, b] = make();
    assert.equal(compare(a, b), expected, 'forward');
    assert.equal(compare(b, a), expected, 'reverse');
  });
  check('native set identity ignores member hooks', () => {
    const x = { equals() { throw new Error('identity must bypass hooks'); } };
    return [new Set([x, NaN, 0]), new Set([0, x, NaN])];
  }, true);
  check('set native matches cannot hide custom properties', () => [Object.assign(new Set([1, 2]), { note: 1 }), Object.assign(new Set([2, 1]), { note: 2 })], false);
  check('map native matches cannot hide custom properties', () => [Object.assign(new Map([[1, 2]]), { note: 1 }), Object.assign(new Map([[1, 2]]), { note: 2 })], false);
  check('native-key map still compares nested values', () => [new Map([[NaN, { x: 1 }], [0, { y: 2 }]]), new Map([[0, { y: 2 }], [NaN, { x: 9 }]])], false);
  check('native-key map resolves self-referencing values', () => { const a = new Map(), b = new Map(); a.set('self', a); b.set('self', b); return [a, b]; }, true);
  check('native-key map propagates deep cyclic failure', () => {
    const a = new Map(), b = new Map(), x = { value: 1, parent: a }, y = { value: 2, parent: b };
    a.set('child', x); b.set('child', y); return [a, b];
  }, false);
  check('primitive sets with missing symbol key', () => [new Set([Symbol('a')]), new Set([Symbol('a')])], false);
  check('primitive maps distinguish missing from undefined value', () => [new Map([[1, undefined]]), new Map([[2, undefined]])], false);
  check('native-key map mixed primitives and functions', () => {
    const f = () => 1, s = Symbol('s');
    return [new Map([[f, 1], [null, 2], [s, 3], [undefined, 4], [NaN, 5]]), new Map([[NaN, 5], [s, 3], [f, 1], [undefined, 4], [null, 2]])];
  }, true);
  check('different function keys remain identity-only', () => [new Map([[() => 0, 1]]), new Map([[() => 0, 1]])], false);
  check('wrapper-keyed maps normalise only outside strict', () => [new Map([[Object(1), 'a']]), new Map([[1, 'a']])], name !== 'isStrictEqual');
  check('wrapper sets normalise only outside strict', () => [new Set([Object(1)]), new Set([1])], name !== 'isStrictEqual');
  check('native map methods may be overridden', () => {
    const method = () => { throw new Error('must use captured intrinsic'); };
    return [Object.assign(new Map([[1, 2]]), { get: method, has: method, entries: method }), Object.assign(new Map([[1, 2]]), { get: method, has: method, entries: method })];
  }, true);
  check('native set methods may be overridden', () => {
    const method = () => { throw new Error('must use captured intrinsic'); };
    return [Object.assign(new Set([1]), { has: method, values: method }), Object.assign(new Set([1]), { has: method, values: method })];
  }, true);
  check('same-count reordered keys still check membership', () => [{ a: 1, b: 2, c: 3 }, { a: 1, c: 3, d: 2 }], false);
  check('integer and symbol key-order changes', () => {
    const x = Symbol(), y = Symbol();
    return [{ 1: 1, x: 2, y: 3, [x]: 4, [y]: 5 }, { [y]: 5, y: 3, 1: 1, [x]: 4, x: 2 }];
  }, true);
  check('array inherited index cannot replace a hole', () => {
    const a = [undefined], b = Array(1); const p = Object.create(Array.prototype); p[0] = undefined; Object.setPrototypeOf(b, p); return [a, b];
  }, false);
  check('typed array noncanonical numeric own keys', () => [Object.assign(new Uint8Array([1]), { '01': 1 }), Object.assign(new Uint8Array([1]), { '01': 2 })], false);
  check('typed array symbol own properties', () => { const s = Symbol(); return [Object.assign(new Uint8Array([1]), { [s]: 1 }), Object.assign(new Uint8Array([1]), { [s]: 2 })]; }, false);
  check('zero-length typed arrays include extra keys', () => [Object.assign(new Uint8Array(), { hidden: 1 }), Object.assign(new Uint8Array(), { hidden: 2 })], false);
  check('structural candidate failure does not reserve a key', () => [new Set([{ x: 1 }, { x: 2 }, { x: 3 }]), new Set([{ x: 3 }, { x: 1 }, { x: 2 }])], true);
  check('equal structural keys may have permuted values', () => [new Map([[{ x: 1 }, { v: 1 }], [{ x: 1 }, { v: 2 }]]), new Map([[{ x: 1 }, { v: 2 }], [{ x: 1 }, { v: 1 }]])], true);
  check('shared invalidated dependency has many parents', () => {
    const a = { x: 1 }, b = { x: 2 }; return [Array.from({ length: 100 }, () => ({ a })), Array.from({ length: 100 }, () => ({ a: b }))];
  }, false);
  check('flat objects with genuine and forged toStringTag brands', () => [{ [Symbol.toStringTag]: 'Map' }, { [Symbol.toStringTag]: 'Map' }], false);
}
for (const compare of [api.isEqual, api.isLooseEqual]) test(compare.name + ': default wrapper duplicates consume distinct candidates', () => {
  assert.equal(compare(new Set([Object(1), Object(1)]), new Set([1, 2])), false);
  assert.equal(compare(new Map([[Object(1), 'a'], [Object(1), 'b']]), new Map([[1, 'a'], [Object(1), 'b']])), true);
});
test('loose native map keys may need value-driven reassignment', () => {
  const a = new Map([[0, 'a'], ['0', 'b']]), b = new Map([[0, 'b'], ['0', 'a']]);
  assert.equal(api.isLooseEqual(a, b), true); assert.equal(api.isLooseEqual(b, a), true);
  assert.equal(api.isEqual(a, b), false); assert.equal(api.isStrictEqual(a, b), false);
});
test('loose primitive sets use non-transitive matching, not normalised hashing', () => {
  const a = new Set(['', 0]), b = new Set(['', '0']);
  assert.equal(api.isLooseEqual(a, b), true); assert.equal(api.isLooseEqual(b, a), true);
});
test('loose set and map primitive domain boundaries', () => {
  for (const [a, b] of [[null, undefined], [0, false], [0, ''], [1n, 1], [1n, '1']]) {
    assert.equal(api.isLooseEqual(new Set([a]), new Set([b])), true);
    assert.equal(api.isLooseEqual(new Map([[a, 'v']]), new Map([[b, 'v']])), true);
  }
});

for (const [name, compare] of Object.entries(api)) test(name + ': candidate invalidated during augmenting path is not accepted', () => {
  class Value {
    constructor(id) { this.id = id; }
    equals(other) { return this.id === 'bridge' || other.id === 'bridge' || this.id === other.id; }
  }
  const c = new Value('c'), d = new Value('d'), bridge = new Value('bridge');
  // While searching the second row, a value comparison disproves a key's
  // provisional child pair BEFORE that key gets assigned on an augmenting path.
  const a = new Map([[{ child: d }, bridge], [{ child: c }, c]]);
  const b = new Map([[{ child: d }, c], [{ child: d }, d]]);
  assert.equal(compare(a, b), false);
  assert.equal(compare(b, a), false);
});

for (const [name, compare] of Object.entries(api)) {
  for (const length of [0, 1, 3, 4, 7, 31, 63, 64, 65, 127, 128, 129]) {
    test(name + ': byte comparison boundaries length ' + length, () => {
      const a = new Uint8Array(length).fill(37), b = new Uint8Array(length).fill(37);
      assert.equal(compare(a.buffer, b.buffer), true);
      for (let i = 0; i < length; i++) {
        b[i] ^= 1;
        assert.equal(compare(a.buffer, b.buffer), false, 'changed byte ' + i);
        assert.equal(compare(b.buffer, a.buffer), false, 'reverse changed byte ' + i);
        b[i] ^= 1;
      }
    });
  }
  for (const [leftOffset, rightOffset] of [[0, 0], [4, 8], [1, 3], [1, 4]]) {
    test(name + ': byte comparison view offsets ' + leftOffset + '/' + rightOffset, () => {
      const left = new Uint8Array(144).fill(1), right = new Uint8Array(144).fill(2);
      left.fill(73, leftOffset, leftOffset + 129); right.fill(73, rightOffset, rightOffset + 129);
      const a = new DataView(left.buffer, leftOffset, 129), b = new DataView(right.buffer, rightOffset, 129);
      assert.equal(compare(a, b), true);
      for (const i of [0, 1, 2, 3, 4, 63, 64, 127, 128]) {
        right[rightOffset + i] ^= 1; assert.equal(compare(a, b), false); right[rightOffset + i] ^= 1;
      }
    });
  }
  test(name + ': typed arrays retain differently ordered decorations', () => {
    const s = Symbol(), t = Symbol();
    const a = Object.assign(new Float64Array([NaN, -0]), { '01': 1, x: 2, [s]: 3, [t]: 4 });
    const b = Object.assign(new Float64Array([NaN, 0]), { [t]: 4, x: 2, [s]: 3, '01': 1 });
    Object.defineProperty(a, 'hidden', { value: 5 }); Object.defineProperty(b, 'hidden', { value: 5 });
    assert.equal(compare(a, b), true); b['01'] = 2; assert.equal(compare(a, b), false);
  });
  test(name + ': length-tracking typed arrays retain resized payload and decorations', () => {
    const x = new ArrayBuffer(8, { maxByteLength: 16 }), y = new ArrayBuffer(8, { maxByteLength: 16 });
    const a = new Uint8Array(x), b = new Uint8Array(y); a.extra = b.extra = 1;
    assert.equal(compare(a, b), true); x.resize(16); y.resize(16); assert.equal(compare(a, b), true);
    b[15] = 1; assert.equal(compare(a, b), false); b[15] = 0; x.resize(4); y.resize(4); assert.equal(compare(a, b), true);
    b.extra = 2; assert.equal(compare(a, b), false);
  });
}

// A second oracle targets interactions between provisional key dependencies
// and custom value relations, rather than just matching static boolean edges.
for (let bits = 0; bits < 8; bits++) {
  for (const [name, compare] of Object.entries(api)) {
    test(name + ': dependent-key matching oracle, leaf relation ' + bits, () => {
      const relation = (a, b) => a === b || !!(bits & (1 << (Math.min(a, b) === 0 ? Math.max(a, b) - 1 : 2)));
      class Atom {
        constructor(id) { this.id = id; }
        equals(other) { return relation(this.id, other.id); }
      }
      const atoms = [0, 1, 2].map(i => new Atom(i));
      let state = 1991 + bits;
      const pick = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % 3; };
      for (let sample = 0; sample < 256; sample++) {
        const left = [[pick(), pick()], [pick(), pick()]];
        const right = [[pick(), pick()], [pick(), pick()]];
        const edge = (i, j) => relation(left[i][0], right[j][0]) && relation(left[i][1], right[j][1]);
        const expected = (edge(0, 0) && edge(1, 1)) || (edge(0, 1) && edge(1, 0));
        const map = entries => new Map(entries.map(([key, value]) => [{ child: atoms[key] }, atoms[value]]));
        const a = map(left), b = map(right);
        assert.equal(compare(a, b), expected, 'sample ' + sample);
        assert.equal(compare(b, a), expected, 'reverse sample ' + sample);
      }
    });
  }
}
for (const [name, compare] of Object.entries(api)) {
  test(name + ': large primitive collections use the full equality contract', () => {
    const values = Array.from({ length: 16000 }, (_, i) => i);
    const a = new Set(values), b = new Set(values.toReversed());
    assert.equal(compare(a, b), true); b.delete(0); b.add(-1); assert.equal(compare(a, b), false);
    const x = new Map(values.slice(0, 4000).map(i => [i, { i }]));
    const y = new Map(values.slice(0, 4000).toReversed().map(i => [i, { i }]));
    assert.equal(compare(x, y), true); y.get(2000).i = -1; assert.equal(compare(x, y), false);
  });
}
