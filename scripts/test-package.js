'use strict';
const runCleanups = require('./cleanup');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { parseArgs } = require('node:util');
const { describeTarball, run } = require('./release-tools');
const packPackage = require('./pack-package');
const root = path.resolve(__dirname, '..');
const { documentFiles, readDocuments, checkLinks } = require('../test/helpers/documentation');
const npm = process.env.npm_execpath;
if (!npm) {
  throw new Error('Run this script with npm run test:package.');
}
const { values } = parseArgs({ options: { tarball: { type: 'string' }, node: { type: 'string' } } });
// Validate explicit input before any build, pack, installation or browser work.
const supplied = values.tarball !== undefined ? describeTarball(values.tarball) : null;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'go-equality-package-'));
let fixture;
const errors = [];
try {
  const candidate = supplied || packPackage(temp);
  console.log('Tarball: ' + candidate.tarball + '\nSHA-256: ' + candidate.sha256);
  fixture = require('./consumer-package')(candidate);
  const { consumer, entry } = fixture;
  const files = fs
    .readdirSync(entry, { recursive: true, withFileTypes: true })
    .filter((file) => file.isFile())
    .map((file) => path.relative(entry, path.join(file.parentPath, file.name)).split(path.sep).join('/'));
  for (const file of files) {
    assert.match(
      file,
      /^(?:src\/[A-Za-z]+\.js|dist\/go-equality(?:\.js|\.min\.js(?:\.map)?)|index\.(?:js|d\.ts)|package\.json|README\.md|docs\/API\.md|LICENSE\.md|CHANGELOG\.md)$/
    );
  }
  for (const file of [
    'index.js',
    'index.d.ts',
    'package.json',
    ...documentFiles,
    'LICENSE.md',
    'CHANGELOG.md',
    'dist/go-equality.js',
    'dist/go-equality.min.js',
    'dist/go-equality.min.js.map'
  ]) {
    assert.ok(files.includes(file), 'Missing required packaged file: ' + file);
  }
  const installedMetadata = JSON.parse(fs.readFileSync(path.join(entry, 'package.json'), 'utf8'));
  for (const key of ['private', 'scripts', 'devDependencies']) {
    assert.equal(installedMetadata[key], undefined, key + ' must not ship');
  }
  assert.deepEqual(installedMetadata, require('./package-layout').consumerManifest());
  assert.equal(installedMetadata.license, 'MIT');
  assert.equal(installedMetadata.engines.node, '>=8.0.0');
  assert.match(fs.readFileSync(path.join(entry, 'LICENSE.md'), 'utf8'), /Permission is hereby granted, free of charge/);
  fs.copyFileSync(path.join(root, 'test/compatibility/consumer.js'), path.join(consumer, 'compatibility.js'));
  const runtimes = [...new Set([process.execPath, ...(values.node ? [values.node] : [])])];
  const esmRuntimes = [];
  for (const runtime of runtimes) {
    const version = run(runtime, ['--version'], consumer).trim();
    if (require('./runtime-support')(version)) {
      esmRuntimes.push(runtime);
    }
    console.log('Installed consumer runtime: ' + version);
    process.stdout.write(run(runtime, ['compatibility.js'], consumer));
    require('./consumer-optional')(consumer, runtime, require('./runtime-support')(version));
  }

  assert.equal(installedMetadata.version, require('../package.json').version);
  for (const file of documentFiles) {
    assert.ok(
      fs.readFileSync(path.join(entry, file)).equals(fs.readFileSync(path.join(root, file))),
      'Packaged ' + file + ' must match the repository document byte-for-byte.'
    );
  }
  process.stdout.write(
    run(process.execPath, ['--test', path.join(root, 'test/package/docs.test.js')], root, {
      ...process.env,
      EQUALITY_PACKAGE_ROOT: entry
    })
  );
  checkLinks(entry, readDocuments(entry));
  const code =
    "const assert=require('node:assert/strict');const api=require('go-equality');assert.deepEqual(Object.keys(api).sort(),['isEqual','isLooseEqual','isStrictEqual']);assert.equal(api.isEqual(new Set([{x:1}]),new Set([{x:1}])),true);assert.equal(api.isLooseEqual(1,'1'),true);assert.equal(api.isStrictEqual(1,Object(1)),false);assert.equal(api.isEqual.strict,api.isStrictEqual);assert.equal(api.isEqual.loose,api.isLooseEqual);assert.equal(api.isEqual.custom('A','a',(a,b)=>typeof a==='string'&&typeof b==='string'?a.toLowerCase()===b.toLowerCase():undefined),true);assert.equal(api.isEqual.create(()=>undefined,{mode:'loose'})(1,'1'),true);";
  run(process.execPath, ['-e', code], consumer);
  fs.writeFileSync(
    path.join(consumer, 'esm-import.mjs'),
    "import Eq,{isEqual,isLooseEqual,isStrictEqual} from 'go-equality';import {createRequire} from 'module';const common=createRequire(import.meta.url)('go-equality');if(Eq!==common||Eq.isEqual!==isEqual||Eq.isLooseEqual!==isLooseEqual||Eq.isStrictEqual!==isStrictEqual)throw Error('Default import API mismatch');if(!isEqual({a:1},{a:1})||!isLooseEqual(1,'1')||isStrictEqual(1,Object(1)))throw Error('ESM import failed');if(isEqual.strict!==isStrictEqual||isEqual.loose!==isLooseEqual||!isEqual.custom(1,2,()=>true)||!isEqual.create(()=>undefined,{mode:'loose'})(1,'1'))throw Error('ESM attached API failed');"
  );
  for (const runtime of esmRuntimes) {
    run(runtime, ['esm-import.mjs'], consumer);
  }
  require('./consumer-types')(consumer, runtimes, esmRuntimes);
  require('./test-loaders')(path.join(entry, 'dist'));
  run(
    process.execPath,
    [
      '-e',
      "const assert=require('node:assert/strict');for(const file of ['go-equality.js','go-equality.min.js']){const api=require('go-equality/dist/'+file);assert.equal(api.isEqual({x:1},{x:1}),true);assert.equal(api.isEqual.strict,api.isStrictEqual);assert.equal(api.isEqual.loose,api.isLooseEqual);assert.equal(api.isEqual.custom(1,2,()=>true),true);assert.equal(api.isEqual.create(()=>undefined,{mode:'loose'})(1,'1'),true);}"
    ],
    consumer
  );
  const tests = fs
    .readdirSync(path.join(root, 'test'))
    .filter((name) => name.endsWith('.test.js'))
    .map((name) => 'test/' + name);
  const output = run(process.execPath, ['--test', '--test-reporter=tap', ...tests], root, {
    ...process.env,
    EQUALITY_ENTRY: entry,
    EQUALITY_FORMAT: 'commonjs'
  });
  console.log(
    output
      .split('\n')
      .filter((line) => /^# (tests|pass|fail|skipped|duration_ms)/.test(line))
      .join('\n')
  );
  assert.equal(describeTarball(candidate.tarball).sha256, candidate.sha256, 'Verified tarball changed during checks.');
  console.log(
    'Packed default/named imports, executed TypeScript CommonJS/ESM consumers and browser bundles passed; ' +
      files.length +
      ' allowlisted files.'
  );
} catch (error) {
  errors.push(error);
}
runCleanups([() => fixture?.cleanup(), () => fs.rmSync(temp, { recursive: true, force: true })], errors);
