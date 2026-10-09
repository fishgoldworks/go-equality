'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const api = require('./helpers/api');

for (const mode of ['default', 'strict', 'loose']) {
  for (const form of ['standard', 'custom', 'factory']) {
    const make = (customizer = () => undefined) => {
      if (form === 'standard') {
        return mode === 'default' ? api.isEqual : api.isEqual[mode];
      }
      if (form === 'custom') {
        return (a, b) => api.isEqual.custom(a, b, customizer, { mode });
      }
      return api.isEqual.create(customizer, { mode });
    };
    const compare = make();
    const prefix = mode + '/' + form + ': ';
    const both = (left, right, expected) => {
      assert.equal(compare(left, right), expected);
      assert.equal(compare(right, left), expected);
    };

    test(prefix + 'Buffer candidates reject unrelated built-ins without invoking native equals', () => {
      for (const other of [{}, new Date(0), /a/, new DataView(new ArrayBuffer(1))]) {
        both(Buffer.from([1]), other, false);
      }
    });
    test(prefix + 'heterogeneous Buffer collections find the valid unordered assignment', () => {
      both(new Set([Buffer.from([1]), new Date(0)]), new Set([new Date(0), Buffer.from([1])]), true);
      both(
        new Map([
          [Buffer.from([1]), 'bytes'],
          [new Date(0), 'date']
        ]),
        new Map([
          [new Date(0), 'date'],
          [Buffer.from([1]), 'bytes']
        ]),
        true
      );
    });
    for (const kind of ['enumerable', 'non-enumerable', 'symbol']) {
      test(prefix + 'Buffer comparison includes ' + kind + ' own properties', () => {
        const a = Buffer.from([1]),
          b = Buffer.from([1]);
        const key = kind === 'symbol' ? Symbol('label') : 'label';
        Object.defineProperty(a, key, { value: 'old', enumerable: kind === 'enumerable' });
        Object.defineProperty(b, key, { value: 'new', enumerable: kind === 'enumerable' });
        both(a, b, false);
      });
    }
    test(prefix + 'Buffer subclasses keep the selected constructor policy', () => {
      class OtherBuffer extends Buffer {}
      const a = Buffer.from([1]),
        b = Object.setPrototypeOf(Buffer.from([1]), OtherBuffer.prototype);
      both(a, b, mode === 'loose');
    });
    test(prefix + 'an own Buffer constructor does not disguise inherited native equals', () => {
      const a = Buffer.from([1]),
        b = Buffer.from([1]);
      a.constructor = b.constructor = null;
      a.label = 1;
      b.label = 2;
      both(a, b, false);
    });
    test(prefix + 'explicit Buffer hooks can override both bytes and built-in kind', () => {
      const a = Buffer.from([1]),
        b = new Date(0);
      a.equals = b.equals = () => true;
      both(a, b, true);
    });
    test(prefix + 'Buffer subclass hooks retain their decisions and exceptions', () => {
      class AcceptingBuffer extends Buffer {
        equals() {
          return true;
        }
      }
      const a = Object.setPrototypeOf(Buffer.from([1]), AcceptingBuffer.prototype);
      const b = Object.setPrototypeOf(Buffer.from([2]), AcceptingBuffer.prototype);
      both(a, b, true);
      const error = new Error('deliberate Buffer hook');
      a.equals = () => {
        throw error;
      };
      assert.throws(
        () => compare(a, b),
        (actual) => actual === error
      );
      a.equals = () => 'invalid';
      assert.throws(
        () => compare(a, b),
        (actual) => actual.name === 'TypeError'
      );
    });
    test(prefix + 'a Uint8Array class named Buffer retains its application hook', () => {
      const NamedBuffer = class Buffer extends Uint8Array {
        equals() {
          return true;
        }
      };
      both(new NamedBuffer([1]), new NamedBuffer([2]), true);
    });
    test(prefix + 'own equals accessors remain application hooks and are read once', () => {
      const a = Buffer.from([1]),
        b = Buffer.from([2]);
      let reads = 0;
      Object.defineProperty(a, 'equals', {
        get() {
          reads++;
          return () => true;
        }
      });
      b.equals = () => true;
      assert.equal(compare(a, b), true);
      assert.equal(reads, 1);
    });
    if (form !== 'standard') {
      test(prefix + 'numeric customisers visit Buffer elements just like Uint8Array elements', () => {
        const near = make((a, b) =>
          typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1 : undefined
        );
        const reject = make((a, b) => (typeof a === 'number' && typeof b === 'number' ? false : undefined));
        for (const create of [(n) => Buffer.from([n]), (n) => new Uint8Array([n])]) {
          assert.equal(near(create(1), create(2)), true);
          assert.equal(reject(create(1), create(1)), false);
        }
      });
      test(prefix + 'a caller decision still precedes native Buffer handling', () => {
        assert.equal(make(() => true)(Buffer.from([1]), new Date(0)), true);
        assert.equal(make(() => false)(Buffer.from([1]), Buffer.from([1])), false);
      });
    }
  }
}

test('typed-array hooks do not require Buffer constructors or data descriptors', () => {
  const accept = () => true;
  const shapes = [
    { constructor: null },
    {
      get constructor() {
        throw new Error('constructor getter must not run');
      }
    },
    { constructor: Buffer },
    {
      get equals() {
        return accept;
      }
    }
  ];
  for (const shape of shapes) {
    const prototype = Object.create(Uint8Array.prototype, Object.getOwnPropertyDescriptors(shape));
    if (!Object.hasOwn(shape, 'equals')) {
      prototype.equals = accept;
    }
    const a = Object.setPrototypeOf(new Uint8Array([1]), prototype);
    const b = Object.setPrototypeOf(new Uint8Array([2]), prototype);
    assert.equal(api.isEqual(a, b), true);
  }
  const prototype = new Proxy(Uint8Array.prototype, {
    get(target, key, receiver) {
      return key === 'equals' ? accept : Reflect.get(target, key, receiver);
    }
  });
  assert.equal(
    api.isEqual(
      Object.setPrototypeOf(new Uint8Array([1]), prototype),
      Object.setPrototypeOf(new Uint8Array([2]), prototype)
    ),
    true
  );
  const a = new DataView(new ArrayBuffer(1)),
    b = new DataView(new ArrayBuffer(2));
  a.equals = b.equals = accept;
  assert.equal(api.isEqual(a, b), true);
});

test('Buffer-like application classes keep hooks when their prototype ancestry differs', () => {
  for (const parentKind of ['none', 'no constructor', 'wrong name', 'wrong prototype', 'wrong width']) {
    const BufferLike = class Buffer extends Uint8Array {
      equals() {
        return true;
      }
    };
    Object.assign(BufferLike, { isBuffer() {}, from() {}, alloc() {} });
    const parent = parentKind === 'none' ? null : Object.create(null);
    if (parent && parentKind !== 'no constructor') {
      const Typed = parentKind === 'wrong name' ? function OtherArray() {} : function Uint8Array() {};
      if (parentKind !== 'wrong prototype') {
        Typed.prototype = parent;
      }
      parent.constructor = Typed;
      parent.BYTES_PER_ELEMENT = 2;
    }
    Object.setPrototypeOf(BufferLike.prototype, parent);
    const a = new BufferLike([1]),
      b = new BufferLike([2]);
    assert.equal(api.isEqual(a, b), true, parentKind);
  }
});
