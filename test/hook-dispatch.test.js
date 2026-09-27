'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const api = require('./helpers/api');
const fallback = () => undefined;
const routes = [
  ['isEqual', api.isEqual],
  ['isLooseEqual', api.isLooseEqual],
  ['isStrictEqual', api.isStrictEqual],
  ...['default', 'strict', 'loose'].flatMap(mode => [
    ['custom/' + mode, (a,b) => api.isEqual.custom(a,b,fallback,{mode})],
    ['create/' + mode, api.isEqual.create(fallback,{mode})]
  ])
];
function entities(equals, rightId = 2) {
  class Entity { constructor(id) { this.id = id; } }
  Entity.prototype.equals = equals;
  return [new Entity(1), new Entity(rightId)];
}
for (const [name, compare] of routes) {
  test(name + ': hook own .call must not replace its decision', () => {
    function equals(other) { return this.id === other.id; }
    equals.call = () => true;
    const [a,b] = entities(equals);
    assert.equal(a.equals(b), false);
    assert.equal(compare(a,b), false);
  });
  test(name + ': callable hook with null .call must still be callable', () => {
    function equals(other) { return this.id === other.id; }
    equals.call = null;
    const [a,b] = entities(equals,1);
    assert.equal(a.equals(b), true);
    assert.equal(compare(a,b), true);
  });
  test(name + ': reading an unrelated .call accessor is unnecessary', () => {
    function equals(other) { return this.id === other.id; }
    Object.defineProperty(equals,'call',{get(){throw new Error('unrelated property read');}});
    const [a,b] = entities(equals,1);
    assert.equal(compare(a,b),true);
  });
  test(name + ': own .call must not suppress an exception from the actual hook', () => {
    const error = new Error('actual hook failed');
    function equals() { throw error; }
    equals.call = () => true;
    const [a,b] = entities(equals);
    assert.throws(() => compare(a,b), e => e === error);
  });
  test(name + ': own .call must not hide an invalid hook return', () => {
    function equals() { return 'yes'; }
    equals.call = () => true;
    const [a,b] = entities(equals);
    assert.throws(() => compare(a,b), {name:'TypeError'});
  });
}
test('control: caller customizer ignores its own .call field', () => {
  function customizer(a,b) { return a === b; }
  customizer.call = null;
  assert.equal(api.isEqual.custom(1,1,customizer),true);
  assert.equal(api.isEqual.custom(1,2,customizer),false);
});

for (const [name, compare] of routes) {
  test(name + ': a function with null prototype still acts as an equality hook', () => {
    function equals(other) { return this.id === other.id; }
    Object.setPrototypeOf(equals, null);
    const [a, b] = entities(equals, 1);
    const [, different] = entities(equals, 2);
    assert.equal(compare(a, b), true);
    assert.equal(compare(b, a), true);
    assert.equal(compare(a, different), false);
  });
  test(name + ': callable proxy hook does not access a call property', () => {
    const equals = new Proxy(function (other) { return this.id === other.id; }, {
      get(target, key, receiver) {
        if (key === 'call') throw new Error('must invoke the function, not read .call');
        return Reflect.get(target, key, receiver);
      },
    });
    const [a, b] = entities(equals, 1);
    assert.equal(compare(a, b), true);
    assert.equal(compare(b, a), true);
  });
}

for (const [name, compare] of routes) {
  test(name + ': the right-hand hook also cannot hide its veto', () => {
    const left = { equals() { return true; } };
    function reject() { return false; }
    reject.call = () => true;
    const right = { equals: reject };
    assert.equal(compare(left, right), false);
    assert.equal(compare(right, left), false);
  });
}
