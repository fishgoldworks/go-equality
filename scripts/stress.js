'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const api = require('..');
const { graphEqual } = require('../test/helpers/oracle');
const args = process.argv.slice(2);
function option(name, fallback) {
  const i = args.indexOf(name);
  if (i < 0) {
    return fallback;
  }
  if (!args[i + 1] || args[i + 1].startsWith('--')) {
    throw new Error('Missing value for ' + name);
  }
  return args[i + 1];
}
const seeds = Number(option('--seeds', 2000));
if (!Number.isSafeInteger(seeds) || seeds < 1) {
  throw new Error('seeds must be a positive safe integer');
}
const baselinePath = option('--baseline', null);
const baseline = baselinePath ? require(path.resolve(baselinePath)) : null;
function rng(seed) {
  let x = seed;
  return (n) => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) % n;
  };
}
function make(seed, variant = 0) {
  const random = rng(seed);
  const n = 4 + random(4);
  const nodes = Array.from({ length: n }, () => [() => ({}), () => [], () => new Map(), () => new Set()][random(4)]());
  const primitive = [0, 1, 2, '0', '1', true, false, null, undefined];
  const value = () => (random(4) ? nodes[random(n)] : primitive[random(primitive.length)]);
  for (const node of nodes) {
    const size = random(4);
    for (let j = 0; j < size; j++) {
      if (node instanceof Map) {
        node.set(value(), value());
      } else if (node instanceof Set) {
        node.add(value());
      } else if (Array.isArray(node)) {
        node.push(value());
      } else {
        node['p' + j] = value();
      }
    }
  }
  if (variant === 2) {
    nodes[random(n)].extra = 9;
  }
  if (variant) {
    for (const node of nodes) {
      if (node instanceof Map) {
        const entries = [...node].reverse();
        node.clear();
        for (const [key, item] of entries) {
          node.set(key, item);
        }
      } else if (node instanceof Set) {
        const entries = [...node].reverse();
        node.clear();
        for (const item of entries) {
          node.add(item);
        }
      }
    }
  }
  return new Set(variant ? nodes.slice(0, 3).reverse() : nodes.slice(0, 3));
}
let scenarios = 0;
const start = performance.now();
for (let seed = 1; seed <= seeds; seed++) {
  const a = make(seed),
    b = make(seed, 1),
    c = make(seed, 2),
    d = make(seed + 51323);
  for (const [name, compare] of Object.entries(api)) {
    for (const [variant, other] of [
      [1, b],
      [2, c],
      [3, d]
    ]) {
      const expected = baseline ? baseline[name](a, other) : graphEqual(a, other, name);
      const label = name + ': seed ' + seed + ', variant ' + variant;
      assert.equal(compare(a, other), expected, label);
      assert.equal(compare(other, a), expected, label + ', reversed');
      scenarios++;
    }
  }
}
console.log(
  JSON.stringify(
    {
      node: process.version,
      seeds,
      scenarios,
      directionalAssertions: scenarios * 2,
      reference: baseline
        ? 'supplied baseline ' + require(path.resolve(baselinePath, 'package.json')).version
        : 'independent eager fixed-point oracle',
      passed: true,
      durationMs: Math.round(performance.now() - start)
    },
    null,
    2
  )
);
