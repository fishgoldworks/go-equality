'use strict';
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const packageRoot = path.join(root, 'package');
const consumerEngines = { node: '>=8.0.0' };
const functionNames = Object.entries(require('../index'))
  .filter(([, value]) => typeof value === 'function')
  .map(([name]) => name);
const functionFiles = functionNames.flatMap((name) =>
  ['.js', '.mjs', '.d.ts', '.d.cts', '.d.mts'].map((extension) => name + extension)
);
function functionTarget(name) {
  return [
    {
      types: { import: './' + name + '.d.mts', require: './' + name + '.d.cts', default: './' + name + '.d.ts' },
      import: './' + name + '.mjs',
      default: './' + name + '.js'
    },
    './' + name + '.js'
  ];
}
function writeFunctionEntries(directory) {
  const fs = require('node:fs');
  for (const name of functionNames) {
    fs.writeFileSync(
      path.join(directory, name + '.js'),
      "'use strict';\nmodule.exports = require('./src/" + name + "');\n"
    );
    const esm =
      'import ' + name + " from './" + name + ".js';\nexport { " + name + ' };\nexport default ' + name + ';\n';
    fs.writeFileSync(path.join(directory, name + '.mjs'), esm);
    const commonTypes = 'declare const ' + name + ": typeof import('./index')." + name + ';\nexport = ' + name + ';\n';
    for (const extension of ['.d.ts', '.d.cts']) {
      fs.writeFileSync(path.join(directory, name + extension), commonTypes);
    }
    const esmTypes =
      'import { ' + name + " } from './index.js';\nexport { " + name + ' };\nexport default ' + name + ';\n';
    fs.writeFileSync(path.join(directory, name + '.d.mts'), esmTypes);
  }
}
const consumerFiles = ['index.js', 'index.d.ts', 'README.md', 'docs/API.md', 'LICENSE.md', 'CHANGELOG.md'];
function consumerManifest() {
  const metadata = require('../package.json');
  const manifest = {};
  for (const field of [
    'name',
    'version',
    'description',
    'license',
    'author',
    'email',
    'keywords',
    'homepage',
    'repository',
    'bugs',
    'funding',
    'os',
    'cpu',
    'dependencies',
    'peerDependencies',
    'peerDependenciesMeta',
    'optionalDependencies',
    'publishConfig'
  ]) {
    if (metadata[field] !== undefined) {
      manifest[field] = metadata[field];
    }
  }
  Object.assign(manifest, {
    engines: consumerEngines,
    main: 'index.js',
    types: 'index.d.ts',
    sideEffects: ['./dist/go-equality.js', './dist/go-equality.min.js'],
    files: [
      'index.js',
      'index.d.ts',
      ...functionFiles,
      'src/*.js',
      'dist/go-equality.js',
      'dist/go-equality.min.js',
      'dist/go-equality.min.js.map',
      'README.md',
      'docs/API.md',
      'LICENSE.md',
      'CHANGELOG.md'
    ],
    exports: {
      // Preserve conditional types and Node 13.0's literal-target resolver.
      '.': [{ types: './index.d.ts', default: './index.js' }, './index.js'],
      ...Object.fromEntries(functionNames.map((name) => ['./' + name, functionTarget(name)])),
      './dist/go-equality.js': './dist/go-equality.js',
      './dist/go-equality.min.js': './dist/go-equality.min.js',
      './package.json': './package.json'
    }
  });
  const fields = [
    'name',
    'version',
    'description',
    'license',
    'author',
    'contributors',
    'email',
    'keywords',
    'homepage',
    'repository',
    'bugs',
    'funding',
    'type',
    'engines',
    'main',
    'module',
    'browser',
    'types',
    'typesVersions',
    'exports',
    'imports',
    'bin',
    'unpkg',
    'jsdelivr',
    'files',
    'sideEffects',
    'publishConfig',
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
    'peerDependenciesMeta'
  ];
  return Object.fromEntries(
    [...fields, 'os', 'cpu'].filter((field) => manifest[field] !== undefined).map((field) => [field, manifest[field]])
  );
}
module.exports = {
  consumerEngines,
  root,
  packageRoot,
  consumerFiles,
  functionFiles,
  consumerManifest,
  writeFunctionEntries
};
