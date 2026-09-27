'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isEqual, isLooseEqual, isStrictEqual } = require('./helpers/api');
const { perfectMatching } = require('./helpers/oracle');
const fallback = () => undefined;
const modes = [
  ['default', isEqual],
  ['strict', isStrictEqual],
  ['loose', isLooseEqual]
];
const throwsType = (fn) => assert.throws(fn, { name: 'TypeError' });

function userReference(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    value.type === 'user' &&
    typeof value.id === 'string' &&
    value.id.length > 0
  );
}
function compareUsers(left, right) {
  const a = userReference(left),
    b = userReference(right);
  if (!a && !b) {
    return undefined;
  }
  return a && b && left.id === right.id;
}
function ignoreCase(a, b) {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.toLowerCase() === b.toLowerCase();
  }
  return undefined;
}

test('attached modes are the standalone exports, unbound and immutable', () => {
  assert.equal(isEqual.strict, isStrictEqual);
  assert.equal(isEqual.loose, isLooseEqual);
  for (const name of ['strict', 'loose', 'custom', 'create']) {
    const descriptor = Object.getOwnPropertyDescriptor(isEqual, name);
    assert.equal(typeof descriptor.value, 'function');
    assert.equal(descriptor.writable, false);
    assert.equal(descriptor.configurable, false);
    assert.equal(descriptor.enumerable, false);
    throwsType(() => {
      isEqual[name] = () => {};
    });
  }
  const { strict, loose, custom, create } = isEqual;
  assert.equal(strict(1, '1'), false);
  assert.equal(loose(1, '1'), true);
  assert.equal(custom('HELLO', 'hello', ignoreCase), true);
  assert.equal(create(ignoreCase)('HELLO', 'hello'), true);
});

test('custom compares now; create returns a plain independent binary function', () => {
  assert.equal(typeof isEqual.custom({}, {}, fallback), 'boolean');
  const compare = isEqual.create(fallback);
  assert.equal(typeof compare, 'function');
  assert.equal(compare.length, 2);
  assert.equal(compare.custom, undefined);
  assert.equal(compare.strict, undefined);
  assert.notEqual(compare, isEqual.create(fallback));
  assert.equal(compare.call(null, { a: 1 }, { a: 1 }), true);
});

test('realistic task dirty-state comparison ignores user display metadata only', () => {
  const saved = {
    title: 'Fix checkout validation',
    status: 'open',
    assignee: { type: 'user', id: 'user-42', displayName: 'Alex Kim' }
  };
  const refreshed = { ...saved, assignee: { type: 'user', id: 'user-42', displayName: 'Alex K.' } };
  const compare = isEqual.create(compareUsers);
  assert.equal(isEqual(saved, refreshed), false);
  assert.equal(compare(saved, refreshed), true);
  assert.equal(isEqual.custom(saved, refreshed, compareUsers), true);
  assert.equal(compare(saved, { ...refreshed, status: 'done' }), false);
  assert.equal(compare(saved, { ...refreshed, assignee: { type: 'user', id: 'user-99' } }), false);
  assert.equal(compare(saved, { ...refreshed, assignee: null }), false);
  assert.equal(compare({ type: 'order', id: 'x', total: 1 }, { type: 'order', id: 'x', total: 2 }), false);
  assert.equal(compare({ type: 'user', id: '', name: 'a' }, { type: 'user', id: '', name: 'b' }), false);
});

for (const [mode, standard] of modes) {
  test(`custom ${mode}: undefined delegates root and nested values exactly`, () => {
    const symbol = Symbol('x');
    const values = [
      undefined,
      null,
      false,
      true,
      0,
      -0,
      1,
      NaN,
      1n,
      '1',
      '',
      symbol,
      Object(1),
      Object('1'),
      Object(symbol),
      {},
      [],
      new Set([1]),
      new Map([[1, 'x']]),
      new Date(5),
      new Uint8Array([1]),
      () => {}
    ];
    const custom = isEqual.create(fallback, { mode });
    for (const a of values) {
      for (const b of values) {
        assert.equal(custom(a, b), standard(a, b));
        assert.equal(custom({ item: a }, { item: b }), standard({ item: a }, { item: b }));
      }
    }
  });
  test(`custom ${mode}: callback runs before identity and function shortcuts`, () => {
    const compare = isEqual.create(() => false, { mode });
    const object = {},
      fn = () => {};
    for (const item of [object, fn, 1, NaN, undefined, null]) {
      assert.equal(compare(item, item), false);
    }
    assert.equal(
      isEqual.custom(
        () => {},
        () => {},
        () => true,
        { mode }
      ),
      true
    );
    const vetoNumbers = (a, b) => (typeof a === 'number' && typeof b === 'number' ? false : undefined);
    assert.equal(isEqual.custom({ n: 1 }, { n: 1 }, vetoNumbers, { mode }), false);
  });
  test(`custom ${mode}: original wrappers and hooks have explicit precedence`, () => {
    const left = Object(1),
      right = Object(2);
    assert.equal(
      isEqual.custom(left, right, (a, b) => (a === left && b === right ? true : undefined), { mode }),
      true
    );
    const throws = {
      equals() {
        throw new Error('hook');
      }
    };
    assert.equal(
      isEqual.custom(throws, {}, () => true, { mode }),
      true
    );
    assert.equal(
      isEqual.custom(throws, {}, () => false, { mode }),
      false
    );
    assert.throws(() => isEqual.custom(throws, {}, fallback, { mode }), /hook/);
    assert.equal(isEqual.custom(throws, throws, fallback, { mode }), true);
    class Entity {
      equals() {
        return true;
      }
    }
    assert.equal(isEqual.custom(new Entity(), new Entity(), fallback, { mode }), true);
    assert.equal(
      isEqual.custom(new Entity(), new Entity(), () => false, { mode }),
      false
    );
  });
  test(`custom ${mode}: callbacks see nonenumerables, symbols and array extras`, () => {
    const key = Symbol();
    const a = Object.defineProperty({ [key]: 'UP' }, 'hidden', { value: 'DOWN' });
    const b = Object.defineProperty({ [key]: 'up' }, 'hidden', { value: 'down' });
    assert.equal(isEqual.custom(a, b, ignoreCase, { mode }), true);
    const x = ['UP'],
      y = ['up'];
    x.label = 'TAG';
    y.label = 'tag';
    assert.equal(isEqual.custom(x, y, ignoreCase, { mode }), true);
    assert.equal(isEqual.custom({ field: 1 }, { otherField: 1 }, ignoreCase, { mode }), false);
    assert.equal(isEqual.custom(new Array(1), [undefined], fallback, { mode }), false);
  });
  test(`custom ${mode}: typed-array values are not skipped by payload or identity paths`, () => {
    const near = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.01 : undefined);
    assert.equal(isEqual.custom(new Float64Array([1.001]), new Float64Array([1.002]), near, { mode }), true);
    assert.equal(isEqual.custom(new Float64Array([1.001]), new Float64Array([1.2]), near, { mode }), false);
    const veto = (a, b) => (typeof a === 'number' && typeof b === 'number' ? false : undefined);
    assert.equal(isEqual.custom(new Uint8Array([1]), new Uint8Array([1]), veto, { mode }), false);
    assert.equal(isEqual.custom(new Uint8Array([1]), new Uint8Array([1, 2]), near, { mode }), false);
  });
  test(`custom ${mode}: Set and Map identity matches cannot bypass callback vetoes`, () => {
    const veto = (a, b) => (typeof a === 'number' && typeof b === 'number' ? false : undefined);
    assert.equal(isEqual.custom(new Set([1]), new Set([1]), veto, { mode }), false);
    assert.equal(isEqual.custom(new Map([[1, 'v']]), new Map([[1, 'v']]), veto, { mode }), false);
    assert.equal(isEqual.custom(new Map([['k', 1]]), new Map([['k', 1]]), veto, { mode }), false);
    const shared = { type: 'reject' };
    assert.equal(
      isEqual.custom(
        new Set([shared]),
        new Set([shared]),
        (a, b) => (a === shared && b === shared ? false : undefined),
        { mode }
      ),
      false
    );
  });
  test(`custom ${mode}: native matches may be reassigned to complete Map entries`, () => {
    const numbersEqual = (a, b) => (typeof a === 'number' && typeof b === 'number' ? true : undefined);
    assert.equal(
      isEqual.custom(
        new Map([
          [1, 'a'],
          [2, 'b']
        ]),
        new Map([
          [1, 'b'],
          [2, 'a']
        ]),
        numbersEqual,
        { mode }
      ),
      true
    );
    assert.equal(
      isEqual.custom(
        new Map([
          [1, 'a'],
          [2, 'a']
        ]),
        new Map([
          [1, 'a'],
          [2, 'b']
        ]),
        numbersEqual,
        { mode }
      ),
      false
    );
    assert.equal(isEqual.custom(new Set(['A', 'a']), new Set(['a', 'b']), ignoreCase, { mode }), false);
    assert.equal(isEqual.custom(new Set(['A', 'B']), new Set(['b', 'a']), ignoreCase, { mode }), true);
  });
  test(`custom ${mode}: cycles terminate and failures invalidate optimistic matches`, () => {
    const a = { value: 'UP' },
      b = { value: 'up' };
    a.self = a;
    b.self = b;
    const compare = isEqual.create(ignoreCase, { mode });
    assert.equal(compare(a, b), true);
    b.value = 'different';
    assert.equal(compare(a, b), false);
    const x = new Set(),
      y = new Set();
    x.add(x);
    y.add(y);
    assert.equal(compare(x, y), true);
    const m = new Map(),
      n = new Map();
    m.set(m, 'UP');
    n.set(n, 'up');
    assert.equal(compare(m, n), true);
    n.set(n, 'different');
    assert.equal(compare(m, n), false);
    const shared = { name: 'SAME' },
      diff = { name: 'different' };
    assert.equal(compare([shared, diff, shared], [shared, diff, diff]), false);
  });
}

for (const value of [undefined, null, false, 1, 'callback', {}, []]) {
  test(`custom validation: reject nonfunction ${String(value)} without reading operands`, () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('input inspected');
        }
      }
    );
    throwsType(() => isEqual.custom(hostile, hostile, value));
    throwsType(() => isEqual.create(value));
  });
}
for (const [name, value] of Object.entries({
  null: null,
  zero: 0,
  one: 1,
  empty: '',
  text: 'true',
  object: {},
  array: [],
  boxed: Object(true),
  promise: Promise.resolve(true),
  symbol: Symbol('x')
})) {
  test(`custom validation: reject ${name} callback results`, () => {
    throwsType(() => isEqual.custom(1, 1, () => value));
    throwsType(() => isEqual.create(() => value)(1, 1));
  });
}
for (const [name, options] of Object.entries({
  null: null,
  array: [],
  fn: () => {},
  string: 'strict',
  number: 1,
  bool: true,
  unknown: { typo: 'strict' },
  wrongMode: { mode: 'Strict' },
  modeNull: { mode: null },
  modeBoxed: { mode: Object('strict') },
  modeNumber: { mode: 0 },
  symbol: { [Symbol()]: 'strict' }
})) {
  test(`custom validation: reject ${name} options before callback execution`, () => {
    const callback = () => {
      throw new Error('callback called');
    };
    throwsType(() => isEqual.custom(1, 1, callback, options));
    throwsType(() => isEqual.create(callback, options));
  });
}
test('custom options: defaults, null prototype, ignored inherited options and snapshots', () => {
  for (const options of [undefined, {}, { mode: undefined }, Object.create(null)]) {
    assert.equal(isEqual.custom(1, Object(1), fallback, options), true);
    assert.equal(isEqual.custom(1, '1', fallback, options), false);
  }
  assert.equal(isEqual.custom(1, '1', fallback, Object.create({ mode: 'loose' })), false);
  const options = { mode: 'strict' };
  const compare = isEqual.create(fallback, options);
  options.mode = 'loose';
  assert.equal(compare(1, '1'), false);
  assert.equal(isEqual.custom(1, '1', fallback, options), true);
});
test('custom options: mode getter is snapshotted once, errors propagate', () => {
  let reads = 0;
  const compare = isEqual.create(fallback, {
    get mode() {
      reads++;
      return 'loose';
    }
  });
  assert.equal(reads, 1);
  compare(1, '1');
  compare(2, '2');
  assert.equal(reads, 1);
  const failure = new Error('options');
  assert.throws(
    () =>
      isEqual.create(fallback, {
        get mode() {
          throw failure;
        }
      }),
    (e) => e === failure
  );
});
test('custom callback: original values, no receiver, and errors propagate unchanged', () => {
  const a = Object(1),
    b = 1;
  let first = true;
  const compare = isEqual.create(function (left, right) {
    assert.equal(this, undefined);
    if (first) {
      assert.equal(left, a);
      assert.equal(right, b);
      first = false;
    }
    return undefined;
  });
  assert.equal(compare(a, b), true);
  const failure = new Error('callback');
  assert.throws(
    () =>
      isEqual.custom({}, {}, () => {
        throw failure;
      }),
    (e) => e === failure
  );
});
test('custom factory: closures remain live, state is fresh after mutation and exception', () => {
  let tolerant = true,
    shouldThrow = false;
  const compare = isEqual.create((a, b) => {
    if (shouldThrow) {
      throw new Error('failure');
    }
    return tolerant ? ignoreCase(a, b) : undefined;
  });
  const a = { value: 'UP' },
    b = { value: 'up' };
  a.self = a;
  b.self = b;
  assert.equal(compare(a, b), true);
  tolerant = false;
  assert.equal(compare(a, b), false);
  tolerant = true;
  shouldThrow = true;
  assert.throws(() => compare(a, b), /failure/);
  shouldThrow = false;
  assert.equal(compare(a, b), true);
  b.extra = 1;
  assert.equal(compare(a, b), false);
});
test('custom ordered callback is not silently symmetrized', () => {
  const compare = isEqual.create((a, b) => (typeof a === 'number' && typeof b === 'number' ? a <= b : undefined));
  assert.equal(compare(1, 2), true);
  assert.equal(compare(2, 1), false);
  assert.equal(compare(new Set([1]), new Set([2])), true);
  assert.equal(compare(new Set([2]), new Set([1])), false);
});
test('custom true short-circuits descendants and fallback identity need not visit children', () => {
  const bad = Object.defineProperty({}, 'value', {
    get() {
      throw new Error('child');
    }
  });
  assert.equal(
    isEqual.custom(bad, {}, () => true),
    true
  );
  assert.equal(isEqual.custom(bad, bad, fallback), true);
  assert.throws(() => isEqual.custom(bad, { value: 1 }, fallback), /child/);
});
test('custom traversal remains iterative through 12000 levels', () => {
  let a = { value: 'UP' },
    b = { value: 'up' };
  for (let i = 0; i < 12000; i++) {
    a = { child: a };
    b = { child: b };
  }
  assert.equal(isEqual.custom(a, b, ignoreCase), true);
});

for (let bits = 0; bits < 512; bits++) {
  const matrix = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => !!(bits & (1 << (i * 3 + j))))
  );
  const expected = perfectMatching(matrix);
  const left = [0, 1, 2].map((index) => ({ marker: 'node', side: 'left', index }));
  const right = [2, 0, 1].map((index) => ({ marker: 'node', side: 'right', index }));
  function custom(a, b) {
    if (a?.marker !== 'node' || b?.marker !== 'node') {
      return undefined;
    }
    return a.side !== b.side && (a.side === 'left' ? matrix[a.index][b.index] : matrix[b.index][a.index]);
  }
  for (const [mode] of modes) {
    test(`custom ${mode}: exhaustive 3x3 matching ${bits}`, () => {
      const compare = isEqual.create(custom, { mode });
      for (const [a, b] of [
        [new Set(left), new Set(right)],
        [new Map(left.map((x) => [x, 'v'])), new Map(right.map((x) => [x, 'v']))],
        [new Map(left.map((x) => [x, x])), new Map(right.map((x) => [x, x]))]
      ]) {
        assert.equal(compare(a, b), expected);
        assert.equal(compare(b, a), expected);
      }
    });
  }
}

test('custom primitive decisions do not relax structural container constraints', () => {
  const primitiveTrue = (a, b) =>
    (a === null || typeof a !== 'object') && (b === null || typeof b !== 'object') ? true : undefined;
  assert.equal(isEqual.custom([], [1], primitiveTrue), false);
  assert.equal(isEqual.custom(new Set([1]), new Set([1, 2]), primitiveTrue), false);
  assert.equal(isEqual.custom(new Map(), new Map([[1, 2]]), primitiveTrue), false);
  assert.equal(isEqual.custom(new Uint8Array([1]), new Uint16Array([1]), primitiveTrue), false);
  assert.equal(isEqual.custom(new Date(1), new Date(2), primitiveTrue), false);
  assert.equal(isEqual.custom(new Uint8Array([1]).buffer, new Uint8Array([2]).buffer, primitiveTrue), false);
});
test('custom: override otherwise opaque or invalid inputs without inspecting them', () => {
  const revocable = Proxy.revocable({}, {});
  revocable.revoke();
  assert.equal(
    isEqual.custom(revocable.proxy, {}, () => true),
    true
  );
  assert.equal(
    isEqual.custom(revocable.proxy, {}, () => false),
    false
  );
  const a = Promise.resolve(1),
    b = Promise.resolve(2);
  assert.equal(isEqual.custom(a, b, fallback), false);
  assert.equal(
    isEqual.custom(a, b, () => true),
    true
  );
});
test('custom: bigint elements, NaN, RegExp state, and decorated binary values', () => {
  const even = (a, b) => (typeof a === 'bigint' && typeof b === 'bigint' ? a % 2n === b % 2n : undefined);
  assert.equal(isEqual.custom(new BigInt64Array([2n]), new BigInt64Array([4n]), even), true);
  assert.equal(isEqual.custom(new Float64Array([NaN]), new Float64Array([NaN]), fallback), true);
  const x = /x/g,
    y = /x/g;
  x.lastIndex = 1;
  y.lastIndex = 2;
  const numbers = (a, b) => (typeof a === 'number' && typeof b === 'number' ? true : undefined);
  assert.equal(isEqual.custom(x, y, numbers), true);
  const a = new Uint8Array([1]),
    b = new Uint8Array([1]);
  a.label = 'UP';
  b.label = 'up';
  assert.equal(isEqual.custom(a, b, ignoreCase), true);
});
test('custom: callback may compare a different pair using an independent invocation', () => {
  const compare = isEqual.create((a, b) => {
    if (a?.type === 'user' && b?.type === 'user') {
      return isEqual.strict({ id: a.id }, { id: b.id });
    }
    return undefined;
  });
  assert.equal(
    compare({ assignee: { type: 'user', id: '1' } }, { assignee: { type: 'user', id: '1', label: 'Alex' } }),
    true
  );
});
