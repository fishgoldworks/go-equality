'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const instrumentExample = require('./helpers/instrumentExample');

test('example assertions survive multiline calls and retain exception checks', () => {
  const example = `compare(
    function () {},
    function () {}
  ); // false
  compare(1, 1); // true
  fail(
    'bad'
  ); // throws TypeError
  `;
  const result = instrumentExample(example);
  assert.equal(result.assertions, 3);
  const context = {
    assert,
    compare: (left, right) => left === right,
    fail: () => {
      throw new TypeError('bad');
    }
  };
  vm.runInNewContext(result.source, context);
  assert.throws(() => vm.runInNewContext(result.source, { ...context, compare: () => true }));
});

test('result annotations cannot silently lose their checked expression', () => {
  assert.throws(() => instrumentExample('// true'), /expression/i);
  const source = 'const message = "// false";';
  assert.deepEqual(instrumentExample(source), { source, assertions: 0 });
});

test('arrow result annotations check values and expected exceptions', () => {
  const result = instrumentExample(
    ['compare(1, 1); // => true', 'compare(1, 2); // => false', 'fail(\n); // => throws TypeError'].join('\n')
  );
  assert.equal(result.assertions, 3);
  const context = {
    assert,
    compare: (left, right) => left === right,
    fail: () => {
      throw new TypeError('bad');
    }
  };
  vm.runInNewContext(result.source, context);
  assert.throws(() => vm.runInNewContext(result.source, { ...context, compare: () => true }));
  assert.throws(() => vm.runInNewContext(result.source, { ...context, fail: () => undefined }));
});

for (const first of [false, true]) {
  for (const last of [false, true]) {
    test(`sequence annotations compare the final value of (${first}, ${last})`, () => {
      const correct = instrumentExample(`(${first}, ${last}); // => ${last}`);
      assert.equal(correct.assertions, 1);
      vm.runInNewContext(correct.source, { assert });
      const incorrect = instrumentExample(`(${first}, ${last}); // => ${!last}`);
      assert.throws(() => vm.runInNewContext(incorrect.source, { assert }), { name: 'AssertionError' });
    });
  }
}

test('instrumentation preserves expression evaluation and surrounding parentheses', () => {
  let calls = 0;
  const context = {
    assert,
    evaluate() {
      calls++;
      return true;
    }
  };
  const result = instrumentExample('((evaluate(), false)); // => false');
  vm.runInNewContext(result.source, context);
  assert.equal(calls, 1);
});

test('inner and outer expression annotations do not overwrite one another', () => {
  const example = `(() => {
    false; // => false
    return true;
  })(); // => true`;
  const correct = instrumentExample(example);
  assert.equal(correct.assertions, 2);
  vm.runInNewContext(correct.source, { assert });
  for (const wrong of [example.replace('=> false', '=> true'), example.replace('=> true', '=> false')]) {
    assert.throws(() => vm.runInNewContext(instrumentExample(wrong).source, { assert }), {
      name: 'AssertionError'
    });
  }
});

test('nested expected-exception expressions retain their enclosing annotated call', () => {
  const example = `(() => {
    fail(); // => throws TypeError
    return false;
  })(); // => false`;
  const result = instrumentExample(example);
  assert.equal(result.assertions, 2);
  vm.runInNewContext(result.source, {
    assert,
    fail() {
      throw new TypeError('intended error');
    }
  });
  assert.throws(() => vm.runInNewContext(result.source, { assert, fail() {} }), { name: 'AssertionError' });
});

for (const annotation of ['=> tru', '=> false (expected)', '=> undefined', '=> throws SyntaxError']) {
  test(`unsupported explicit annotation is rejected rather than ignored: ${annotation}`, () => {
    const example = `true; // => true\nfalse; // ${annotation}`;
    assert.throws(() => instrumentExample(example), /Unsupported result annotation/);
  });
}

test('explanatory comments and annotation-like strings are not result annotations', () => {
  const example = `const note = '// => tru';
    // true in the ordinary case; this is prose, not an annotation.
    note.startsWith('//'); // => true`;
  const result = instrumentExample(example);
  assert.equal(result.assertions, 1);
  vm.runInNewContext(result.source, { assert });
});
