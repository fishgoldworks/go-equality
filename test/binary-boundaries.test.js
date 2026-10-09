'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { Buffer } = require('node:buffer');
const api = require('./helpers/api');

const modes = [
  ['default', api.isEqual],
  ['loose', api.isLooseEqual],
  ['strict', api.isStrictEqual]
];
const typedKinds = [
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array
];
const isBigIntKind = (Type) => Type === BigInt64Array || Type === BigUint64Array;
const delegate = () => undefined;

function both(compare, left, right, expected, message) {
  assert.equal(compare(left, right), expected, message + ' (forward)');
  assert.equal(compare(right, left), expected, message + ' (reverse)');
}

function invalidBoth(compare, left, right) {
  for (const [a, b] of [
    [left, right],
    [right, left]
  ]) {
    assert.throws(
      () => compare(a, b),
      (error) => error.name === 'TypeError'
    );
  }
}

// The payload is nonuniform to detect offset/word-order mistakes, not just a
// length mismatch. Bytes outside each visible window deliberately differ.
function windowBytes(BufferType, offset, length, fill) {
  const bytes = new Uint8Array(new BufferType(offset + length + 5));
  bytes.fill(fill);
  for (let i = 0; i < length; i++) {
    bytes[offset + i] = (i * 73 + 19) & 255;
  }
  return bytes;
}

for (const [mode, compare] of modes) {
  test(mode + ': binary windows cover every alignment residue and word-tail size', () => {
    for (const [Left, Right] of [
      [ArrayBuffer, ArrayBuffer],
      [SharedArrayBuffer, SharedArrayBuffer],
      [ArrayBuffer, SharedArrayBuffer]
    ]) {
      for (const length of [0, 1, 63, 64, 65, 66, 67, 130, 131]) {
        for (let leftOffset = 0; leftOffset < 4; leftOffset++) {
          for (let rightOffset = 4; rightOffset < 8; rightOffset++) {
            const left = windowBytes(Left, leftOffset, length, 211);
            const right = windowBytes(Right, rightOffset, length, 233);
            const a = new DataView(left.buffer, leftOffset, length);
            const b = new DataView(right.buffer, rightOffset, length);
            const label = Left.name + '/' + Right.name + ':' + length + '@' + leftOffset + '/' + rightOffset;
            both(compare, a, b, true, label);
            for (const index of new Set([0, 3, 31, 32, 63, 64, length - 3, length - 2, length - 1])) {
              if (index >= 0 && index < length) {
                right[rightOffset + index] ^= 128;
                both(compare, a, b, false, label + ' changed byte ' + index);
                right[rightOffset + index] ^= 128;
              }
            }
            both(compare, a, b, true, label + ' restored');
          }
        }
      }
    }
  });

  test(mode + ': typed slices compare visible elements rather than their backing allocation', () => {
    for (const Type of typedKinds) {
      const values = isBigIntKind(Type) ? [1n, 2n, 3n] : [1, 2, 3];
      const padding = isBigIntKind(Type) ? 9n : 9;
      const left = new Type([padding, ...values, padding]);
      const right = new Type([padding, padding, ...values, padding, padding]);
      const a = left.subarray(1, 4);
      const b = right.subarray(2, 5);
      both(compare, a, b, true, Type.name + ' equal window');
      for (let i = 0; i < values.length; i++) {
        b[i] = padding;
        both(compare, a, b, false, Type.name + ' changed element ' + i);
        b[i] = values[i];
      }
      both(compare, a, b, true, Type.name + ' unchanged after comparison');
    }
    const first = Buffer.from([9, 1, 2, 3, 9]);
    const second = Buffer.from([8, 8, 1, 2, 3, 8]);
    both(compare, first.subarray(1, 4), second.subarray(2, 5), true, 'Buffer slices');
    second[4] = 99;
    both(compare, first.subarray(1, 4), second.subarray(2, 5), false, 'changed Buffer slice');
  });

  test(mode + ': distinct floating NaN encodings remain value-equal but byte-unequal', () => {
    const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
    for (const Type of [Float32Array, Float64Array]) {
      const make = (payload) => {
        const bytes = new ArrayBuffer(Type.BYTES_PER_ELEMENT);
        const view = new DataView(bytes);
        if (Type === Float32Array) {
          view.setUint32(0, 0x7fc00000 + payload, littleEndian);
        } else {
          view.setUint32(littleEndian ? 4 : 0, 0x7ff80000, littleEndian);
          view.setUint32(littleEndian ? 0 : 4, payload, littleEndian);
        }
        return new Type(bytes);
      };
      const a = make(1);
      const b = make(2);
      assert.equal(Number.isNaN(a[0]), true, 'fixture is a NaN');
      assert.equal(Number.isNaN(b[0]), true, 'fixture is another NaN');
      assert.notDeepEqual(new Uint8Array(a.buffer), new Uint8Array(b.buffer), 'distinct raw encodings');
      both(compare, a, b, true, Type.name + ' numeric values');
      both(compare, a.buffer, b.buffer, false, Type.name + ' raw bytes');
      both(compare, new DataView(a.buffer), new DataView(b.buffer), false, Type.name + ' byte views');
    }
  });

  test(mode + ': integer element kinds retain signed and clamped interpretation', () => {
    const bytes = new Uint8Array([255]);
    both(compare, new Int8Array(bytes.buffer), bytes, false, 'signed versus unsigned same bytes');
    both(compare, new Uint8ClampedArray(bytes.buffer), bytes, false, 'clamped versus unsigned same bytes');
    const bigBytes = new BigUint64Array([18446744073709551615n]);
    both(compare, new BigInt64Array(bigBytes.buffer), bigBytes, false, 'BigInt sign kind');
    both(compare, new BigInt64Array([-1n]), new BigInt64Array(bigBytes.buffer), true, 'same signed value');
  });

  test(mode + ': inherited binary accessors and methods cannot replace native payload reads', () => {
    const poison = () => {
      throw new Error('An inherited override must not be used for the payload.');
    };
    for (const Base of [ArrayBuffer, DataView, Uint16Array]) {
      class View extends Base {}
      for (const key of ['length', 'byteLength', 'byteOffset', 'buffer']) {
        Object.defineProperty(View.prototype, key, { get: poison });
      }
      Object.defineProperty(View.prototype, 'values', { value: poison });
      Object.defineProperty(View.prototype, Symbol.iterator, { value: poison });
      const make = (changed) => {
        if (Base === ArrayBuffer) {
          const value = new View(67);
          new Uint8Array(value)[66] = changed ? 2 : 1;
          return value;
        }
        if (Base === DataView) {
          const backing = new Uint8Array(74);
          backing[70] = changed ? 2 : 1;
          return new View(backing.buffer, 4, 67);
        }
        return new View([1, changed ? 3 : 2]);
      };
      both(compare, make(false), make(false), true, Base.name + ' inherited overrides');
      both(compare, make(false), make(true), false, Base.name + ' real payload differs');
    }
  });

  test(mode + ': binary own metadata decorations remain ordinary compared data', () => {
    const symbol = Symbol('binary-label');
    for (const make of [
      () => new ArrayBuffer(67),
      () => new SharedArrayBuffer(67),
      () => new DataView(new ArrayBuffer(75), 4, 67),
      () => new Uint16Array([1, 2]),
      () => Buffer.from([1, 2])
    ]) {
      const decorate = (value, reverse, changed) => {
        const entries = [
          ['byteLength', { label: 'metadata' }],
          ['buffer', { label: 'metadata' }],
          ['01', { label: 'extra' }],
          [symbol, { label: changed ? 'different' : 'extra' }]
        ];
        for (const [key, data] of reverse ? entries.reverse() : entries) {
          Object.defineProperty(value, key, { value: data, enumerable: reverse });
        }
        return value;
      };
      both(compare, decorate(make(), false, false), decorate(make(), true, false), true, 'equal own metadata');
      both(compare, decorate(make(), false, false), decorate(make(), true, true), false, 'changed own symbol');
      const failure = new Error('binary decoration getter');
      const left = Object.defineProperty(make(), symbol, {
        get() {
          throw failure;
        }
      });
      const right = Object.defineProperty(make(), symbol, { value: null });
      for (const [a, b] of [
        [left, right],
        [right, left]
      ]) {
        assert.throws(
          () => compare(a, b),
          (error) => error === failure
        );
      }
    }
  });

  test(mode + ': valid resizable view windows reflect changes between independent calls', () => {
    for (const make of [(buffer) => new Uint16Array(buffer, 2), (buffer) => new DataView(buffer, 2)]) {
      const left = new ArrayBuffer(8, { maxByteLength: 20 });
      const right = new ArrayBuffer(8, { maxByteLength: 32 });
      const a = make(left);
      const b = make(right);
      both(compare, a, b, true, 'same visible window with different capacity');
      left.resize(14);
      right.resize(14);
      both(compare, a, b, true, 'both grown');
      new Uint8Array(right)[13] = 1;
      both(compare, a, b, false, 'newly visible byte changed');
      new Uint8Array(right)[13] = 0;
      left.resize(4);
      right.resize(4);
      both(compare, a, b, true, 'both shrunk');
      right.resize(6);
      both(compare, a, b, false, 'visible lengths differ');
    }
  });

  test(mode + ': length-tracking typed arrays exclude incomplete trailing elements', () => {
    const left = new ArrayBuffer(9, { maxByteLength: 16 });
    const right = new ArrayBuffer(10, { maxByteLength: 16 });
    const a = new Uint32Array(left, 4);
    const b = new Uint32Array(right, 4);
    a[0] = b[0] = 1;
    new Uint8Array(left)[8] = 9;
    new Uint8Array(right)[8] = 8;
    assert.equal(a.length, 1, 'fixture exposes one complete element');
    assert.equal(b.length, 1, 'different trailing byte counts do not add elements');
    both(compare, a, b, true, 'incomplete trailing bytes ignored');
    both(compare, new DataView(left, 4), new DataView(right, 4), false, 'DataViews retain all window bytes');
    left.resize(12);
    right.resize(12);
    both(compare, a, b, false, 'completed second element now differs');
    new Uint8Array(left).fill(0, 8);
    new Uint8Array(right).fill(0, 8);
    both(compare, a, b, true, 'restored complete elements');
  });

  test(mode + ': fixed-length views reject out-of-bounds state and recover after regrowth', () => {
    for (const make of [(buffer) => new Uint16Array(buffer, 2, 2), (buffer) => new DataView(buffer, 2, 4)]) {
      const left = new ArrayBuffer(8, { maxByteLength: 16 });
      const right = new ArrayBuffer(8, { maxByteLength: 16 });
      const a = make(left);
      const b = make(right);
      both(compare, a, b, true, 'initial fixed window');
      left.resize(2);
      invalidBoth(compare, a, b);
      right.resize(2);
      invalidBoth(compare, a, b);
      assert.equal(compare(a, a), true, 'identity bypass remains intentional');
      left.resize(8);
      right.resize(8);
      both(compare, a, b, true, 'valid again');
      new Uint8Array(right)[5] = 1;
      both(compare, a, b, false, 'restored payload is inspected');
    }
  });

  test(mode + ': growable shared views compare current windows without requiring equal capacity', () => {
    for (const make of [(buffer) => new Uint8Array(buffer, 4), (buffer) => new DataView(buffer, 4)]) {
      const left = new SharedArrayBuffer(8, { maxByteLength: 16 });
      const right = new SharedArrayBuffer(8, { maxByteLength: 24 });
      const a = make(left);
      const b = make(right);
      both(compare, a, b, true, 'initial shared windows');
      left.grow(12);
      both(compare, a, b, false, 'one window grows');
      right.grow(12);
      both(compare, a, b, true, 'both windows grow');
      new Uint8Array(right)[11] = 1;
      both(compare, a, b, false, 'newly visible shared byte');
      new Uint8Array(right)[11] = 0;
      both(compare, a, b, true, 'restored shared content');
    }
  });

  test(mode + ': detached binary values are not mistaken for valid empty values', () => {
    for (const make of [(buffer) => buffer, (buffer) => new Uint8Array(buffer), (buffer) => new DataView(buffer)]) {
      const backing = new ArrayBuffer(4);
      const detached = make(backing);
      structuredClone(backing, { transfer: [backing] });
      const empty = make(new ArrayBuffer(0));
      invalidBoth(compare, detached, empty);
      assert.equal(compare(detached, detached), true, 'identity precedes invalid-view checks');
      both(compare, empty, make(new ArrayBuffer(0)), true, 'genuinely empty control');
    }
  });

  test(mode + ': foreign binary values retain kind and constructor rules', () => {
    for (const expression of [
      'new ArrayBuffer(67)',
      'new SharedArrayBuffer(67)',
      'new DataView(new ArrayBuffer(75), 4, 67)',
      'new Uint16Array([1, 2])',
      'new BigInt64Array([1n, 2n])'
    ]) {
      const left = vm.runInNewContext(expression);
      const right = vm.runInNewContext(expression);
      both(compare, left, right, mode === 'loose', expression);
    }
  });
}

for (const mode of ['default', 'loose', 'strict']) {
  for (const form of ['custom', 'create']) {
    const configure = (customizer) =>
      form === 'create'
        ? api.isEqual.create(customizer, { mode })
        : (a, b) => api.isEqual.custom(a, b, customizer, { mode });

    test(mode + '/' + form + ': all native element kinds reach numeric custom decisions', () => {
      for (const Type of [...typedKinds, Buffer]) {
        const make = (value) => (Type === Buffer ? Buffer.from([value]) : new Type([value]));
        const one = isBigIntKind(Type) ? 1n : 1;
        const two = isBigIntKind(Type) ? 2n : 2;
        const decide = (result) => (a, b) => (typeof a === typeof one && typeof b === typeof one ? result : undefined);
        both(configure(decide(true)), make(one), make(two), true, Type.name + ' element override');
        both(configure(decide(false)), make(one), make(one), false, Type.name + ' element veto');
        both(configure(delegate), make(one), make(two), false, Type.name + ' fallback');
      }
    });

    test(mode + '/' + form + ': raw bytes remain internal while binary decorations are customised', () => {
      const compare = configure((a, b) => (typeof a === 'number' && typeof b === 'number' ? true : undefined));
      for (const make of [
        (value) => Uint8Array.of(value).buffer,
        (value) => new DataView(Uint8Array.of(value).buffer),
        (value) => {
          const buffer = new SharedArrayBuffer(1);
          new Uint8Array(buffer)[0] = value;
          return buffer;
        }
      ]) {
        both(compare, make(1), make(2), false, 'numeric customiser cannot override byte payload');
        const a = Object.assign(make(1), { revision: 1 });
        const b = Object.assign(make(1), { revision: 2 });
        both(compare, a, b, true, 'own numeric metadata reaches customiser');
        both(configure(delegate), a, b, false, 'fallback still compares metadata');
      }
    });

    test(mode + '/' + form + ': whole-pair custom decisions precede invalid binary inspection', () => {
      for (const make of [(buffer) => buffer, (buffer) => new Uint16Array(buffer), (buffer) => new DataView(buffer)]) {
        const buffer = new ArrayBuffer(4);
        const value = make(buffer);
        structuredClone(buffer, { transfer: [buffer] });
        const other = make(new ArrayBuffer(0));
        both(
          configure(() => true),
          value,
          other,
          true,
          'explicit acceptance'
        );
        both(
          configure(() => false),
          value,
          value,
          false,
          'explicit identity veto'
        );
        const delegated = configure(delegate);
        invalidBoth(delegated, value, other);
        both(delegated, other, make(new ArrayBuffer(0)), true, 'subsequent comparison after invalid state');
      }
    });
  }
}
