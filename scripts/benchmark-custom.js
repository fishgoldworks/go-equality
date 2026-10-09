'use strict';
// Compare the cost of standard, immediate custom and reusable custom calls.
// Create inputs and comparators before timing; the callback always returns undefined.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const { performance } = require('node:perf_hooks');
const benchmarkOutput = require('./benchmark-output');
const { isEqual } = require('..');
const library = { entry: require.resolve('..'), manifest: require.resolve('../package.json') };
const reportFile = benchmarkOutput(process.argv[2], [library]);
const callback = () => undefined;
const created = isEqual.create(callback);
const compareNow = (a, b) => isEqual.custom(a, b, callback);
const variants = [
  ['ordinary', isEqual],
  ['custom', compareNow],
  ['created', created]
];
const cases = [
  ['primitive', () => [1, 1]],
  [
    'flat record',
    () => [
      { id: 1, label: 'Alex', active: true },
      { id: 1, label: 'Alex', active: true }
    ]
  ],
  [
    'task form',
    () => {
      const task = {
        title: 'Fix checkout validation',
        status: 'open',
        assignee: { type: 'user', id: 'user-42', displayName: 'Alex Kim' },
        labels: ['frontend', 'bug']
      };
      return [task, structuredClone(task)];
    }
  ],
  [
    'primitive Set, 512',
    () => [new Set(Array.from({ length: 512 }, (_, i) => i)), new Set(Array.from({ length: 512 }, (_, i) => 511 - i))]
  ],
  [
    'structural Set, 64',
    () => [
      new Set(Array.from({ length: 64 }, (_, id) => ({ id }))),
      new Set(Array.from({ length: 64 }, (_, i) => ({ id: 63 - i })))
    ]
  ],
  ['typed array, 1024', () => [new Float64Array(1024), new Float64Array(1024)]]
];
function batch(compare, a, b, count) {
  let equal = 0;
  const start = performance.now();
  for (let i = 0; i < count; i++) {
    if (compare(a, b)) {
      equal++;
    }
  }
  const elapsed = performance.now() - start;
  assert.equal(equal, count);
  return elapsed;
}
const results = [];
for (const [name, make] of cases) {
  const [a, b] = make();
  const runs = variants.map(([label, compare]) => ({ label, compare, count: 1, samplesNs: [] }));
  for (const r of runs) {
    assert.equal(r.compare(a, b), true, name + ' / ' + r.label);
    for (let i = 0; i < 6; i++) {
      const ms = batch(r.compare, a, b, r.count);
      r.count = Math.max(1, Math.min(1000000, Math.ceil((r.count * 10) / Math.max(ms, 0.01))));
    }
  }
  for (let sample = 0; sample < 9; sample++) {
    for (let i = 0; i < runs.length; i++) {
      const r = runs[(sample + i) % runs.length];
      if (global.gc) {
        global.gc();
      }
      r.samplesNs.push((batch(r.compare, a, b, r.count) * 1e6) / r.count);
    }
  }
  results.push({
    name,
    variants: Object.fromEntries(
      runs.map((r) => [
        r.label,
        {
          medianNs: Math.round([...r.samplesNs].sort((a, b) => a - b)[4]),
          samplesNs: r.samplesNs.map(Math.round),
          iterations: r.count
        }
      ])
    )
  });
}
const report = {
  version: require('../package.json').version,
  node: process.version,
  v8: process.versions.v8,
  cpu: os.cpus()[0].model,
  samples: 9,
  explicitGcBetweenSamples: !!global.gc,
  note: 'Local warm-JIT observations with identical fixtures and an undefined-returning customizer. Factory creation and fixtures outside timing; order rotates each sample. No timing assertions or universal performance guarantee.',
  results
};
const output = JSON.stringify(report, null, 2) + '\n';
if (reportFile) {
  fs.writeFileSync(benchmarkOutput(reportFile, [library]), output);
}
process.stdout.write(output);
