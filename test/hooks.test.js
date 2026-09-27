'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const api=require('./helpers/api');
for(const [name,compare] of Object.entries(api)) {
  test(name+': either hook vetoes bilateral acceptance',()=>{
    const a={equals(){return true;}},b={equals(){return false;}};
    assert.equal(compare(a,b),false);assert.equal(compare(b,a),false);
  });
  test(name+': bilateral hooks may override constructors and built-in kind',()=>{
    class A{equals(){return true;}}class B{equals(){return true;}}
    assert.equal(compare(new A(),new B()),true);
    const a=new Date(0),b=new Map();a.equals=b.equals=()=>true;assert.equal(compare(a,b),true);
  });
  test(name+': hook this and argument preserved',()=>{
    const a={id:'a',equals(other){assert.equal(this,a);assert.equal(other,b);return true;}},b={id:'b',equals(other){assert.equal(this,b);assert.equal(other,a);return true;}};
    assert.equal(compare(a,b),true);
  });
  test(name+': one accepting inherited hook requires equal structure',()=>{
    const a=Object.assign(Object.create({equals(){return true;}}),{x:1});
    assert.equal(compare(a,{x:1}),true);assert.equal(compare(a,{x:2}),false);
  });
  test(name+': one vetoing inherited hook rejects equal structure',()=>{
    const a=Object.assign(Object.create({equals(){return false;}}),{x:1});
    assert.equal(compare(a,{x:1}),false);assert.equal(compare({x:1},a),false);
  });
  test(name+': nonfunction equals is ordinary data',()=>{
    assert.equal(compare({equals:1},{equals:1}),true);assert.equal(compare({equals:1},{equals:2}),false);
  });
  test(name+': hook exception object propagates',()=>{
    const error=new RangeError('custom');const a={equals(){throw error;}},b={};
    assert.throws(()=>compare(a,b),e=>e===error);assert.throws(()=>compare(b,a),e=>e===error);
  });
  test(name+': hook getter exception propagates',()=>{
    const error=new Error('get equals');assert.throws(()=>compare({get equals(){throw error;}},{}),e=>e===error);
  });
  for(const result of [undefined,null,0,1,'true',{},Promise.resolve(true)]) {
    test(name+': nonboolean hook rejects '+String(result),()=>assert.throws(()=>compare({equals(){return result;}},{}),/equals\(\) must return a boolean/));
  }
  test(name+': equality context is local to each call',()=>{
    const a={x:1},b={x:1};assert.equal(compare(a,b),true);b.x=2;assert.equal(compare(a,b),false);b.x=1;assert.equal(compare(a,b),true);
  });
  test(name+': hook may compare a different pair reentrantly',()=>{
    class V{constructor(x){this.x=x;}equals(other){return compare(this.x,other.x);}}
    assert.equal(compare(new V({a:1}),new V({a:1})),true);assert.equal(compare(new V({a:1}),new V({a:2})),false);
  });
}
