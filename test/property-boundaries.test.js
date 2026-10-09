'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const api = require('./helpers/api');

// These cases exercise acyclic own-state boundaries, not collection assignment
// or graph-topology policy. Fresh fixtures keep getters and mutations local.
function assertPair(compare, left, right, expected, message) {
  assert.equal(compare(left, right), expected, message + ' (forward)');
  assert.equal(compare(right, left), expected, message + ' (reverse)');
}

for (const [name, compare] of Object.entries(api)) {
  test(name + ': mixed own-key order and descriptor flags do not hide changed values', () => {
    const firstSymbol = Symbol('state');
    const secondSymbol = Symbol('state');
    const make = (reverse, changed) => {
      const object = Object.create(null);
      const entries = [
        ['10', { value: 1 }],
        ['02', { value: 2 }],
        ['hidden', { value: 3 }],
        [firstSymbol, { value: 4 }],
        [secondSymbol, { value: changed ? 6 : 5 }]
      ];
      for (const [key, value] of reverse ? entries.reverse() : entries) {
        Object.defineProperty(object, key, {
          value,
          enumerable: reverse,
          configurable: reverse,
          writable: reverse
        });
      }
      return object;
    };
    assertPair(compare, make(false, false), make(true, false), true, 'same own state');
    assertPair(compare, make(false, false), make(true, true), false, 'changed symbol value');
  });

  test(name + ': inheritance cannot replace missing own string or symbol keys', () => {
    for (const key of ['hidden', Symbol('hidden')]) {
      const left = Object.defineProperty({}, key, { value: { id: 1 } });
      const prototype = Object.defineProperty({}, key, {
        get() {
          throw new Error('An inherited data value must not be inspected.');
        }
      });
      const right = Object.create(prototype);
      // Keep the own-key counts equal; a count-only test would miss this case.
      Object.defineProperty(right, 'unrelated', { value: { id: 1 } });
      assertPair(compare, left, right, false, 'inherited key is not an own key');
      assertPair(compare, Object.create(prototype), Object.create(prototype), true, 'inherited data ignored');
    }
  });

  test(name + ': accessors compare nested values without invoking setters', () => {
    for (const key of ['settings', Symbol('settings')]) {
      const left = Object.defineProperty({}, key, {
        get() {
          return { theme: 'dark' };
        },
        set(_value) {
          throw new Error('Comparison must not write properties.');
        }
      });
      const right = Object.freeze({ [key]: Object.freeze({ theme: 'dark' }) });
      assertPair(compare, left, right, true, 'getter result versus data property');
      assertPair(compare, left, { [key]: { theme: 'light' } }, false, 'nested getter mismatch');
      const setterOnly = Object.defineProperty({}, key, {
        set(_value) {
          throw new Error('Comparison must not call this setter.');
        }
      });
      assertPair(compare, setterOnly, { [key]: undefined }, true, 'setter-only property reads undefined');
      assertPair(compare, setterOnly, {}, false, 'undefined still requires an own key');
    }
  });

  test(name + ': nested own accessors preserve thrown-value identity', () => {
    for (const error of [new Error('own getter'), undefined, null, false, 0]) {
      const key = Symbol('value');
      const left = {
        child: Object.defineProperty({}, key, {
          get() {
            // Verify original thrown values, including non-Error values, are preserved.
            throw error;
          }
        })
      };
      const right = { child: { [key]: 1 } };
      for (const [a, b] of [
        [left, right],
        [right, left]
      ]) {
        let didThrow = false;
        let caught;
        try {
          compare(a, b);
        } catch (thrown) {
          didThrow = true;
          caught = thrown;
        }
        assert.equal(didThrow, true);
        assert.equal(caught, error);
      }
      assertPair(compare, { child: { [key]: 1 } }, right, true, 'later comparison remains usable');
    }
  });

  test(name + ': inherited array indices do not fill holes for equality', () => {
    const prototype = Object.create(Array.prototype);
    Object.defineProperty(prototype, '0', {
      get() {
        throw new Error('An inherited index must not fill a hole.');
      }
    });
    const left = Object.setPrototypeOf(Array(2), prototype);
    const right = Array(2);
    assertPair(compare, left, right, true, 'two holes');
    const explicit = Array(2);
    Object.defineProperty(explicit, '0', { value: undefined });
    assertPair(compare, left, explicit, false, 'own undefined is not a hole');
    const moved = Array(2);
    Object.defineProperty(moved, '1', { value: undefined });
    assertPair(compare, explicit, moved, false, 'equal counts do not replace matching indices');
  });

  test(name + ': sparse arrays retain noncanonical and out-of-index-range own keys', () => {
    const symbol = Symbol('extra');
    const make = () => {
      const value = [];
      Object.defineProperty(value, '2', { value: { id: 1 }, configurable: true });
      Object.defineProperty(value, '4294967295', { value: { id: 2 }, configurable: true });
      Object.defineProperty(value, '-0', { value: { id: 3 }, configurable: true });
      Object.defineProperty(value, '01', { value: { id: 4 }, configurable: true });
      Object.defineProperty(value, symbol, { value: { id: 5 }, configurable: true });
      return value;
    };
    const left = make();
    assertPair(compare, left, make(), true, 'sparse state with only five stored values');
    for (const key of ['2', '4294967295', '-0', '01', symbol]) {
      const right = make();
      Object.defineProperty(right, key, { value: { id: 99 } });
      assertPair(compare, left, right, false, 'changed stored key ' + String(key));
    }
  });

  test(name + ': strict and mapped arguments share payload rules but omit bookkeeping', () => {
    // Both objects use the same foreign Object constructor. Only one arguments
    // object is mapped; callee and Symbol.iterator must not determine equality.
    const [strict, mapped] = vm.runInNewContext(`[
      (function () { 'use strict'; return arguments; })(1, { id: 2 }),
      (function (first, second) { return arguments; })(1, { id: 2 })
    ]`);
    assertPair(compare, strict, mapped, true, 'strict versus mapped arguments');
    for (const key of ['callee', Symbol.iterator]) {
      Object.defineProperty(mapped, key, {
        get() {
          throw new Error('Excluded arguments bookkeeping must not be read.');
        },
        configurable: true
      });
    }
    assertPair(compare, strict, mapped, true, 'excluded throwing bookkeeping accessors');
    delete mapped[Symbol.iterator];
    delete mapped.callee;
    assertPair(compare, strict, mapped, true, 'excluded key presence');
    mapped[0] = 3;
    assertPair(compare, strict, mapped, false, 'indexed data still matters');
  });

  test(name + ': arguments retain length holes and custom hidden or symbol data', () => {
    function values() {
      return arguments;
    }
    const left = values(1, undefined);
    const right = values(1, undefined);
    assertPair(compare, left, right, true, 'normal arguments');
    delete right[1];
    assertPair(compare, left, right, false, 'missing index differs from undefined');
    delete left[1];
    assertPair(compare, left, right, true, 'matching holes');
    right.length = 3;
    assertPair(compare, left, right, false, 'length remains own state');
    right.length = 2;
    for (const key of ['hidden', Symbol('extra')]) {
      const a = values(1);
      const b = values(1);
      Object.defineProperty(a, key, { value: { id: 1 } });
      Object.defineProperty(b, key, { value: { id: 2 } });
      assertPair(compare, a, b, false, 'custom arguments property');
    }
  });

  test(name + ': Dates compare intrinsic timestamps despite overridden conversion methods', () => {
    class EventDate extends Date {
      getTime() {
        throw new Error('Do not invoke an overridden Date method.');
      }
      valueOf() {
        throw new Error('Do not coerce Dates.');
      }
    }
    assertPair(compare, new EventDate(0), new EventDate(0), true, 'matching timestamps');
    assertPair(compare, new EventDate(0), new EventDate(1), false, 'different timestamps');
    assertPair(compare, new EventDate(NaN), new EventDate(NaN), true, 'invalid timestamps');
    assertPair(compare, new EventDate(0), new EventDate(NaN), false, 'valid versus invalid');
  });

  test(name + ': valid and invalid Dates still compare hidden and symbol decorations', () => {
    for (const timestamp of [0, NaN]) {
      for (const key of ['metadata', Symbol('metadata')]) {
        const left = Object.defineProperty(new Date(timestamp), key, { value: { id: 1 } });
        const equal = Object.defineProperty(new Date(timestamp), key, { value: { id: 1 }, enumerable: true });
        const different = Object.defineProperty(new Date(timestamp), key, { value: { id: 2 } });
        assertPair(compare, left, equal, true, 'matching decorated Dates');
        assertPair(compare, left, different, false, 'nested decoration mismatch');
        assertPair(compare, left, new Date(timestamp), false, 'missing decoration');
      }
    }
  });

  test(name + ': RegExp intrinsic source and flags cannot be hidden by own overrides', () => {
    const doNotExecute = () => {
      throw new Error('Comparison must not execute regular expressions.');
    };
    const decorate = (expression) =>
      Object.defineProperties(expression, {
        source: { value: 'same exposed source' },
        flags: { value: 'same exposed flags' },
        global: { value: false },
        exec: { value: doNotExecute },
        test: { value: doNotExecute }
      });
    assertPair(compare, decorate(/cat/g), decorate(/cat/g), true, 'matching intrinsic state');
    assertPair(compare, decorate(/cat/g), decorate(/dog/g), false, 'source mismatch under shadow');
    assertPair(compare, decorate(/cat/g), decorate(/cat/i), false, 'flag mismatch under shadow');
    assertPair(compare, decorate(/cat/g), decorate(/cat/), false, 'global flag mismatch under shadow');
  });

  test(name + ': every available native RegExp flag contributes to equality', () => {
    const flags = [
      ['hasIndices', 'd'],
      ['global', 'g'],
      ['ignoreCase', 'i'],
      ['multiline', 'm'],
      ['dotAll', 's'],
      ['unicode', 'u'],
      ['unicodeSets', 'v'],
      ['sticky', 'y']
    ];
    for (const [property, flag] of flags) {
      // Contributor engines may differ in optional native flag support.
      if (!Object.getOwnPropertyDescriptor(RegExp.prototype, property)) {
        continue;
      }
      const left = new RegExp('item', flag);
      const equal = new RegExp('item', flag);
      const different = new RegExp('item');
      for (const expression of [left, equal, different]) {
        Object.defineProperty(expression, property, { value: false });
        Object.defineProperty(expression, 'flags', { value: '' });
      }
      assertPair(compare, left, equal, true, 'matching intrinsic flag ' + flag);
      assertPair(compare, left, different, false, 'changed intrinsic flag ' + flag);
    }
  });

  test(name + ': RegExp own values and nested lastIndex remain comparison data', () => {
    for (const key of ['global', Symbol('metadata')]) {
      const left = Object.defineProperty(/item/gi, key, { value: { id: 1 } });
      const equal = Object.defineProperty(/item/gi, key, { value: { id: 1 }, enumerable: true });
      const different = Object.defineProperty(/item/gi, key, { value: { id: 2 } });
      assertPair(compare, left, equal, true, 'matching intrinsic and own state');
      assertPair(compare, left, different, false, 'different own state');
    }
    // lastIndex is writable ordinary own data, even when the RegExp is not global.
    const left = /item/;
    const right = /item/;
    left.lastIndex = { position: 2 };
    right.lastIndex = { position: 2 };
    assertPair(compare, left, right, true, 'nested lastIndex');
    right.lastIndex.position = 3;
    assertPair(compare, left, right, false, 'changed nested lastIndex');
    left.lastIndex = 2;
    right.lastIndex = '2';
    assertPair(compare, left, right, name === 'isLooseEqual', 'mode applied to lastIndex');
  });

  test(name + ': strict wrappers compare hidden accessor and symbol decorations', () => {
    for (const payload of [1, NaN, 'item', false, 1n, Symbol.for('r06-payload')]) {
      const key = Symbol('metadata');
      const left = Object.defineProperty(Object(payload), key, {
        get() {
          return { id: 1 };
        }
      });
      const equal = Object.defineProperty(Object(payload), key, { value: { id: 1 }, enumerable: true });
      const different = Object.defineProperty(Object(payload), key, { value: { id: 2 } });
      assertPair(compare, left, equal, true, 'matching decorated wrappers');
      assertPair(compare, left, different, name !== 'isStrictEqual', 'wrapper decoration mode');
      assertPair(compare, left, Object(payload), name !== 'isStrictEqual', 'missing wrapper decoration');
    }
  });
}

for (const mode of ['default', 'loose', 'strict']) {
  for (const form of ['custom', 'create']) {
    test(form + ' ' + mode + ': own-state custom decisions do not override intrinsic payload or shape', () => {
      const numeric = (a, b) => (typeof a === 'number' && typeof b === 'number' ? true : undefined);
      const compare =
        form === 'create'
          ? api.isEqual.create(numeric, { mode })
          : (a, b) => api.isEqual.custom(a, b, numeric, { mode });
      const key = Symbol('metadata');
      const make = (object, value) => Object.defineProperty(object, key, { value: { score: value } });
      for (const create of [() => ({}), () => [], () => new Date(0), () => /item/g]) {
        assertPair(compare, make(create(), 1), make(create(), 2), true, 'custom numeric own value');
        assertPair(compare, make(create(), 1), create(), false, 'shape cannot be repaired by a child callback');
      }
      assertPair(compare, new Date(1), new Date(2), false, 'Date payload is not a nested number');
      assertPair(compare, /first/g, /second/g, false, 'RegExp pattern remains intrinsic');
      assertPair(compare, Array(1), Array(2), false, 'array length is structural');
      const left = /item/g;
      const right = /item/g;
      left.lastIndex = 1;
      right.lastIndex = 2;
      assertPair(compare, left, right, true, 'RegExp lastIndex is ordinary own data');
      if (mode === 'strict') {
        assertPair(compare, make(Object(1), 1), make(Object(1), 2), true, 'strict wrapper decoration');
        assertPair(compare, Object(1), Object(2), false, 'strict wrapper payload is intrinsic');
      }
    });
  }
}

// Loose mode ignores constructor identity, not an explicitly stored field.
test('isLooseEqual: own constructor metadata is still recursively compared', () => {
  const left = Object.defineProperty({}, 'constructor', { value: { revision: 1 } });
  assertPair(api.isLooseEqual, left, { constructor: { revision: '1' } }, true, 'loose nested data');
  assertPair(api.isLooseEqual, left, { constructor: { revision: 2 } }, false, 'changed own constructor data');
  assertPair(api.isLooseEqual, left, {}, false, 'own constructor cannot be missing');
});

// Key lists and property descriptors can differ on a valid, stable proxy.
// Comparison must use the same exposed key lists regardless of their order.
const proxyRoutes = [
  ...Object.entries(api),
  ['isEqual.strict', api.isEqual.strict],
  ['isEqual.loose', api.isEqual.loose],
  ...['default', 'strict', 'loose'].flatMap((mode) => [
    ['custom ' + mode, (a, b) => api.isEqual.custom(a, b, () => undefined, { mode })],
    ['create ' + mode, api.isEqual.create(() => undefined, { mode })]
  ])
];
for (const [name, compare] of proxyRoutes) {
  test(name + ': proxy key lists reject omitted keys even when the target owns them', () => {
    for (const keys of [
      ['first', 'second', 'third'],
      [Symbol('first'), Symbol('second'), Symbol('third')]
    ]) {
      const [first, second, third] = keys;
      const left = { [first]: 1, [second]: 2 };
      const visible = { [first]: 1, [third]: 2 };
      for (const exposed of [
        [first, third],
        [third, first]
      ]) {
        const right = new Proxy(
          { [first]: 1, [second]: 2, [third]: 2 },
          {
            ownKeys() {
              return exposed;
            }
          }
        );
        assert.deepEqual(Reflect.ownKeys(right), exposed, 'fixture exposes a different key set');
        assert.equal(Object.prototype.hasOwnProperty.call(right, second), true, 'omitted key still exists on target');
        for (const wrap of [
          (value) => value,
          (value) => ({ value }),
          (value) => new Set([value]),
          (value) => new Map([[value, 1]])
        ]) {
          assertPair(compare, wrap(left), wrap(right), false, 'different exposed key sets');
          assertPair(compare, wrap(visible), wrap(right), true, 'matching exposed state');
        }
      }
    }
  });

  test(name + ': proxy virtual keys compare consistently in either key order', () => {
    const symbol = Symbol('virtual');
    const left = { first: 1, second: 2, [symbol]: 3 };
    for (const exposed of [
      ['first', 'second', symbol],
      [symbol, 'second', 'first']
    ]) {
      const right = new Proxy(Object.create(left), {
        ownKeys() {
          return exposed;
        }
      });
      assert.equal(Object.prototype.hasOwnProperty.call(right, 'first'), false, 'fixture supplies a virtual key');
      assertPair(compare, left, right, true, 'matching exposed keys and values');
      assertPair(compare, { first: 1, second: 9, [symbol]: 3 }, right, false, 'different exposed value');
      assertPair(compare, { first: 1, second: 2 }, right, false, 'missing exposed symbol');
    }
  });
}
