'use strict';
// Runs on the consumer minimum without the modern development test runner.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const entry = process.argv[2] ? path.resolve(process.argv[2]) : 'go-equality';
const packageRoot = path.dirname(require.resolve(entry + '/package.json'));
let checks = 0;
function equal(actual, expected, label) {
  checks++;
  assert.strictEqual(actual, expected, label);
}
function throws(fn, type) {
  checks++;
  assert.throws(
    fn,
    type === TypeError
      ? function (error) {
          return error.name === 'TypeError';
        }
      : type
  );
}
function perfect(matrix, row, used) {
  if (row === matrix.length) {
    return true;
  }
  for (let column = 0; column < matrix.length; column++) {
    if (matrix[row][column] && !used[column]) {
      used[column] = true;
      if (perfect(matrix, row + 1, used)) {
        return true;
      }
      used[column] = false;
    }
  }
  return false;
}
function exercise(api, label) {
  const modes = [api.isEqual, api.isStrictEqual, api.isLooseEqual];
  equal(api.isEqual.strict, api.isStrictEqual, label + ' strict alias');
  equal(api.isEqual.loose, api.isLooseEqual, label + ' loose alias');
  modes.forEach(function (compare, mode) {
    const loose = mode === 2;
    const strict = mode === 1;
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
    equal(compare(record, omitted), false, label + ' proxy omitted key');
    equal(compare(omitted, record), false, label + ' reversed proxy omitted key');
    equal(compare(record, virtual), true, label + ' reordered virtual keys');
    equal(compare(virtual, record), true, label + ' reversed virtual keys');
    const cases = [
      [1, 1, true],
      [1, '1', loose],
      [null, undefined, loose],
      [NaN, NaN, true],
      [0, -0, true],
      [1, Object(1), !strict],
      [Object(1), Object(1), true],
      [Object('1'), 1, loose],
      [{ x: [1, 2] }, { x: [1, 2] }, true],
      [{ x: [1, 2] }, { x: [2, 1] }, false],
      [new Array(1), [undefined], false],
      [new Date(1), new Date(2), false],
      [new Date(NaN), new Date(NaN), true],
      [/ab/gi, /ab/gi, true],
      [/ab/g, /ab/i, false],
      [new Set([{ id: 1 }, { id: 2 }]), new Set([{ id: 2 }, { id: 1 }]), true],
      [new Map([[{ id: 1 }, 'a']]), new Map([[{ id: 1 }, 'b']]), false],
      [
        new Map([
          [{ id: 1 }, 'a'],
          [{ id: 2 }, 'b']
        ]),
        new Map([
          [{ id: 2 }, 'b'],
          [{ id: 1 }, 'a']
        ]),
        true
      ],
      [new Uint8Array([1, 2]), new Uint8Array([1, 3]), false],
      [new Float64Array([NaN, 0]), new Float64Array([NaN, -0]), true],
      [new Uint8Array([1]), new Uint16Array([1]), false],
      [Buffer.from([1, 2]), new Uint8Array([1, 2]), loose],
      [Buffer.from([1]), {}, false],
      [new Date(0), Buffer.from([1]), false],
      [Object.assign(Buffer.from([1]), { label: 'old' }), Object.assign(Buffer.from([1]), { label: 'new' }), false],
      [new Set([Buffer.from([1]), new Date(0)]), new Set([new Date(0), Buffer.from([1])]), true],
      [
        new Map([
          [Buffer.from([1]), 'b'],
          [new Date(0), 'd']
        ]),
        new Map([
          [new Date(0), 'd'],
          [Buffer.from([1]), 'b']
        ]),
        true
      ],
      [Promise.resolve(1), Promise.resolve(1), false],
      [new Error('a'), new Error('a'), false],
      [new WeakMap(), new WeakMap(), false],
      [function () {}, function () {}, false]
    ];
    cases.forEach(function (item, i) {
      equal(compare(item[0], item[1]), item[2], label + ' case ' + i);
    });
    const options = { mode: mode === 0 ? 'default' : mode === 1 ? 'strict' : 'loose' };
    const numeric = function (a, b) {
      return typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) === 1 : undefined;
    };
    equal(api.isEqual.custom(Buffer.from([1]), Buffer.from([2]), numeric, options), true);
    equal(api.isEqual.custom(Buffer.from([1]), Buffer.from([1]), numeric, options), false);
    equal(api.isEqual.create(numeric, options)(Buffer.from([1]), Buffer.from([2])), true);
    equal(api.isEqual.create(numeric, options)(Buffer.from([1]), Buffer.from([1])), false);
    function A() {
      this.id = 1;
    }
    function B() {
      this.id = 1;
    }
    equal(compare(new A(), new B()), loose);
    equal(compare(Object.assign(Object.create(null), { id: 1 }), Object.assign(Object.create(null), { id: 1 })), true);
    const symbol = Symbol('hidden');
    const left = { [symbol]: 1 },
      right = { [symbol]: 1 };
    equal(compare(left, right), true);
    Object.defineProperty(left, 'secret', { value: 1 });
    Object.defineProperty(right, 'secret', { value: 2 });
    equal(compare(left, right), false);
    const cycleA = { id: 1 },
      cycleB = { id: 1 };
    cycleA.self = cycleA;
    cycleB.self = cycleB;
    equal(compare(cycleA, cycleB), true);
    cycleB.id = 2;
    equal(compare(cycleA, cycleB), false);
    const setA = new Set(),
      setB = new Set();
    setA.add(setA);
    setB.add(setB);
    equal(compare(setA, setB), true);
    const mapA = new Map(),
      mapB = new Map();
    mapA.set(mapA, 1);
    mapB.set(mapB, 1);
    equal(compare(mapA, mapB), true);
    mapB.set(mapB, 2);
    equal(compare(mapA, mapB), false);
    const bytesA = new Uint8Array(69),
      bytesB = new Uint8Array(69);
    equal(compare(bytesA.buffer, bytesB.buffer), true);
    bytesB[68] = 1;
    equal(compare(bytesA.buffer, bytesB.buffer), false);
    equal(compare(new DataView(bytesA.buffer, 1, 4), new DataView(bytesB.buffer, 2, 4)), true);
    equal(
      compare(
        {
          equals: function () {
            return true;
          }
        },
        {
          equals: function () {
            return true;
          }
        }
      ),
      true
    );
    equal(
      compare(
        {
          equals: function () {
            return false;
          }
        },
        {
          equals: function () {
            return true;
          }
        }
      ),
      false
    );
    throws(function () {
      compare(
        {
          equals: function () {
            return 1;
          }
        },
        {}
      );
    }, TypeError);
    const error = new Error('getter');
    throws(
      function () {
        compare(
          {
            get value() {
              throw error;
            }
          },
          { value: 1 }
        );
      },
      function (actual) {
        return actual === error;
      }
    );
    if (typeof BigInt === 'function') {
      equal(compare(BigInt(1), 1), loose);
      equal(compare(Object(BigInt(1)), BigInt(1)), !strict);
      if (typeof BigInt64Array !== 'undefined') {
        equal(compare(new BigInt64Array([BigInt(1)]), new BigInt64Array([BigInt(1)])), true);
      }
    }
    if (typeof SharedArrayBuffer !== 'undefined') {
      equal(compare(new SharedArrayBuffer(3), new SharedArrayBuffer(3)), true);
    }
    for (let bits = 0; bits < 512; bits++) {
      const matrix = Array.from({ length: 3 }, function (_, i) {
        return Array.from({ length: 3 }, function (_, j) {
          return !!(bits & (1 << (i * 3 + j)));
        });
      });
      class Value {
        constructor(side, index) {
          this.side = side;
          this.index = index;
        }
        equals(other) {
          return (
            this.side !== other.side &&
            (this.side === 'left' ? matrix[this.index][other.index] : matrix[other.index][this.index])
          );
        }
      }
      const a = [0, 1, 2].map(function (i) {
        return new Value('left', i);
      });
      const b = [2, 0, 1].map(function (i) {
        return new Value('right', i);
      });
      const expected = perfect(matrix, 0, []);
      equal(compare(new Set(a), new Set(b)), expected, 'matching ' + bits);
      equal(
        compare(
          new Map(
            a.map(function (v) {
              return [v, 0];
            })
          ),
          new Map(
            b.map(function (v) {
              return [v, 0];
            })
          )
        ),
        expected,
        'map matching ' + bits
      );
    }
  });
  equal(
    api.isEqual.custom(1, 1, function () {
      return false;
    }),
    false
  );
  equal(
    api.isEqual.custom(1, 2, function () {
      return true;
    }),
    true
  );
  equal(
    api.isEqual.custom({ a: 'UP' }, { a: 'up' }, function (a, b) {
      return typeof a === 'string' && typeof b === 'string' ? a.toLowerCase() === b.toLowerCase() : undefined;
    }),
    true
  );
  const options = { mode: 'loose' };
  const custom = api.isEqual.create(function () {}, options);
  options.mode = 'strict';
  equal(custom(1, '1'), true);
  const a = { x: 1 },
    b = { x: 1 };
  equal(custom(a, b), true);
  b.x = 2;
  equal(custom(a, b), false);
  throws(function () {
    api.isEqual.create(null);
  }, TypeError);
  throws(function () {
    api.isEqual.custom(1, 1, function () {
      return 'yes';
    });
  }, TypeError);
  throws(function () {
    api.isEqual.create(function () {}, { unknown: true });
  }, TypeError);
}
exercise(require(entry), 'CommonJS');
for (const name of ['go-equality.js', 'go-equality.min.js']) {
  // Resolve advertised package subpaths, including on Node versions without export maps.
  exercise(require(entry + '/dist/' + name), name + ' CommonJS');
  const source = fs.readFileSync(path.join(packageRoot, 'dist', name), 'utf8');
  for (const format of ['global', 'amd']) {
    const sandbox = { Buffer: Buffer };
    let api;
    if (format === 'amd') {
      sandbox.define = function (_, factory) {
        api = factory();
      };
      sandbox.define.amd = {};
    }
    vm.runInNewContext(source, sandbox, { filename: name });
    exercise(format === 'amd' ? api : sandbox.goEquality, name + ' ' + format);
  }
}
console.log(
  JSON.stringify({
    node: process.version,
    checks,
    formats: 7,
    bigint: typeof BigInt === 'function',
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined'
  })
);
