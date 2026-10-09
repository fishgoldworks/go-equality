'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const api = require('./helpers/api');

const modes = [
  ['default', api.isEqual],
  ['loose', api.isLooseEqual],
  ['strict', api.isStrictEqual]
];
const delegate = () => undefined;
const hidden = Symbol('backedge');

function routes(mode, standard) {
  return [
    ['standard', standard],
    ['custom', (a, b) => api.isEqual.custom(a, b, delegate, { mode })],
    ['create', api.isEqual.create(delegate, { mode })]
  ];
}

function both(compare, left, right, expected, label) {
  assert.equal(compare(left, right), expected, label + ' forward');
  assert.equal(compare(right, left), expected, label + ' reverse');
}

function ring(labels, array = false) {
  const nodes = labels.map(() => (array ? [] : {}));
  nodes.forEach((node, i) => {
    if (array) {
      node.push(nodes[(i + 1) % nodes.length], labels[i]);
    } else {
      node.next = nodes[(i + 1) % nodes.length];
      node.value = labels[i];
    }
  });
  return nodes[0];
}

function bidirectional(size, lastValue) {
  const nodes = Array.from({ length: size }, () => ({}));
  nodes.forEach((node, i) => {
    node.next = nodes[(i + 1) % size];
    node.previous = nodes[(i + size - 1) % size];
    node.value = i === size - 1 ? lastValue : 0;
  });
  return nodes[0];
}

function mixedCycle(size, leaf) {
  const nodes = Array.from({ length: size }, (_, i) =>
    [() => ({}), () => [], () => new Map(), () => new Set()][i % 4]()
  );
  nodes.forEach((node, i) => {
    const next = nodes[(i + 1) % size];
    if (node instanceof Map) {
      node.set('next', next);
    } else if (node instanceof Set) {
      node.add(next);
    } else if (Array.isArray(node)) {
      node.push(next);
    } else {
      node.next = next;
    }
    // Own metadata is required even when a collection has a provisional match.
    node.value = i === size - 1 ? leaf : 0;
  });
  return nodes[0];
}

for (const [mode, standard] of modes) {
  const comparisons = routes(mode, standard);

  test(mode + ': cycles with different periods compare their values, not graph topology', () => {
    for (const [route, compare] of comparisons) {
      for (const array of [false, true]) {
        both(compare, ring([1], array), ring([1, 1, 1, 1, 1], array), true, route + ' uniform cycle');
        both(compare, ring([0, 1], array), ring([0, 1, 0, 1, 0, 1], array), true, route + ' repeating pattern');
        both(compare, ring([0, 1], array), ring([0, 1, 0, 2, 0, 1], array), false, route + ' changed pattern');
        both(compare, ring([0, 1], array), ring([1, 0], array), false, route + ' different starting value');
      }
    }
  });

  test(mode + ': a finite branch cannot be mistaken for a cyclic continuation', () => {
    const cycle = ring([1]);
    let finite = null;
    for (let i = 0; i < 64; i++) {
      finite = { next: finite, value: 1 };
    }
    for (const [route, compare] of comparisons) {
      both(compare, cycle, finite, false, route + ' finite termination');
      both(
        compare,
        { first: cycle, second: finite },
        { first: finite, second: cycle },
        false,
        route + ' both directions in one call'
      );
      both(
        compare,
        { first: cycle, second: cycle },
        { first: ring([1]), second: ring([1, 1]) },
        true,
        route + ' independent copies'
      );
    }
  });

  test(mode + ': deep bidirectional cycles propagate a distant mismatch without recursive traversal', () => {
    const left = bidirectional(2048, 0);
    const right = bidirectional(2048, 0);
    let middle = right;
    for (let i = 0; i < 1024; i++) {
      middle = middle.next;
    }
    for (const [route, compare] of comparisons) {
      both(compare, left, right, true, route + ' equal ring');
      middle.value = 1;
      both(compare, left, right, false, route + ' distant failure');
      middle.value = 0;
      both(compare, left, right, true, route + ' fresh comparison after restoring values');
    }
  });

  test(mode + ': alternating required and collection dependencies preserve cyclic failures', () => {
    const left = mixedCycle(256, 0);
    const equal = mixedCycle(256, 0);
    const unequal = mixedCycle(256, 1);
    for (const [route, compare] of comparisons) {
      both(compare, left, equal, true, route + ' mixed equal cycle');
      both(compare, left, unequal, false, route + ' late collection-property failure');
      both(compare, left, equal, true, route + ' independent call after mismatch');
    }
  });

  test(mode + ': mixed cyclic and acyclic candidate pairs remain independent across parents', () => {
    function fixture(reverse, changed) {
      const cycle = ring([1]);
      const mutual = ring([1, 1]);
      const finite = { next: null, value: changed ? 2 : 1 };
      const nodes = reverse ? [finite, mutual, cycle] : [cycle, mutual, finite];
      return {
        first: new Set(nodes),
        second: new Set(nodes.slice().reverse()),
        entries: new Map(nodes.map((value) => [value, new Set(nodes)])),
        required: { cycle, mutual, finite }
      };
    }
    const left = fixture(false, false);
    const equal = fixture(true, false);
    const unequal = fixture(true, true);
    for (const [route, compare] of comparisons) {
      both(compare, left, equal, true, route + ' candidate reuse across parents');
      both(compare, left, unequal, false, route + ' changed acyclic tail');
    }
  });

  test(mode + ': a rejected candidate cannot hide a shared child failure from later parents', () => {
    function make(reverse, leafValue, map) {
      const child = { value: leafValue };
      const entries = ['a', 'b'].map((tag) => ({ child, tag }));
      if (reverse) {
        entries.reverse();
      }
      return map ? new Map(entries.map((key) => [key, 0])) : new Set(entries);
    }
    // The first candidate can register a child dependency before its tag
    // rejects it. Later successful candidates still require that same child.
    for (const map of [false, true]) {
      const left = make(false, 1, map);
      const equal = make(true, 1, map);
      const unequal = make(true, 2, map);
      for (const [route, compare] of comparisons) {
        both(compare, left, equal, true, route + ' shared child matches');
        both(compare, left, unequal, false, route + ' shared child fails later');
      }
    }
  });

  test(mode + ': frozen hidden and symbol backedges retain required child comparisons', () => {
    function make(last) {
      const first = Object.create(null);
      const second = Object.create(null);
      const third = Object.create(null);
      Object.defineProperty(first, 'child', { value: second });
      Object.defineProperty(second, hidden, { value: third });
      Object.defineProperty(third, 'parent', { value: first });
      first.value = 1;
      second.value = 1;
      third.value = last;
      [first, second, third].forEach(Object.freeze);
      return first;
    }
    const left = make(1);
    const equal = make(1);
    const unequal = make(2);
    for (const [route, compare] of comparisons) {
      both(compare, left, equal, true, route + ' frozen cycle');
      both(compare, left, unequal, false, route + ' deep hidden mismatch');
    }
  });

  test(mode + ': cycles through supported built-in decorations retain late required failures', () => {
    const builders = [
      () => new Date(0),
      () => /entry/g,
      () => new Uint8Array([1, 2]),
      () => new ArrayBuffer(2),
      () => new DataView(new ArrayBuffer(2))
    ];
    for (const build of builders) {
      function make(leaf) {
        const value = build();
        value.metadata = { next: { parent: value, leaf } };
        return { first: value, repeated: value, set: new Set([value]), map: new Map([['value', value]]) };
      }
      const left = make(1);
      const equal = make(1);
      const unequal = make(2);
      for (const [route, compare] of comparisons) {
        both(compare, left, equal, true, route + ' decorated built-in');
        both(compare, left, unequal, false, route + ' late metadata mismatch');
      }
    }
  });

  test(mode + ': a thrown getter in pending cyclic work does not survive the call', () => {
    let fail = true;
    const error = new Error('cyclic branch getter');
    const left = ring([1, 1, 1]);
    const right = ring([1, 1, 1]);
    Object.defineProperty(left.next, 'guard', { get: () => 1 });
    Object.defineProperty(right.next, 'guard', {
      get() {
        if (fail) {
          throw error;
        }
        return 1;
      }
    });
    for (const [route, compare] of comparisons) {
      fail = true;
      assert.throws(
        () => compare(left, right),
        (caught) => caught === error,
        route
      );
      assert.throws(
        () => compare(right, left),
        (caught) => caught === error,
        route
      );
      fail = false;
      both(compare, left, right, true, route + ' retry after error');
      right.next.next.value = 2;
      both(compare, left, right, false, route + ' a new mismatch is still found');
      right.next.next.value = 1;
    }
  });

  for (const form of ['custom', 'create']) {
    test(mode + '/' + form + ': cyclic pair tracking preserves a directional custom rule', () => {
      const customizer = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a <= b : undefined);
      const compare =
        form === 'custom'
          ? (a, b) => api.isEqual.custom(a, b, customizer, { mode })
          : api.isEqual.create(customizer, { mode });
      const left = ring([1, 1]);
      const right = ring([2, 2, 2]);
      assert.equal(compare(left, right), true);
      assert.equal(compare(right, left), false);
      // Both ordered pairs occur in the same call. Caching one direction must
      // not supply the answer for the other direction.
      assert.equal(compare([left, right], [right, left]), false);
      assert.equal(compare([right, left], [left, right]), false);
      assert.equal(compare(left, right), true);
    });
  }
}
