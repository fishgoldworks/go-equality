'use strict';
// Self-contained browser assertions. A fresh document is used for each bundle.
// Do not emulate HTMLDDA: an actual browser document.all must be present.
globalThis.runGoEqualityBrowserTests = function runGoEqualityBrowserTests(api) {
  const cases = [];
  function check(name, expected, fn) {
    try {
      const actual = fn();
      cases.push({ name, expected, actual, pass: actual === expected });
    } catch (error) {
      cases.push({ name, expected, error: error.name + ': ' + error.message, pass: false });
    }
  }
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const all = document.all;
  const foreign = frame.contentDocument.all;
  check('environment: real typeof-undefined HTMLDDA', 'undefined', () => typeof all);
  check('environment: HTMLDDA is not primitive undefined', false, () => all === undefined);
  check('environment: native HTMLDDA null coercion exists', true, () => all == null);
  check('environment: HTMLDDA retains its falsy behaviour', false, () => Boolean(all));
  check('API: strict alias is identical', true, () => api.isEqual.strict === api.isStrictEqual);
  check('API: loose alias is identical', true, () => api.isEqual.loose === api.isLooseEqual);
  const fallback = () => undefined;
  const routes = [
    ['isEqual', api.isEqual],
    ['isLooseEqual', api.isLooseEqual],
    ['isStrictEqual', api.isStrictEqual],
    ...['default', 'strict', 'loose'].flatMap((mode) => [
      ['custom/' + mode, (a, b) => api.isEqual.custom(a, b, fallback, { mode })],
      ['create/' + mode, api.isEqual.create(fallback, { mode })]
    ])
  ];
  const marker = Symbol('hidden value');
  const wraps = [
    ['root', (value) => value],
    ['array', (value) => [value]],
    ['record', (value) => ({ value })],
    ['non-enumerable', (value) => Object.defineProperty({}, 'value', { value })],
    ['symbol-keyed', (value) => ({ [marker]: value })],
    ['Set', (value) => new Set([value])],
    ['Map key', (value) => new Map([[value, 1]])],
    ['Map value', (value) => new Map([['key', value]])],
    [
      'cyclic record',
      (value) => {
        const node = { value };
        node.self = node;
        return node;
      }
    ]
  ];
  for (const [name, compare] of routes) {
    const record = { first: 1, second: 2 };
    const omitted = new Proxy(
      { first: 1, second: 2, third: 2 },
      {
        ownKeys() {
          return ['first', 'third'];
        }
      }
    );
    const virtual = new Proxy(Object.create(record), {
      ownKeys() {
        return ['second', 'first'];
      }
    });
    check(name + ': proxy omitted key', false, () => compare(record, omitted));
    check(name + ': reversed proxy omitted key', false, () => compare(omitted, record));
    check(name + ': reordered virtual keys', true, () => compare(record, virtual));
    check(name + ': reversed virtual keys', true, () => compare(virtual, record));
    check(name + ': equal record control', true, () => compare({ a: [1, 2] }, { a: [1, 2] }));
    check(name + ': cyclic Set control', true, () => {
      const a = new Set(),
        b = new Set();
      a.add(a);
      b.add(b);
      return compare(a, b);
    });
    check(name + ': unequal Map control', false, () =>
      compare(new Map([[{ id: 1 }, 'a']]), new Map([[{ id: 1 }, 'b']]))
    );
    for (const [shape, wrap] of wraps) {
      check(name + ': same HTMLDDA reference / ' + shape, true, () => compare(wrap(all), wrap(all)));
      for (const value of [undefined, null]) {
        check(name + ': HTMLDDA vs ' + value + ' / ' + shape, false, () => compare(wrap(all), wrap(value)));
        check(name + ': ' + value + ' vs HTMLDDA / ' + shape, false, () => compare(wrap(value), wrap(all)));
      }
      check(name + ': distinct opaque HTMLDDA / ' + shape, false, () => compare(wrap(all), wrap(foreign)));
    }
    for (const value of [false, 0, '', {}, function () {}]) {
      check(name + ': HTMLDDA vs ' + typeof value, false, () => compare(all, value));
      check(name + ': ' + typeof value + ' vs HTMLDDA', false, () => compare(value, all));
    }
    function byId(other) {
      return this.id === other.id;
    }
    byId.call = () => true;
    check(name + ': hook decision cannot be shadowed', false, () =>
      compare({ id: 1, equals: byId }, { id: 2, equals: byId })
    );
    byId.call = null;
    check(name + ': callable hook does not need .call', true, () =>
      compare({ id: 1, equals: byId }, { id: 1, equals: byId })
    );
    Object.defineProperty(byId, 'call', {
      get() {
        throw new Error('unrelated .call getter');
      }
    });
    check(name + ': hook .call getter is not read', true, () =>
      compare({ id: 1, equals: byId }, { id: 1, equals: byId })
    );
  }
  // HTMLDDA participates in the same instance-hook protocol as other objects.
  const previousHook = Object.getOwnPropertyDescriptor(all, 'equals');
  try {
    Object.defineProperty(all, 'equals', { configurable: true, value: () => true });
    const other = { equals: () => true };
    const reject = { equals: () => false };
    for (const [name, compare] of routes) {
      check(name + ': HTMLDDA accepts bilateral hooks', true, () => compare(all, other));
      check(name + ': bilateral HTMLDDA hooks work in reverse', true, () => compare(other, all));
      check(name + ': nested HTMLDDA accepts bilateral hooks', true, () => compare([all], [other]));
      check(name + ': nested HTMLDDA hooks work in reverse', true, () => compare([other], [all]));
      check(name + ': another object can veto an HTMLDDA hook', false, () => compare(all, reject));
      check(name + ': HTMLDDA hook veto works in reverse', false, () => compare(reject, all));
      for (const value of [null, undefined]) {
        check(name + ': HTMLDDA hook cannot accept ' + value, false, () => compare(all, value));
        check(name + ': ' + value + ' cannot use an HTMLDDA hook', false, () => compare(value, all));
      }
    }
  } finally {
    if (previousHook) {
      Object.defineProperty(all, 'equals', previousHook);
    } else {
      delete all.equals;
    }
  }
  const containers = [
    (value) => value,
    (value) => ({ value }),
    (value) => new Set([value]),
    (value) => new Map([[value, 1]])
  ];
  for (const mode of ['default', 'strict', 'loose']) {
    for (const [i, wrap] of containers.entries()) {
      const rule = (a, b) => (a === all || b === all ? true : undefined);
      check(mode + ': custom decision overrides opaque identity / ' + i, true, () =>
        api.isEqual.custom(wrap(all), wrap(null), rule, { mode })
      );
      const reject = (a, b) => (a === all || b === all ? false : undefined);
      check(mode + ': custom veto overrides opaque identity / ' + i, false, () =>
        api.isEqual.create(reject, { mode })(wrap(all), wrap(all))
      );
    }
    const invalid = () => all;
    check(mode + ': HTMLDDA is an invalid callback return, not undefined', true, () => {
      try {
        api.isEqual.custom(1, 2, invalid, { mode });
        return false;
      } catch (error) {
        return error instanceof TypeError;
      }
    });
    const compare = api.isEqual.create(fallback, { mode });
    check(mode + ': factory retains no prior comparison state', true, () => {
      const a = { item: all },
        b = { item: null };
      const rejected = compare(a, b) === false;
      b.item = all;
      return rejected && compare(a, b) === true;
    });
  }
  // No native Buffer exists in this browser. A user class with the same shape
  // must retain its own equality contract, including exceptions.
  for (const [name, compare] of routes) {
    for (const behaviour of ['accept', 'veto', 'throw', 'invalid']) {
      const sentinel = new Error('application Buffer-shaped hook');
      const ApplicationBuffer = class Buffer extends Uint8Array {
        static isBuffer() {
          throw new Error('must not execute application metadata');
        }
        static from() {
          throw new Error('must not execute application metadata');
        }
        static alloc() {
          throw new Error('must not execute application metadata');
        }
        equals() {
          if (behaviour === 'accept') {
            return true;
          }
          if (behaviour === 'veto') {
            return false;
          }
          if (behaviour === 'throw') {
            throw sentinel;
          }
          return 'invalid';
        }
      };
      const a = new ApplicationBuffer([1]);
      const b = new ApplicationBuffer([behaviour === 'accept' ? 2 : 1]);
      for (const [direction, left, right] of [
        ['forward', a, b],
        ['reverse', b, a]
      ]) {
        check(name + ': application Buffer shape / ' + behaviour + ' / ' + direction, true, () => {
          try {
            const result = compare(left, right);
            return (behaviour === 'accept' && result === true) || (behaviour === 'veto' && result === false);
          } catch (error) {
            return (
              (behaviour === 'throw' && error === sentinel) || (behaviour === 'invalid' && error instanceof TypeError)
            );
          }
        });
      }
    }
  }
  const ignoreCase = (a, b) =>
    typeof a === 'string' && typeof b === 'string' ? a.toLowerCase() === b.toLowerCase() : undefined;
  check('custom nested strings', true, () => api.isEqual.custom({ name: 'A' }, { name: 'a' }, ignoreCase));
  check('custom Set matching remains one-to-one', false, () =>
    api.isEqual.custom(new Set(['A', 'a']), new Set(['a', 'b']), ignoreCase)
  );
  check('custom primitive identity veto', false, () =>
    api.isEqual.custom(new Set([1]), new Set([1]), (a, _b) => (typeof a === 'number' ? false : undefined))
  );
  return { userAgent: navigator.userAgent, cases };
};
