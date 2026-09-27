'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const api = require('./helpers/api');
const all = Object.entries(api);
const sharedSymbol = Symbol('shared');
const primitiveCases = [
  ['undefined',undefined,undefined,[true,true,true]],
  ['null',null,null,[true,true,true]],
  ['null versus undefined',null,undefined,[false,true,false]],
  ['NaN',NaN,NaN,[true,true,true]],
  ['NaN versus string',NaN,'NaN',[false,false,false]],
  ['infinities',Infinity,-Infinity,[false,false,false]],
  ['positive infinity',Infinity,Infinity,[true,true,true]],
  ['signed zero',-0,+0,[true,true,true]],
  ['number and numeric string',1,'1',[false,true,false]],
  ['number and boolean',1,true,[false,true,false]],
  ['bigint and number',1n,1,[false,true,false]],
  ['bigint and string',1n,'1',[false,true,false]],
  ['bigint and fractional string',1n,'1.5',[false,false,false]],
  ['bigint and fractional number',1n,1.5,[false,false,false]],
  ['bigint and nonfinite number',1n,Infinity,[false,false,false]],
  ['bigint above safe integer',9007199254740993n,9007199254740992,[false,false,false]],
  ['bigint distinct',2n,3n,[false,false,false]],
  ['empty string and zero','',0,[false,true,false]],
  ['whitespace and zero',' ',0,[false,true,false]],
  ['empty and whitespace strings','',' ',[false,false,false]],
  ['boolean and named string',true,'true',[false,false,false]],
  ['false and undefined',false,undefined,[false,false,false]],
  ['same symbol',sharedSymbol,sharedSymbol,[true,true,true]],
  ['different symbols',Symbol('x'),Symbol('x'),[false,false,false]],
  ['global symbols',Symbol.for('x'),Symbol.for('x'),[true,true,true]],
  ['symbol and string',sharedSymbol,'shared',[false,false,false]],
];
for (const [label,a,b,expected] of primitiveCases) {
  all.forEach(([name,compare],index)=>test(name+': primitives '+label,()=>{
    assert.equal(compare(a,b),expected[index]);assert.equal(compare(b,a),expected[index]);
  }));
}
const wrappers=[['number',1],['NaN',NaN],['string','abc'],['boolean',false],['bigint',1n],['symbol',sharedSymbol]];
for(const [label,value] of wrappers) {
  all.forEach(([name,compare],index)=>{
    test(name+': wrapper '+label+' versus primitive',()=>{
      assert.equal(compare(Object(value),value),index!==2);assert.equal(compare(value,Object(value)),index!==2);
    });
    test(name+': wrapper '+label+' versus same payload',()=>assert.equal(compare(Object(value),Object(value)),true));
    test(name+': wrapper '+label+' own properties policy',()=>assert.equal(
      compare(Object.assign(Object(value),{extra:1}),Object.assign(Object(value),{extra:2})),index!==2));
  });
}
for(const [name,compare] of all) {
  const check=(label,make,expected)=>test(name+': '+label,()=>{const [a,b]=make();assert.equal(compare(a,b),expected);assert.equal(compare(b,a),expected);});
  check('different function identities',()=>[function f(){},function f(){}],false);
  check('same function identity',()=>{const f=()=>1;return [f,f];},true);
  check('function hooks do not replace identity',()=>{const a=()=>0,b=()=>0;a.equals=b.equals=()=>true;return [a,b];},false);
  check('no array-to-primitive coercion',()=>[[],0],false);
  check('no ordinary object-to-primitive coercion',()=>[{valueOf(){return 1;}},1],false);
  check('no date-to-string coercion',()=>[new Date(0),new Date(0).toString()],false);
  check('property order ignored',()=>[{a:1,b:2},{b:2,a:1}],true);
  check('missing property not undefined',()=>[{}, {a:undefined}],false);
  check('non-enumerable equal',()=>[Object.defineProperty({},'x',{value:1}),Object.defineProperty({},'x',{value:1})],true);
  check('descriptor flags ignored',()=>[Object.defineProperty({},'x',{value:1}),{x:1}],true);
  check('different own symbol keys',()=>[{[Symbol('x')]:1},{[Symbol('x')]:1}],false);
  check('non-enumerable symbols',()=>{const k=Symbol();return [Object.defineProperty({},k,{value:1}),Object.defineProperty({},k,{value:2})];},false);
  check('inherited values ignored with same constructor',()=>[Object.create({v:1}),Object.create({v:2})],true);
  check('inherited key does not satisfy own key',()=>[Object.assign(Object.create({a:1}),{b:2}),{a:1}],false);
  check('shadowed hasOwnProperty',()=>[{hasOwnProperty:1},{hasOwnProperty:1}],true);
  check('safe __proto__ own data',()=>[JSON.parse('{"__proto__":1}'),JSON.parse('{"__proto__":2}')],false);
  check('ordinary accessors compare retrieved values',()=>[{get x(){return 1;}},{x:1}],true);
  check('frozen values',()=>[Object.freeze({x:1}),Object.freeze({x:1})],true);
  check('sparse equal arrays',()=>[Array(4),Array(4)],true);
  check('sparse length mismatch',()=>[Array(4),Array(5)],false);
  check('extra non-index array keys',()=>[Object.assign([1],{'01':1}),Object.assign([1],{'01':2})],false);
  check('array symbol keys',()=>{const k=Symbol();return [Object.assign([1],{[k]:1}),Object.assign([1],{[k]:2})];},false);
  check('array versus arguments remains different',()=>[[1],(function(){return arguments;})(1)],false);
  check('strict arguments bookkeeping ignored',()=>{function args(){return arguments;}return [args(1),args(1)];},true);
  check('arguments extra own properties',()=>{function args(){return arguments;}return [Object.assign(args(1),{x:1}),Object.assign(args(1),{x:2})];},false);
  check('invalid dates equal',()=>[new Date(NaN),new Date(NaN)],true);
  check('valid and invalid dates differ',()=>[new Date(0),new Date(NaN)],false);
  check('RegExp flags differ',()=>[/a/g,/a/i],false);
  check('RegExp source differs',()=>[/a/,/b/],false);
  check('RegExp equal lastIndex',()=>{const a=/a/g,b=/a/g;a.lastIndex=b.lastIndex=2;return [a,b];},true);
  check('empty maps',()=>[new Map(),new Map()],true);
  check('empty sets',()=>[new Set(),new Set()],true);
  check('Map versus Set',()=>[new Map(),new Set()],false);
  check('Map iteration override is not used',()=>{const fn=()=>{throw Error('override');};return [Object.assign(new Map([[1,2]]),{entries:fn}),Object.assign(new Map([[1,2]]),{entries:fn})];},true);
  check('empty ArrayBuffers',()=>[new ArrayBuffer(0),new ArrayBuffer(0)],true);
  check('ArrayBuffer equal bytes',()=>[Uint8Array.of(1,2).buffer,Uint8Array.of(1,2).buffer],true);
  check('ArrayBuffer differing byte',()=>[Uint8Array.of(1,2).buffer,Uint8Array.of(1,3).buffer],false);
  check('DataViews compare view window not offset',()=>[new DataView(Uint8Array.of(9,1,2,8).buffer,1,2),new DataView(Uint8Array.of(1,2).buffer)],true);
  check('DataViews ignore outside bytes',()=>[new DataView(Uint8Array.of(9,1).buffer,1,1),new DataView(Uint8Array.of(8,1).buffer,1,1)],true);
  check('DataViews differing window',()=>[new DataView(Uint8Array.of(1,2).buffer,0,1),new DataView(Uint8Array.of(1,2).buffer,1,1)],false);
  check('DataViews empty windows',()=>[new DataView(new ArrayBuffer(4),2,0),new DataView(new ArrayBuffer(0))],true);
  check('typed array signed zero numerical semantics',()=>[new Float64Array([-0]),new Float64Array([+0])],true);
  check('binary buffers preserve signed zero bit pattern',()=>[new Float64Array([-0]).buffer,new Float64Array([+0]).buffer],false);
  check('typed array subclasses',()=>{class V extends Uint8Array{}return [new V([1]),new V([1])];},true);
  check('typed array extras',()=>[Object.assign(new Uint8Array([1]),{x:1}),Object.assign(new Uint8Array([1]),{x:2})],false);
  check('typed array noncanonical number key is own state',()=>[Object.assign(new Uint8Array([1]),{'01':1}),Object.assign(new Uint8Array([1]),{'01':2})],false);
  check('typed array symbols',()=>{const k=Symbol();return [Object.assign(new Uint8Array([1]),{[k]:1}),Object.assign(new Uint8Array([1]),{[k]:2})];},false);
  check('distinct weak maps opaque',()=>[new WeakMap(),new WeakMap()],false);
  check('distinct weak sets opaque',()=>[new WeakSet(),new WeakSet()],false);
  check('distinct promises opaque',()=>[Promise.resolve(1),Promise.resolve(1)],false);
  check('distinct errors opaque',()=>[new Error('x'),new Error('x')],false);
  check('distinct URLs opaque',()=>[new URL('https://example.com'),new URL('https://example.com')],false);
  check('opaque same identity',()=>{const p=Promise.resolve();return [p,p];},true);
  check('unsupported object with explicit bilateral hook',()=>{const a=new Error('a'),b=new Error('b');a.equals=b.equals=()=>true;return [a,b];},true);
  check('symbol tag cannot forge Map brand',()=>[{[Symbol.toStringTag]:'Map'},{[Symbol.toStringTag]:'Map'}],false);
  check('masked Map brand still compares payload',()=>{const a=new Map([[1,1]]),b=new Map([[1,2]]);Object.defineProperty(a,Symbol.toStringTag,{value:'Object'});Object.defineProperty(b,Symbol.toStringTag,{value:'Object'});return [a,b];},false);
  check('unrecognised custom tags are identity-only',()=>[{[Symbol.toStringTag]:'Widget',v:1},{[Symbol.toStringTag]:'Widget',v:1}],false);
  check('tag named toString cannot masquerade as wrapper',()=>[{[Symbol.toStringTag]:'toString',v:1},{[Symbol.toStringTag]:'toString',v:2}],false);
  check('tag named constructor cannot masquerade as wrapper',()=>[{[Symbol.toStringTag]:'constructor',v:1},{[Symbol.toStringTag]:'constructor',v:2}],false);
  test(name+': getter error propagates unchanged',()=>{const error=new Error('getter');assert.throws(()=>compare({get x(){throw error;}},{x:1}),e=>e===error);});
  test(name+': proxy ownKeys error propagates unchanged',()=>{const error=new Error('trap');const p=new Proxy({}, {ownKeys(){throw error;}});assert.throws(()=>compare(p,{}),e=>e===error);});
  test(name+': type tag getter error propagates unchanged',()=>{const error=new Error('tag');const a={get [Symbol.toStringTag](){throw error;}};assert.throws(()=>compare(a,{}),e=>e===error);});
  test(name+': identity does not invoke getters or hooks',()=>{const a={get x(){throw Error();},get equals(){throw Error();}};assert.equal(compare(a,a),true);});
  test(name+': detached buffers reject invalid state',()=>{const a=new ArrayBuffer(1),b=new ArrayBuffer(1);structuredClone(a,{transfer:[a]});structuredClone(b,{transfer:[b]});assert.throws(()=>compare(a,b),e=>e.name==='TypeError');});
  test(name+': detached typed arrays reject invalid state',()=>{const a=new Uint8Array(1),b=new Uint8Array(1);structuredClone(a.buffer,{transfer:[a.buffer]});structuredClone(b.buffer,{transfer:[b.buffer]});assert.throws(()=>compare(a,b),e=>e.name==='TypeError');});
  test(name+': detached DataViews reject invalid state',()=>{const a=new DataView(new ArrayBuffer(1)),b=new DataView(new ArrayBuffer(1));structuredClone(a.buffer,{transfer:[a.buffer]});structuredClone(b.buffer,{transfer:[b.buffer]});assert.throws(()=>compare(a,b),e=>e.name==='TypeError');});
}
const typedConstructors = [Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array,BigInt64Array,BigUint64Array];
for(const Type of typedConstructors) for(const [name,compare] of all) {
  const one = Type === BigInt64Array || Type === BigUint64Array ? 1n : 1;
  const two = typeof one==='bigint'?2n:2;
  test(name+': '+Type.name+' equality',()=>assert.equal(compare(new Type([one,two]),new Type([one,two])),true));
  test(name+': '+Type.name+' mismatch',()=>assert.equal(compare(new Type([one]),new Type([two])),false));
  test(name+': '+Type.name+' length mismatch',()=>assert.equal(compare(new Type([one]),new Type([one,two])),false));
}
for(const [name,compare] of all) {
  test(name+': cross realm plain objects',()=>assert.equal(compare({x:1},vm.runInNewContext('({x:1})')),name==='isLooseEqual'));
  test(name+': cross realm arrays',()=>assert.equal(compare([1],vm.runInNewContext('[1]')),name==='isLooseEqual'));
  test(name+': cross realm Maps',()=>assert.equal(compare(new Map([[1,2]]),vm.runInNewContext('new Map([[1,2]])')),name==='isLooseEqual'));
  test(name+': cross realm typed arrays',()=>assert.equal(compare(new Uint8Array([1]),vm.runInNewContext('new Uint8Array([1])')),name==='isLooseEqual'));
  test(name+': cross realm wrappers',()=>assert.equal(compare(Object(1),vm.runInNewContext('Object(1)')),name!=='isStrictEqual'));
  test(name+': same constructor but different prototypes',()=>{
    const a=Object.create({x:1}),b=Object.create({x:2});a.v=b.v=3;assert.equal(compare(a,b),true);
  });
  test(name+': null prototype versus plain object',()=>assert.equal(compare(Object.assign(Object.create(null),{x:1}),{x:1}),name==='isLooseEqual'));
  test(name+': same Buffer payload',()=>assert.equal(compare(Buffer.from([1,2]),Buffer.from([1,2])),true));
  test(name+': different Buffer payload',()=>assert.equal(compare(Buffer.from([1,2]),Buffer.from([1,3])),false));
  test(name+': SharedArrayBuffer payload',()=>{const a=new SharedArrayBuffer(2),b=new SharedArrayBuffer(2);assert.equal(compare(a,b),true);new Uint8Array(b)[1]=3;assert.equal(compare(a,b),false);});
  test(name+': ordinary versus SharedArrayBuffer',()=>assert.equal(compare(new ArrayBuffer(2),new SharedArrayBuffer(2)),false));
}
