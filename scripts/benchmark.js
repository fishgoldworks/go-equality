'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { performance } = require('node:perf_hooks');
const cases = require('../benchmarks/cases');
const resolveLibrary = require('./resolve-library');
const benchmarkOutput = require('./benchmark-output');
const args = process.argv.slice(2);
function option(name, fallback) {
  const i = args.indexOf(name);
  if (i === -1) {
    return fallback;
  }
  if (!args[i + 1] || args[i + 1].startsWith('--')) {
    throw new Error('Missing value for ' + name);
  }
  return args[i + 1];
}
const samples = Number(option('--samples', 9));
const targetMs = Number(option('--target-ms', 12));
if (!Number.isInteger(samples) || samples < 3 || !Number.isFinite(targetMs) || targetMs <= 0) {
  throw new Error('Invalid benchmark settings');
}
const baseline = option('--baseline', null);
const versions = (
  baseline
    ? [
        { name: 'baseline', path: baseline },
        { name: 'optimized', path: path.resolve(__dirname, '..') }
      ]
    : [{ name: 'current', path: path.resolve(__dirname, '..') }]
).map((version) => {
  const library = resolveLibrary(version.path);
  return { name: version.name, ...library, api: require(library.entry) };
});
const output = benchmarkOutput(option('--output', null), versions);
const filter = option('--filter', '');
const selectedCases = cases.filter((spec) => spec.name.includes(filter));
if (selectedCases.length === 0) {
  throw new Error('No benchmark cases match --filter: ' + filter);
}
function batch(fn, a, b, iterations, expected) {
  let matches = 0;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    if (fn(a, b)) {
      matches++;
    }
  }
  const duration = performance.now() - start;
  assert.equal(matches, expected ? iterations : 0, 'Incorrect benchmark result');
  return duration;
}
function median(list) {
  const a = [...list].sort((a, b) => a - b);
  return a[Math.floor(a.length / 2)];
}
const results = [];
for (const spec of selectedCases) {
  const [a, b, expected = true] = spec.make();
  const runners = versions.map((v) => ({ ...v, fn: v.api[spec.method], values: [], iterations: 1 }));
  for (const runner of runners) {
    assert.equal(runner.fn(a, b), expected, spec.name);
    // Calibration is also warm-up. Require several batches, even for slow calls.
    for (let i = 0; i < 6; i++) {
      const elapsed = batch(runner.fn, a, b, runner.iterations, expected);
      runner.iterations = Math.max(
        1,
        Math.min(1000000, Math.ceil((runner.iterations * targetMs) / Math.max(elapsed, 0.01)))
      );
    }
  }
  for (let sample = 0; sample < samples; sample++) {
    // Alternate A/B and B/A to reduce systematic measurement-order bias.
    const order = sample % 2 ? [...runners].reverse() : runners;
    for (const runner of order) {
      if (global.gc) {
        global.gc();
      }
      runner.values.push((batch(runner.fn, a, b, runner.iterations, expected) * 1e6) / runner.iterations);
    }
  }
  const row = { name: spec.name, method: spec.method };
  for (const runner of runners) {
    row[runner.name] = {
      medianNs: Math.round(median(runner.values)),
      minNs: Math.round(Math.min(...runner.values)),
      maxNs: Math.round(Math.max(...runner.values)),
      iterationsPerSample: runner.iterations,
      samplesNs: runner.values.map(Math.round)
    };
  }
  if (baseline) {
    row.speedup = Number((row.baseline.medianNs / row.optimized.medianNs).toFixed(2));
  }
  results.push(row);
  console.error(
    spec.name +
      ': ' +
      runners.map((r) => r.name + '=' + row[r.name].medianNs + ' ns').join(', ') +
      (baseline ? ' (' + row.speedup + 'x)' : '')
  );
}
const report = {
  node: process.version,
  v8: process.versions.v8,
  platform: process.platform,
  arch: process.arch,
  cpu: os.cpus()[0]?.model,
  date: new Date().toISOString(),
  samples,
  targetMs,
  explicitGcBetweenSamples: !!global.gc,
  note: 'Local warm-JIT single-process measurements, alternating version order. Fixtures and assertions outside timed loops. Samples include any in-loop GC. No cross-library claim or timing-based unit assertion.',
  versions: versions.map((v) => ({ name: v.name, version: v.version })),
  results
};
const json = JSON.stringify(report, null, 2) + '\n';
if (output) {
  fs.writeFileSync(benchmarkOutput(output, versions), json);
}
console.log(json);
