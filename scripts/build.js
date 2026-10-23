'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { minify_sync: minifyJavaScript } = require('terser');
const acorn = require('acorn');
const {
  root,
  packageRoot: destination,
  consumerFiles,
  consumerManifest,
  writeFunctionEntries
} = require('./package-layout');
const metadata = require('../package.json');
const license = fs.readFileSync(path.join(root, 'LICENSE.md'), 'utf8').replace(/\r\n/g, '\n').trim();
const banner = `/*! go-equality v${metadata.version} | ${metadata.license}\n\n${license}\n*/`;
const parse = (text) => acorn.parse(text, { ecmaVersion: 2017, sourceType: 'script' });

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
  else root.goEquality = factory();
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
  const { code, map } = minifyJavaScript(
    { 'go-equality.js': text },
    {
      ecma: 2017,
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
      format: { comments: false, preamble: banner, beautify: false },
      sourceMap: {
        filename: 'go-equality.min.js',
        url: 'go-equality.min.js.map',
        includeSources: true
      }
    }
  );
  parse(code);
  fs.writeFileSync(path.join(output, 'go-equality.min.js'), code + '\n');
  fs.writeFileSync(path.join(output, 'go-equality.min.js.map'), map + '\n');
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
    try {
      fs.rmSync(previous, { recursive: true, force: true });
    } catch (cleanupError) {
      throw new Error(
        'New distribution is active at ' +
          destination +
          '; cleanup of previous distribution failed at ' +
          previous +
          '; any remaining backup may be incomplete',
        { cause: cleanupError }
      );
    }
  }
}

function main() {
  if (process.argv.length > 2) {
    throw Error('Usage: node scripts/build.js');
  }
  require('node:child_process').execFileSync(process.execPath, [path.join(__dirname, 'docs.js')], { stdio: 'inherit' });
  const temporary = fs.mkdtempSync(path.join(root, '.go-equality-build-'));
  let buildError;
  let buildFailed = false;
  try {
    for (const file of consumerFiles) {
      fs.mkdirSync(path.dirname(path.join(temporary, file)), { recursive: true });
      fs.copyFileSync(path.join(root, file), path.join(temporary, file));
    }
    fs.mkdirSync(path.join(temporary, 'src'));
    for (const file of fs.readdirSync(path.join(root, 'src'), { withFileTypes: true })) {
      if (file.isFile() && file.name.endsWith('.js')) {
        fs.copyFileSync(path.join(root, 'src', file.name), path.join(temporary, 'src', file.name));
      }
    }
    writeFunctionEntries(temporary);
    fs.writeFileSync(path.join(temporary, 'package.json'), JSON.stringify(consumerManifest(), null, 2) + '\n');
    const bundles = path.join(temporary, 'dist');
    bundle(bundles);
    minify(bundles);
    require('./test-loaders')(bundles);
    const api = require(path.join(temporary, 'index.js'));
    require('node:assert/strict').deepEqual(Object.keys(api).sort(), Object.keys(require('../index.js')).sort());
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
