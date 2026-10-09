'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isEqual } = require('./helpers/api');

// These routes compare the same contracts without prescribing callback order,
// traversal counts or internal graph representation.
const routes = [
  ['custom', (rule, options) => (left, right) => isEqual.custom(left, right, rule, options)],
  ['create', (rule, options) => isEqual.create(rule, options)]
];
const delegate = () => undefined;
const throwsType = (run) => assert.throws(run, { name: 'TypeError' });

function throwsExactly(run, expected) {
  let caught = false;
  try {
    run();
  } catch (error) {
    caught = true;
    assert.equal(error, expected);
  }
  assert.equal(caught, true, 'the original thrown value must escape');
}

function uninspectable() {
  return new Proxy(
    {},
    {
      get() {
        assert.fail('comparison input was inspected before configuration was rejected');
      },
      ownKeys() {
        assert.fail('comparison input was enumerated before configuration was rejected');
      },
      getPrototypeOf() {
        assert.fail('comparison input prototype was inspected before configuration was rejected');
      }
    }
  );
}

for (const [name, configure] of routes) {
  test(name + ': unknown non-enumerable and symbol options reject before input or callback work', () => {
    const left = uninspectable();
    const right = uninspectable();
    for (const key of ['unknown', Symbol('mode'), Symbol('unknown')]) {
      const options = Object.defineProperty({ mode: 'strict' }, key, { value: 'loose' });
      const callback = () => assert.fail('invalid options must not execute the callback');
      throwsType(() => configure(callback, options)(left, right));
    }
    const invalidModes = [
      Object('strict'),
      {
        [Symbol.toPrimitive]() {
          assert.fail('mode coercion');
        }
      }
    ];
    for (const mode of invalidModes) {
      throwsType(() => configure(delegate, { mode })(left, right));
    }
  });

  test(name + ': inherited getters are ignored and non-enumerable own modes are honoured', () => {
    const prototype = {};
    for (const key of ['mode', 'unknown', Symbol('mode')]) {
      Object.defineProperty(prototype, key, {
        get() {
          return assert.fail('inherited option read');
        }
      });
    }
    const options = Object.create(prototype);
    const defaultCompare = configure(delegate, options);
    assert.equal(defaultCompare(1, '1'), false);
    assert.equal(defaultCompare(1, Object(1)), true);
    const own = Object.defineProperty(Object.create(prototype), 'mode', { value: 'loose' });
    assert.equal(configure(delegate, own)(1, '1'), true);
  });

  test(name + ': option reflection exceptions propagate before comparing inputs', () => {
    const left = uninspectable();
    const right = uninspectable();
    for (const trap of ['ownKeys', 'getOwnPropertyDescriptor', 'get']) {
      for (const failure of [undefined, 0, new Error('option ' + trap)]) {
        const options = new Proxy(
          { mode: 'strict' },
          {
            [trap]() {
              throw failure;
            }
          }
        );
        const callback = () => assert.fail('callback ran after a configuration exception');
        throwsExactly(() => configure(callback, options)(left, right), failure);
      }
    }
  });

  test(name + ': the callback receives original nested values without reading call or apply', () => {
    const left = Object(1);
    const right = Object(2);
    const key = Symbol('entry');
    const containers = [
      (value) => value,
      (value) => [value],
      (value) => Object.defineProperty({}, 'hidden', { value }),
      (value) => ({ [key]: value }),
      (value) => new Map([[value, 'entry']]),
      (value) => new Map([['entry', value]]),
      (value) => new Set([value])
    ];
    for (const wrap of containers) {
      let observedOriginals = false;
      function rule(a, b) {
        assert.equal(this, undefined);
        assert.equal(arguments.length, 2);
        if (a === left && b === right) {
          observedOriginals = true;
          return true;
        }
        return undefined;
      }
      for (const property of ['call', 'apply', 'bind']) {
        Object.defineProperty(rule, property, {
          get() {
            return assert.fail('callback property read');
          }
        });
      }
      assert.equal(configure(rule)(wrap(left), wrap(right)), true);
      assert.equal(observedOriginals, true);
    }
  });

  test(name + ': calling the comparator as an object method does not bind the callback', () => {
    const seen = [];
    const callback = new Proxy(
      function (a, b) {
        return a === b;
      },
      {
        get() {
          assert.fail('callable proxy was inspected rather than invoked');
        },
        apply(target, receiver, args) {
          seen.push(receiver);
          return Reflect.apply(target, receiver, args);
        }
      }
    );
    const holder = { compare: configure(callback) };
    assert.equal(holder.compare(1, 1), true);
    assert.equal(holder.compare(1, 2), false);
    assert.ok(seen.length > 0, 'the callable proxy must have been invoked');
    for (const receiver of seen) {
      assert.equal(receiver, undefined);
    }

    function explicitlyBound(a, b) {
      return this.tolerant ? String(a) === String(b) : a === b;
    }
    const bound = configure(explicitlyBound.bind({ tolerant: true }));
    assert.equal(bound(1, '1'), true);
    assert.equal(bound(1, '2'), false);
  });

  test(name + ': invalid result objects are rejected without thenable or iterator inspection', () => {
    let advanced = false;
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const outputs = [
      new Proxy(
        {},
        {
          get() {
            assert.fail('invalid result property was read');
          }
        }
      ),
      revoked.proxy,
      Object.defineProperty({}, 'then', {
        get() {
          return assert.fail('thenable was read');
        }
      }),
      (function* () {
        advanced = true;
        yield true;
      })(),
      Promise.resolve(true)
    ];
    for (const output of outputs) {
      throwsType(() => configure(() => output)({ value: 1 }, { value: 1 }));
    }
    assert.equal(advanced, false);
  });

  test(name + ': generator and async callbacks are not converted into synchronous decisions', () => {
    let generatorStarted = false;
    function* generator() {
      generatorStarted = true;
      yield true;
    }
    throwsType(() => configure(generator)(1, 1));
    assert.equal(generatorStarted, false);
    async function asynchronous() {
      return await Promise.resolve(true);
    }
    throwsType(() => configure(asynchronous)(1, 1));
  });

  test(name + ': nested callback errors preserve thrown values and do not poison later comparisons', () => {
    const failures = [undefined, null, false, 0, '', Symbol('failure'), new Error('callback failure')];
    const left = { branch: { data: 'same' }, interrupt: { marker: 'interrupt' } };
    const right = { branch: { data: 'same' }, interrupt: { marker: 'interrupt' } };
    left.self = left;
    right.self = right;
    let throwNow = false;
    let failure;
    const compare = configure((a, b) => {
      if (a === left.interrupt && b === right.interrupt && throwNow) {
        throw failure;
      }
      return undefined;
    });
    for (failure of failures) {
      throwNow = true;
      throwsExactly(() => compare(left, right), failure);
      throwNow = false;
      assert.equal(compare(left, right), true);
      right.branch.data = 'changed';
      assert.equal(compare(left, right), false);
      right.branch.data = 'same';
      assert.equal(compare(left, right), true);
    }
  });

  test(name + ': nested invalid callback results leave no successful cached answer behind', () => {
    const childA = { marker: 'child' };
    const childB = { marker: 'child' };
    const a = { child: childA };
    const b = { child: childB };
    a.self = a;
    b.self = b;
    let result;
    const compare = configure((left, right) => (left === childA && right === childB ? result : undefined));
    assert.equal(compare(a, b), true);
    result = 'invalid';
    throwsType(() => compare(a, b));
    result = false;
    assert.equal(compare(a, b), false);
    result = true;
    assert.equal(compare(a, b), true);
    result = undefined;
    childB.extra = 1;
    assert.equal(compare(a, b), false);
  });
}

for (const mode of ['default', 'strict', 'loose']) {
  for (const [name, configure] of routes) {
    test(name + ' ' + mode + ': reentrant use of the same comparator preserves outer work', () => {
      const user = { kind: 'user', id: 1, label: 'old' };
      const refreshed = { kind: 'user', id: '1', label: 'new' };
      const other = { kind: 'user', id: 2, label: 'other' };
      const compare = configure(
        (a, b) => {
          if (a && b && a.kind === 'user' && b.kind === 'user') {
            // The same configured comparator, not a standalone mode function.
            return compare({ id: a.id }, { id: b.id });
          }
          return undefined;
        },
        { mode }
      );
      assert.equal(compare({ selected: user }, { selected: refreshed }), mode === 'loose');
      assert.equal(compare({ selected: user }, { selected: other }), false);
      const equivalent = { ...user, label: 'updated' };
      const a = { selected: user, status: 'open' };
      const b = { selected: equivalent, status: 'closed' };
      assert.equal(compare(a, b), false, 'the custom decision must not settle the whole outer record');
      b.status = 'open';
      assert.equal(compare(a, b), true);
    });

    test(name + ' ' + mode + ': a caught reentrant failure does not replace outer comparison state', () => {
      const triggerA = {};
      const triggerB = {};
      const failureA = {};
      const failureB = {};
      const failure = new Error('inner invocation');
      const compare = configure(
        (a, b) => {
          if (a === failureA && b === failureB) {
            throw failure;
          }
          if (a === triggerA && b === triggerB) {
            throwsExactly(() => compare({ child: failureA }, { child: failureB }), failure);
            return true;
          }
          return undefined;
        },
        { mode }
      );
      const a = { nested: { value: 1 }, trigger: triggerA };
      const b = { nested: { value: 2 }, trigger: triggerB };
      assert.equal(compare(a, b), false);
      b.nested.value = 1;
      assert.equal(compare(a, b), true);
    });
  }
}

test('create: revoked options cannot be revisited and a callback closure remains live', () => {
  let reads = 0;
  let customAnswer;
  let calls = 0;
  const options = Proxy.revocable(
    {
      get mode() {
        reads++;
        return 'loose';
      }
    },
    {}
  );
  const compare = isEqual.create(() => {
    calls++;
    return customAnswer;
  }, options.proxy);
  assert.equal(reads, 1);
  assert.equal(calls, 0, 'factory configuration must not probe the callback');
  options.revoke();
  assert.equal(compare({ quantity: 1 }, { quantity: '1' }), true);
  customAnswer = false;
  assert.equal(compare(1, 1), false);
  customAnswer = undefined;
  assert.equal(compare({ quantity: 1 }, { quantity: '1' }), true);
  assert.equal(reads, 1);
});

test('create: two factories keep separate modes and observe input changes between calls', () => {
  const options = { mode: 'strict' };
  const strict = isEqual.create(delegate, options);
  options.mode = 'loose';
  const loose = isEqual.create(delegate, options);
  const a = new Map([['item', { value: 1 }]]);
  const b = new Map([['item', { value: '1' }]]);
  assert.equal(strict(a, b), false);
  assert.equal(loose(a, b), true);
  b.get('item').value = 2;
  assert.equal(loose(a, b), false);
  b.get('item').value = 1;
  assert.equal(strict(a, b), true);
  assert.equal(loose(a, b), true);
});

test('create: a revoked callback fails on invocation rather than during factory creation', () => {
  const revocable = Proxy.revocable(delegate, {});
  revocable.revoke();
  const compare = isEqual.create(revocable.proxy);
  assert.equal(typeof compare, 'function');
  throwsType(() => compare({}, {}));
  const fromClass = isEqual.create(class NotCallableWithoutNew {});
  throwsType(() => fromClass(1, 1));
});
