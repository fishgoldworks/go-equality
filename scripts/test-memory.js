'use strict';
// Resource regression, separate from unit coverage/timing benchmarks. It asserts
// correct results under a fixed V8 old-space budget, not a wall-clock threshold.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

if (process.argv[2] !== '--child') {
  const result = spawnSync(
    process.execPath,
    ['--expose-gc', '--max-old-space-size=64', '--max-semi-space-size=4', __filename, '--child'],
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }
  );
  if (result.error) {
    throw result.error;
  }
  assert.equal(
    result.status,
    0,
    'Constrained-heap comparison failed (' + (result.signal || result.status) + ').\n' + result.stdout + result.stderr
  );
  process.stdout.write(result.stdout);
} else {
  const api = require('../test/helpers/api');
  const results = [];
  const comparisons = Object.entries(api);
  for (const mode of ['default', 'strict', 'loose']) {
    comparisons.push(['custom/' + mode, api.isEqual.create(() => undefined, { mode })]);
  }
  for (const [name, compare] of comparisons) {
    const size = name === 'isEqual' ? 2000 : 1000;
    for (const kind of ['Set', 'Map']) {
      const left = Array.from({ length: size }, (_, id) => ({ id }));
      const right = Array.from({ length: size }, (_, id) => ({ id: size - 1 - id }));
      const a = kind === 'Set' ? new Set(left) : new Map(left.map((key) => [key, key.id]));
      const b = kind === 'Set' ? new Set(right) : new Map(right.map((key) => [key, key.id]));
      console.error('Checking ' + name + ' / ' + kind + ' / ' + size + ' structural records');
      global.gc();
      assert.equal(compare(a, b), true, name + ' forward ' + kind);
      assert.equal(compare(b, a), true, name + ' reversed ' + kind);
      right[0].id = -1;
      assert.equal(compare(a, b), false, name + ' mismatch ' + kind);
      assert.equal(compare(b, a), false, name + ' reversed mismatch ' + kind);
      results.push({ method: name, kind, size, assertions: 4, passed: true });
    }
  }
  console.log(
    JSON.stringify(
      {
        node: process.version,
        oldSpaceLimitMiB: 64,
        semiSpaceLimitMiB: 4,
        note: 'V8 old-space limit is not a whole-process memory limit. No timing assertion.',
        results
      },
      null,
      2
    )
  );
}
