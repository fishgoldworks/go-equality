'use strict';
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const packageRoot = path.join(root, 'package');
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
    'engines',
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
    main: 'index.js',
    types: 'index.d.ts',
    sideEffects: false,
    files: [
      'index.js',
      'index.d.ts',
      'src/*.js',
      'dist/go-equality.js',
      'dist/go-equality.min.js',
      'README.md',
      'docs/API.md',
      'LICENSE.md',
      'CHANGELOG.md'
    ],
    exports: {
      // Preserve conditional types and Node 13.0's literal-target resolver.
      '.': [{ types: './index.d.ts', default: './index.js' }, './index.js'],
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
module.exports = { root, packageRoot, consumerFiles, consumerManifest };
