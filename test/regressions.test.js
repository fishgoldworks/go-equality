'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const api = require('./helpers/api');
const cases = [
  ['repeated references with unequal leaves', () => { const a={v:1},b={v:2};return [[a,b,a],[a,b,b]]; }, false],
  ['separate graphs with repeated references', () => { const a={v:1},b={v:2},c={v:1},d={v:2};return [[a,b,a],[c,d,d]]; }, false],
  ['set cannot reuse identity candidate', () => { const s={id:1};return [new Set([s,{id:1}]),new Set([s,{id:2}])]; }, false],
  ['map cannot reuse identity candidate', () => { const s={id:1};return [new Map([[s,0],[{id:1},0]]),new Map([[s,0],[{id:2},0]])]; }, false],
  ['set cannot reuse NaN candidate', () => [new Set([Object(NaN),Object(NaN)]),new Set([NaN,undefined])], false],
  ['map cannot reuse NaN key', () => [new Map([[Object(NaN),0],[Object(NaN),0]]),new Map([[NaN,0],[undefined,0]])], false],
  ['set permutation', () => [new Set([{v:1},{v:2},{v:3}]),new Set([{v:3},{v:2},{v:1}])], true],
  ['map permutation', () => [new Map([[{v:1},0],[{v:2},0],[{v:3},0]]),new Map([[{v:3},0],[{v:2},0],[{v:1},0]])], true],
  ['map matches complete entries', () => [new Map([[{id:1},'a'],[{id:1},'b']]),new Map([[{id:1},'b'],[{id:1},'a']])], true],
  ['self-containing sets', () => { const a=new Set(),b=new Set();a.add(a);b.add(b);return [a,b]; }, true],
  ['self-keyed maps', () => { const a=new Map(),b=new Map();a.set(a,a);b.set(b,b);return [a,b]; }, true],
  ['self-containing sets with unequal leaves', () => { const a=new Set([1]),b=new Set([2]);a.add(a);b.add(b);return [a,b]; }, false],
  ['custom instances', () => { class Point { constructor(x){this.x=x;} }return [new Point(1),new Point(1)]; }, true],
  ['bilateral equals accepts distinct fields', () => { class X{constructor(v){this.v=v;}equals(){return true;}}return [new X(1),new X(2)]; }, true],
  ['custom equals veto', () => { const equals=()=>false;return [{v:1,equals},{v:1,equals}]; }, false],
  ['non-enumerable value mismatch', () => [Object.defineProperty({},'x',{value:1}),Object.defineProperty({},'x',{value:2})], false],
  ['own symbol value mismatch', () => { const k=Symbol('k');return [{[k]:1},{[k]:2}]; }, false],
  ['null-prototype dictionaries', () => [Object.assign(Object.create(null),{v:1}),Object.assign(Object.create(null),{v:1})], true],
  ['float NaN elements', () => [new Float64Array([NaN]),new Float64Array([NaN])], true],
  ['date payload mismatch', () => [new Date(0),new Date(1)], false],
  ['set payload mismatch', () => [new Set([1]),new Set([2])], false],
  ['map payload mismatch', () => [new Map([['a',1]]),new Map([['a',2]])], false],
  ['sparse hole is not explicit undefined', () => [Array(1),[undefined]], false],
  ['array extra property mismatch', () => [Object.assign([1],{meta:1}),Object.assign([1],{meta:2})], false],
  ['builtin extra property mismatch', () => [Object.assign(new Date(0),{meta:1}),Object.assign(new Date(0),{meta:2})], false],
  ['RegExp lastIndex mismatch', () => {const a=/a/g,b=/a/g;b.lastIndex=1;return [a,b];}, false],
  ['shared reference topology is not required', () => {const x={v:1};return [[x,x],[{v:1},{v:1}]];}, true],
];
for(const [name,compare] of Object.entries(api)) {
  for(const [label,make,expected] of cases) test(name+': '+label,()=>{
    const [a,b]=make();assert.equal(compare(a,b),expected,'forward');assert.equal(compare(b,a),expected,'reverse');
  });
  test(name+': invalidated cyclic assumption propagates to all dependants',()=>{
    const a={v:1},b={v:2};a.next={parent:a};b.next={parent:b};
    assert.equal(compare(new Set([a,a.next]),new Set([b.next,b])),false);
  });
  test(name+': deep chain does not overflow the call stack',()=>{
    let a={v:1},b={v:1};for(let i=0;i<12000;i++){a={next:a};b={next:b};}
    assert.equal(compare(a,b),true);
    let p=b;while(p.next)p=p.next;p.v=2;assert.equal(compare(a,b),false);
  });
  test(name+': augmenting paths repair ambiguous custom matches',()=>{
    const links={a:['x','y'],b:['x'],x:['a','b'],y:['a']};
    class V{constructor(id){this.id=id;}equals(other){return !!links[this.id]?.includes(other.id);}}
    const a=new Set([new V('a'),new V('b')]),b=new Set([new V('x'),new V('y')]);
    assert.equal(compare(a,b),true);assert.equal(compare(b,a),true);
  });
}
test('loose mode repairs ambiguous primitive assignment',()=>{
  assert.equal(api.isLooseEqual(new Set([0,'']),new Set(['','0'])),true);
  assert.equal(api.isLooseEqual(new Set(['','0']),new Set([0,''])),true);
});
test('loose mode normalizes both wrappers',()=>assert.equal(api.isLooseEqual(Object(1),Object('1')),true));
test('loose mode ignores ordinary constructors',()=>{
  class A{constructor(){this.v=1;}}class B{constructor(){this.v='1';}}
  assert.equal(api.isLooseEqual(new A(),new B()),true);
});
