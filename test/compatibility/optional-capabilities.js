'use strict';
// This runner uses ES2017 and plain assertions so it also runs on Node 8.
// Each invocation removes capabilities before the first package import.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const flags = ['hasIndices', 'global', 'ignoreCase', 'multiline', 'dotAll', 'unicode', 'unicodeSets', 'sticky'];
const scenarios = [
  ['native', []],
  ['globalThis', ['globalThis']],
  ['BigInt/null', ['BigInt=null']],
  ['SharedArrayBuffer/null', ['SharedArrayBuffer=null']],
  ...['BigInt', 'BigInt64Array', 'BigUint64Array', 'SharedArrayBuffer', 'Buffer'].map((name) => [name, [name]]),
  ...['BigInt.valueOf', 'SharedArrayBuffer.byteLength', ...flags.map((name) => 'RegExp.' + name)].reduce(
    (all, name) =>
      all.concat([
        [name + '/deleted', [name]],
        [name + '/undefined', [name + '=undefined']]
      ]),
    []
  ),
  ['Buffer.isBuffer', ['Buffer.isBuffer']],
  ['Buffer.equals', ['Buffer.equals']],
  ['optional constructors', ['BigInt', 'BigInt64Array', 'BigUint64Array', 'SharedArrayBuffer', 'Buffer']],
  ['older RegExp capabilities', ['RegExp.hasIndices', 'RegExp.dotAll', 'RegExp.unicodeSets', 'RegExp.syntax']],
  ['optional members', ['BigInt.valueOf', 'SharedArrayBuffer.byteLength', 'RegExp.dotAll', 'Buffer.equals']],
  ['mixed absences', ['BigInt', 'SharedArrayBuffer.byteLength=undefined', 'RegExp.hasIndices=undefined', 'Buffer']]
];

function prepare(scope, removals) {
  const NativeBigInt = scope.BigInt;
  const NativeShared = scope.SharedArrayBuffer;
  const NativeBuffer = scope.Buffer;
  const fixture = {
    bigints: typeof NativeBigInt === 'function' ? [NativeBigInt(1), NativeBigInt(2)] : null,
    shared: typeof NativeShared === 'function' ? [new NativeShared(4), new NativeShared(4), new NativeShared(4)] : null,
    buffers: typeof NativeBuffer === 'function' ? [NativeBuffer.from([1, 2]), NativeBuffer.from([1, 3])] : null,
    bigintArrays: []
  };
  if (fixture.shared) {
    new Uint8Array(fixture.shared[2])[0] = 1;
  }
  for (const name of ['BigInt64Array', 'BigUint64Array']) {
    if (typeof scope[name] === 'function') {
      fixture.bigintArrays.push([
        new scope[name]([NativeBigInt(1)]),
        new scope[name]([NativeBigInt(1)]),
        new scope[name]([NativeBigInt(2)])
      ]);
    }
  }
  if (removals.indexOf('RegExp.syntax') !== -1) {
    // Model the absence of newer flag syntax separately from missing getters.
    // Actual old-engine execution is still required by the consumer gate.
    const NativeRegExp = scope.RegExp;
    scope.RegExp = function RegExp(pattern, flags) {
      if (/[dsv]/.test(flags || '')) {
        throw new SyntaxError('Unsupported flag');
      }
      return new NativeRegExp(pattern, flags);
    };
    scope.RegExp.prototype = NativeRegExp.prototype;
  }
  for (const removal of removals) {
    const parts = removal.split('=');
    const names = parts[0].split('.');
    if (names.length === 1) {
      if (parts[1] === 'null') {
        scope[names[0]] = null;
      } else {
        delete scope[names[0]];
      }
    } else if (typeof scope[names[0]] === 'function') {
      const owner = names[1] === 'isBuffer' ? scope[names[0]] : scope[names[0]].prototype;
      if (parts.length === 2) {
        Object.defineProperty(owner, names[1], { value: undefined, configurable: true });
      } else {
        delete owner[names[1]];
      }
    }
  }
  fixture.bigintAvailable = !removals.some(
    (name) => name.split('=')[0] === 'BigInt' || name.indexOf('BigInt.valueOf') === 0
  );
  fixture.sharedAvailable = !removals.some(
    (name) => name.split('=')[0] === 'SharedArrayBuffer' || name.indexOf('SharedArrayBuffer.byteLength') === 0
  );
  fixture.regexpUnavailable = false;
  for (const pair of [
    ['hasIndices', 'd'],
    ['global', 'g'],
    ['ignoreCase', 'i'],
    ['multiline', 'm'],
    ['dotAll', 's'],
    ['unicode', 'u'],
    ['unicodeSets', 'v'],
    ['sticky', 'y']
  ]) {
    if (!removals.some((name) => name.split('=')[0] === 'RegExp.' + pair[0])) {
      continue;
    }
    try {
      new RegExp('item', pair[1]);
      fixture.regexpUnavailable = true;
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        throw error;
      }
    }
  }
  return fixture;
}

function exercise(api, fixture, assertion) {
  let checks = 0;
  function equal(actual, expected, label) {
    checks++;
    assertion.strictEqual(actual, expected, label);
  }
  function throws(fn, matches) {
    checks++;
    assertion.throws(fn, matches);
  }
  equal(api.isEqual.strict, api.isStrictEqual, 'strict alias identity');
  equal(api.isEqual.loose, api.isLooseEqual, 'loose alias identity');
  const routes = [
    ['default', api.isEqual],
    ['strict', api.isStrictEqual],
    ['loose', api.isLooseEqual]
  ];
  for (const mode of ['default', 'strict', 'loose']) {
    routes.push([mode, (a, b) => api.isEqual.custom(a, b, () => undefined, { mode })]);
    routes.push([mode, api.isEqual.create(() => undefined, { mode })]);
  }
  for (const route of routes) {
    const mode = route[0];
    const compare = route[1];
    const left = { value: 1 };
    const right = { value: 1 };
    left.self = left;
    right.self = right;
    equal(compare(left, right), true, 'cyclic objects');
    right.value = 2;
    equal(compare(left, right), false, 'changed cyclic objects');
    equal(compare(1, '1'), mode === 'loose', 'primitive coercion');
    equal(compare(1, Object(1)), mode !== 'strict', 'ordinary wrapper unboxing');
    equal(compare(new Set([{ id: 1 }]), new Set([{ id: 1 }])), true, 'structural Set matching');
    equal(compare(new Map([[{ id: 1 }, 1]]), new Map([[{ id: 1 }, 2]])), false, 'Map payload');
    equal(compare(new Uint8Array([1]), new Uint8Array([2])), false, 'byte arrays');
    equal(compare(new ArrayBuffer(65), new ArrayBuffer(65)), true, 'aligned bytes and remainder');
    equal(compare(new DataView(new ArrayBuffer(4)), new DataView(new ArrayBuffer(4))), true, 'DataView');
    for (const tag of ['BigInt', 'SharedArrayBuffer']) {
      let calls = 0;
      const spoof = {
        [Symbol.toStringTag]: tag,
        valueOf() {
          calls++;
          return 1;
        }
      };
      equal(compare(spoof, 1), false, 'a tag cannot enable object coercion');
      equal(calls, 0, 'no application valueOf calls');
    }
    if (fixture.bigints) {
      const one = fixture.bigints[0];
      const box = Object(one);
      equal(compare(one, one), true, 'bigint primitive identity');
      equal(compare(one, fixture.bigints[1]), false, 'different bigint primitives');
      equal(compare(box, box), true, 'boxed bigint identity');
      equal(compare(box, one), fixture.bigintAvailable && mode !== 'strict', 'conditional unboxing');
      equal(compare(box, Object(one)), fixture.bigintAvailable, 'boxed bigint payload or opaque fallback');
      const tagged = Object.defineProperty(Object(one), Symbol.toStringTag, { value: 'Hidden' });
      equal(
        compare(tagged, Object.defineProperty(Object(one), Symbol.toStringTag, { value: 'Hidden' })),
        fixture.bigintAvailable,
        'hidden bigint brand'
      );
    }
    for (const arrays of fixture.bigintArrays) {
      equal(compare(arrays[0], arrays[1]), true, 'bigint arrays do not depend on global constructor names');
      equal(compare(arrays[0], arrays[2]), false, 'different bigint elements');
    }
    if (fixture.shared) {
      equal(compare(fixture.shared[0], fixture.shared[0]), true, 'shared-buffer identity');
      equal(
        compare(fixture.shared[0], fixture.shared[1]),
        fixture.sharedAvailable,
        'shared payload or opaque fallback'
      );
      equal(compare(fixture.shared[0], fixture.shared[2]), false, 'different shared payload');
    }
    // No host Buffer comparison without its trusted constructor: that is a documented limitation.
    if (fixture.buffers && typeof Buffer === 'function') {
      equal(compare(fixture.buffers[0], Buffer.from([1, 2])), true, 'Buffer payload');
      equal(compare(fixture.buffers[0], fixture.buffers[1]), false, 'different Buffer payload');
    }
    const expression = /item/g;
    equal(compare(expression, expression), true, 'RegExp identity precedes unavailable introspection');
    equal(compare(/item/, {}), false, 'different native kinds');
    equal(compare(/item/, /other/), false, 'different sources decide equality without flags');
    if (fixture.regexpUnavailable) {
      throws(
        () => compare(/item/, /item/),
        (error) => /RegExp.*flag.*unavailable/i.test(error.message)
      );
    } else {
      equal(compare(/item/gi, /item/gi), true, 'native RegExp flags');
      equal(compare(/item/g, /item/i), false, 'different flags');
    }
    const first = /item/;
    const second = /item/;
    first.equals = second.equals = () => true;
    equal(compare(first, second), true, 'application hooks precede native payload checks');
    const sentinel = new Error('getter failure');
    throws(
      () =>
        compare(
          {
            get value() {
              throw sentinel;
            }
          },
          { value: 1 }
        ),
      (error) => error === sentinel
    );
  }
  for (const original of [fixture.bigints && Object(fixture.bigints[0]), fixture.shared && fixture.shared[0], /item/]) {
    if (!original) {
      continue;
    }
    let calls = 0;
    equal(
      api.isEqual.custom(original, original, function (left, right) {
        calls++;
        equal(this, undefined, 'callback receiver');
        equal(left, original, 'original left input');
        equal(right, original, 'original right input');
        return false;
      }),
      false,
      'custom callback can veto identity'
    );
    equal(calls, 1, 'one callback for the root');
    equal(api.isEqual.create(() => true)(original, {}), true, 'custom override before optional introspection');
  }
  throws(
    () => api.isEqual.create(null),
    (error) => error.name === 'TypeError'
  );
  throws(
    () => api.isEqual.create(() => undefined, { unknown: true }),
    (error) => error.name === 'TypeError'
  );
  throws(
    () => api.isEqual.custom(1, 1, () => 'invalid'),
    (error) => error.name === 'TypeError'
  );
  const sentinel = new Error('callback failure');
  throws(
    () =>
      api.isEqual.custom(1, 1, () => {
        throw sentinel;
      }),
    (error) => error === sentinel
  );
  return checks;
}

function run(entry, format, scenario, focus) {
  const removals = scenario[1];
  if (format === 'commonjs') {
    const fixture = prepare(global, removals);
    const focused = focus ? require(path.join(path.dirname(require.resolve(entry)), 'src', focus + '.js')) : null;
    const api = require(entry);
    if (focus) {
      assert.strictEqual(focused, api[focus], 'Focused source import retains public function identity');
    }
    return exercise(api, fixture, assert);
  }
  const sandbox = { assert, Buffer: require('buffer').Buffer };
  const context = vm.createContext(sandbox);
  sandbox.fixture = vm.runInContext(
    "'use strict';\n(" + prepare.toString() + ')(this, ' + JSON.stringify(removals) + ')',
    context
  );
  if (format === 'amd') {
    sandbox.define = (_dependencies, factory) => {
      sandbox.api = factory();
    };
    sandbox.define.amd = {};
  } else if (format !== 'global') {
    throw new Error('Unknown format: ' + format);
  }
  vm.runInContext(fs.readFileSync(entry, 'utf8'), context, { filename: entry });
  if (format === 'global') {
    sandbox.api = sandbox.Equality;
  }
  return vm.runInContext("'use strict';\n(" + exercise.toString() + ')(api, fixture, assert)', context);
}

module.exports = { scenarios, prepare, exercise };
if (require.main === module) {
  const scenario = scenarios.find((item) => item[0] === process.argv[4]);
  assert.ok(scenario, 'Unknown absence scenario');
  const entry = process.argv[2] === 'go-equality' ? process.argv[2] : path.resolve(process.argv[2]);
  const checks = run(entry, process.argv[3], scenario, process.argv[5]);
  console.log(JSON.stringify({ scenario: scenario[0], checks }));
}
