'use strict';
// Each sample uses a fresh child process. Measure peak process memory (RSS)
// and heap use after the call. These include overhead beyond the comparator.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const resolveLibrary = require('./resolve-library');
const benchmarkOutput = require('./benchmark-output');

if (process.argv[2] === '--child') {
  const [, , , entry, kind, sizeText] = process.argv;
  const size = Number(sizeText);
  const { isEqual } = require(entry);
  const left = Array.from({ length: size }, (_, id) => ({ id }));
  const right = Array.from({ length: size }, (_, id) => ({ id: size - 1 - id }));
  const a = kind === 'Set' ? new Set(left) : new Map(left.map((key) => [key, key.id]));
  const b = kind === 'Set' ? new Set(right) : new Map(right.map((key) => [key, key.id]));
  global.gc();
  const before = process.memoryUsage();
  const start = performance.now();
  const equal = isEqual(a, b);
  const durationMs = performance.now() - start;
  const after = process.memoryUsage();
  assert.equal(equal, true);
  console.log(
    JSON.stringify({
      heapBeforeBytes: before.heapUsed,
      heapAfterBytes: after.heapUsed,
      heapDeltaBytes: after.heapUsed - before.heapUsed,
      rssBeforeBytes: before.rss,
      maxRssKiB: process.resourceUsage().maxRSS,
      durationMs,
      inputFiles: benchmarkOutput.inputFiles()
    })
  );
} else {
  const options = { samples: 5, size: 1000, baseline: null, output: null };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i].slice(2);
    if (!args[i].startsWith('--') || !Object.hasOwn(options, name) || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new Error('Expected --samples, --size, --baseline, or --output followed by a value.');
    }
    options[name] = args[i + 1];
  }
  const samples = Number(options.samples),
    size = Number(options.size);
  if (!Number.isSafeInteger(samples) || samples < 1 || !Number.isSafeInteger(size) || size < 1) {
    throw new Error('samples and size must be positive safe integers.');
  }
  const versions = (
    options.baseline
      ? [
          { name: 'baseline', entry: path.resolve(options.baseline) },
          { name: 'current', entry: path.resolve(__dirname, '..') }
        ]
      : [{ name: 'current', entry: path.resolve(__dirname, '..') }]
  ).map((version) => ({
    name: version.name,
    ...resolveLibrary(version.entry)
  }));
  const output = benchmarkOutput(options.output, versions);
  const median = (values) => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
  const results = [];
  const loadedFiles = new Set();
  for (const kind of ['Set', 'Map']) {
    const groups = versions.map((version) => ({ ...version, samples: [] }));
    for (let sample = 0; sample < samples; sample++) {
      for (const group of sample % 2 ? groups.toReversed() : groups) {
        const child = spawnSync(
          process.execPath,
          ['--expose-gc', __filename, '--child', group.entry, kind, String(size)],
          { encoding: 'utf8', maxBuffer: 1024 * 1024 }
        );
        if (child.error) {
          throw child.error;
        }
        assert.equal(child.status, 0, child.stdout + child.stderr);
        const { inputFiles, ...measurement } = JSON.parse(child.stdout);
        for (const filename of inputFiles) {
          loadedFiles.add(filename);
        }
        group.samples.push(measurement);
      }
    }
    const row = { kind, size };
    for (const group of groups) {
      row[group.name] = {
        medianMaxRssMiB: median(group.samples.map((s) => s.maxRssKiB)) / 1024,
        medianHeapDeltaMiB: median(group.samples.map((s) => s.heapDeltaBytes)) / 1024 / 1024,
        samples: group.samples
      };
    }
    results.push(row);
  }
  const report = {
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
    cpu: os.cpus()[0]?.model,
    date: new Date().toISOString(),
    samples,
    note: 'Fresh process per sample; version order alternates. GC before comparison. maxRSS includes Node startup, fixtures, and comparator. Heap delta is after-call minus before-call, not peak heap; intervening GC affects it. Durations are cold single calls, not speed benchmarks.',
    versions: versions.map((v) => ({ name: v.name, version: v.version })),
    results
  };
  const json = JSON.stringify(report, null, 2) + '\n';
  if (output) {
    fs.writeFileSync(benchmarkOutput(output, versions, loadedFiles), json);
  }
  console.log(json);
}
