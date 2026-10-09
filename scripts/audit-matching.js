'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const benchmarkOutput = require('./benchmark-output');
const resolveLibrary = require('./resolve-library');
const request = process.env.EQUALITY_ENTRY || path.join(__dirname, '..');
const library = resolveLibrary(require.resolve(request));
const libraries = [library, resolveLibrary(__filename)];
const packageName = request
  .split(/[\\/]/)
  .slice(0, request.startsWith('@') ? 2 : 1)
  .join(path.sep);
const locations = path.isAbsolute(request)
  ? [[request]]
  : /^\.{1,2}(?:[\\/]|$)/.test(request)
    ? [[path.resolve(__dirname, request)]]
    : (require.resolve.paths(request) || []).map((base) => [path.join(base, request), path.join(base, packageName)]);
const manifests = [];
const realEntry = fs.realpathSync(library.entry);
// Keep the requested package's metadata even when its main crosses a package boundary.
// Resolving the entry first preserves CommonJS lookup rules, including package exports.
for (const candidates of locations) {
  const directories = [...new Set(candidates)].filter((location) =>
    fs.statSync(location, { throwIfNoEntry: false })?.isDirectory()
  );
  const selected = directories.some((location) => {
    const relative = path.relative(fs.realpathSync(location), realEntry);
    if (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep)) {
      return true;
    }
    try {
      return require.resolve(location + path.sep) === library.entry;
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') {
        throw error;
      }
      return false;
    }
  });
  if (selected) {
    for (const location of directories) {
      const manifest = path.join(location, 'package.json');
      if (fs.existsSync(manifest)) {
        manifests.push(manifest);
      }
    }
    break;
  }
}
const { isEqual } = require(library.entry);
const output = benchmarkOutput(process.argv[3] || null, libraries, manifests);
const mode = process.argv[2] || 'default';
if (!['default', 'strict', 'loose'].includes(mode)) {
  throw new Error('Unknown mode');
}
// Enumerate every permutation independently of the production augmenting-path algorithm.
const permutations = [];
function generate(values, prefix = []) {
  if (!values.length) {
    permutations.push(prefix);
    return;
  }
  for (let i = 0; i < values.length; i++) {
    generate(
      values.filter((_, j) => i !== j),
      [...prefix, values[i]]
    );
  }
}
generate([0, 1, 2, 3]);
const a = [0, 1, 2, 3].map((id) => ({ side: 0, id }));
const b = [2, 0, 3, 1].map((id) => ({ side: 1, id }));
const sets = [new Set(a), new Set(b)];
const maps = [new Map(a.map((x) => [x, 'value'])), new Map(b.map((x) => [x, 'value']))];
let bits = 0;
const compare = isEqual.create(
  (left, right) => {
    if (
      !left ||
      !right ||
      typeof left !== 'object' ||
      typeof right !== 'object' ||
      !Object.hasOwn(left, 'side') ||
      !Object.hasOwn(right, 'side')
    ) {
      return undefined;
    }
    if (left.side === right.side) {
      return left.id === right.id;
    }
    const row = left.side === 0 ? left.id : right.id;
    const col = left.side === 0 ? right.id : left.id;
    return Boolean(bits & (1 << (row * 4 + col)));
  },
  { mode }
);
let comparisons = 0;
const started = performance.now();
for (bits = 0; bits < 65536; bits++) {
  const expected = permutations.some((p) => p.every((col, row) => Boolean(bits & (1 << (row * 4 + col)))));
  for (const [left, right] of [sets, maps]) {
    assert.equal(compare(left, right), expected, `${mode}, matrix ${bits}`);
    assert.equal(compare(right, left), expected, `${mode}, matrix ${bits}, reverse`);
    comparisons += 2;
  }
}
const result = {
  mode,
  matrices: 65536,
  comparisons,
  failed: 0,
  durationMs: performance.now() - started,
  node: process.version
};
if (output) {
  fs.writeFileSync(benchmarkOutput(output, libraries, manifests), JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify(result));
