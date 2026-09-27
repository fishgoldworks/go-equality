'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { minify_sync: minifyJavaScript } = require('terser');
const acorn = require('acorn');
const root = path.resolve(__dirname, '..');
const destination = path.join(root, 'dist');
const metadata = require('../package.json');
const banner = '/*! go-equality v' + metadata.version + ' | Copyright (c) 2022-2026 Michael Ko | LGPL-3.0-only */';
const parse = (text) => acorn.parse(text, { ecmaVersion: 2022, sourceType: 'script' });

function walk(node, visit) {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (node.type) {
    visit(node);
  }
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) {
      child.forEach((item) => walk(item, visit));
    } else if (child && typeof child === 'object') {
      walk(child, visit);
    }
  }
}

function bundle(output) {
  const ids = new Map();
  const modules = [];
  function add(file) {
    file = path.resolve(file);
    if (ids.has(file)) {
      return ids.get(file);
    }
    const id = modules.length;
    ids.set(file, id);
    modules.push(null);
    const source = fs.readFileSync(file, 'utf8');
    const replacements = [];
    walk(parse(source), (node) => {
      if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier' || node.callee.name !== 'require') {
        return;
      }
      const specifier = node.arguments[0]?.value;
      if (node.arguments.length !== 1 || typeof specifier !== 'string' || !specifier.startsWith('./')) {
        throw new Error('Build accepts static local requires only: ' + file);
      }
      const target = require.resolve(path.resolve(path.dirname(file), specifier));
      replacements.push([node.start, node.end, '__require(' + add(target) + ')']);
    });
    let rewritten = source;
    for (const [start, end, replacement] of replacements.sort((a, b) => b[0] - a[0])) {
      rewritten = rewritten.slice(0, start) + replacement + rewritten.slice(end);
    }
    modules[id] = 'function(module, exports, __require) {\n' + rewritten + '\n}';
    return id;
  }
  add(path.join(root, 'index.js'));
  const text =
    banner +
    `
(function (root, factory) {
  if (typeof module === 'object' && module !== null && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.Equality = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const modules = [
${modules.join(',\n')}
  ];
  const cache = Object.create(null);
  function __require(id) {
    if (cache[id]) return cache[id].exports;
    const module = { exports: {} };
    cache[id] = module;
    modules[id](module, module.exports, __require);
    return module.exports;
  }
  return __require(0);
});
`;
  parse(text);
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'go-equality.js'), text);
}

function minify(output) {
  const text = fs.readFileSync(path.join(output, 'go-equality.js'), 'utf8');
  const { code } = minifyJavaScript(text, {
    ecma: 2022,
    compress: {
      // Preserve document.all's typeof/undefined distinction and loose equality.
      comparisons: false,
      typeofs: false,
      // Getters and proxy traps are observable parts of the comparison contract.
      pure_getters: false
    },
    mangle: { properties: false },
    keep_fnames: true,
    keep_classnames: true,
    format: { comments: false, preamble: banner, beautify: false }
  });
  parse(code);
  fs.writeFileSync(path.join(output, 'go-equality.min.js'), code + '\n');
}

function replaceDistribution(temporary) {
  const previous = temporary + '-previous';
  let hadPrevious = false;
  try {
    fs.renameSync(destination, previous);
    hadPrevious = true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  try {
    fs.renameSync(temporary, destination);
  } catch (error) {
    if (hadPrevious) {
      try {
        fs.renameSync(previous, destination);
      } catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          'Build replacement and rollback failed; previous distribution retained at ' + previous,
          { cause: restoreError }
        );
      }
    }
    throw error;
  }
  if (hadPrevious) {
    fs.rmSync(previous, { recursive: true, force: true });
  }
}

function main() {
  if (process.argv.length > 2) {
    throw Error('Usage: node scripts/build.js');
  }
  const temporary = fs.mkdtempSync(path.join(root, '.go-equality-build-'));
  let buildError;
  let buildFailed = false;
  try {
    bundle(temporary);
    minify(temporary);
    require('./test-loaders')(temporary);
    replaceDistribution(temporary);
    console.log('Built complete distribution successfully.');
  } catch (error) {
    buildError = error;
    buildFailed = true;
  }
  try {
    fs.rmSync(temporary, { recursive: true, force: true });
  } catch (cleanupError) {
    if (buildFailed) {
      throw new AggregateError(
        [buildError, cleanupError],
        (buildError?.message ?? String(buildError)) + '; cleanup also failed at ' + temporary,
        { cause: cleanupError }
      );
    }
    throw cleanupError;
  }
  if (buildFailed) {
    throw buildError;
  }
}
main();
