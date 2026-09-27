'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const npm=process.env.npm_execpath;
if(!npm)throw new Error('Run this script with npm run test:package.');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'go-equality-package-'));
function run(command,args,cwd,env=process.env) {
  const result=spawnSync(command,args,{cwd,env,encoding:'utf8',maxBuffer:16*1024*1024});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(result.stdout+'\n'+result.stderr);
  return result.stdout;
}
try {
  const [packed]=JSON.parse(run(process.execPath,[npm,'pack','--json','--ignore-scripts','--pack-destination',temp],root));
  for(const {path:file} of packed.files) {
    assert.match(file,/^(?:src\/[A-Za-z]+\.js|dist\/go-equality(?:\.min)?\.js|index\.(?:js|d\.ts)|package\.json|README\.md|LICENSE\.md|CHANGELOG\.md)$/);
    assert.doesNotMatch(file,/(?:^|\/)(?:node_modules|\.git|\.idea|\.tmp|test)(?:\/|$)/);
  }
  const consumer=path.join(temp,'consumer');fs.mkdirSync(consumer);
  fs.writeFileSync(path.join(consumer,'package.json'),JSON.stringify({name:'go-equality-consumer-smoke',version:'1.0.0',private:true}));
  run(process.execPath,[npm,'install','--offline','--ignore-scripts','--no-audit','--no-fund','--package-lock=false','--cache',path.join(temp,'cache'),path.join(temp,packed.filename)],consumer);
  const entry=path.join(consumer,'node_modules/go-equality');
  const installedMetadata = JSON.parse(fs.readFileSync(path.join(entry, 'package.json'), 'utf8'));
  assert.equal(installedMetadata.version, require('../package.json').version);
  const installedReadme = fs.readFileSync(path.join(entry, 'README.md'), 'utf8');
  for (const [, target] of installedReadme.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    const [file] = target.split('#');
    assert.ok(fs.existsSync(path.join(entry, file)), 'Missing packaged README link: ' + file);
  }
  const code="const assert=require('node:assert/strict');const api=require('go-equality');assert.deepEqual(Object.keys(api).sort(),['isEqual','isLooseEqual','isStrictEqual']);assert.equal(api.isEqual(new Set([{x:1}]),new Set([{x:1}])),true);assert.equal(api.isLooseEqual(1,'1'),true);assert.equal(api.isStrictEqual(1,Object(1)),false);assert.equal(api.isEqual.strict,api.isStrictEqual);assert.equal(api.isEqual.loose,api.isLooseEqual);assert.equal(api.isEqual.custom('A','a',(a,b)=>typeof a==='string'&&typeof b==='string'?a.toLowerCase()===b.toLowerCase():undefined),true);assert.equal(api.isEqual.create(()=>undefined,{mode:'loose'})(1,'1'),true);";
  run(process.execPath,['-e',code],consumer);
  run(process.execPath,['--input-type=module','-e',"import {isEqual,isLooseEqual,isStrictEqual} from 'go-equality';if(!isEqual({a:1},{a:1})||!isLooseEqual(1,'1')||isStrictEqual(1,Object(1)))throw Error('ESM import failed');if(isEqual.strict!==isStrictEqual||isEqual.loose!==isLooseEqual||!isEqual.custom(1,2,()=>true)||!isEqual.create(()=>undefined,{mode:'loose'})(1,'1'))throw Error('ESM attached API failed');"],consumer);
  // Resolve the public package name from outside the checkout in both module modes.
  const fixtures = path.join(root, 'test', 'types');
  const config = JSON.parse(fs.readFileSync(path.join(fixtures, 'tsconfig.json'), 'utf8'));
  for (const extension of ['cts', 'mts']) {
    fs.copyFileSync(path.join(fixtures, 'consumer.ts'), path.join(consumer, 'consumer.' + extension));
  }
  fs.copyFileSync(path.join(fixtures, 'require.cts'), path.join(consumer, 'require.cts'));
  config.files = ['consumer.cts', 'consumer.mts', 'require.cts'];
  fs.writeFileSync(path.join(consumer, 'tsconfig.json'), JSON.stringify(config, null, 2) + '\n');
  run(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.json'], consumer);
  require('./test-loaders')(path.join(entry, 'dist'));
  run(process.execPath, ['-e', "const assert=require('node:assert/strict');for(const file of ['go-equality.js','go-equality.min.js']){const api=require('go-equality/dist/'+file);assert.equal(api.isEqual({x:1},{x:1}),true);assert.equal(api.isEqual.strict,api.isStrictEqual);assert.equal(api.isEqual.loose,api.isLooseEqual);assert.equal(api.isEqual.custom(1,2,()=>true),true);assert.equal(api.isEqual.create(()=>undefined,{mode:'loose'})(1,'1'),true);}"], consumer);
  const tests=fs.readdirSync(path.join(root,'test')).filter(name=>name.endsWith('.test.js')).map(name=>'test/'+name);
  const output=run(process.execPath,['--test','--test-reporter=tap',...tests],root,{...process.env,EQUALITY_ENTRY:entry,EQUALITY_FORMAT:'commonjs'});
  console.log(output.split('\n').filter(line=>/^# (tests|pass|fail|skipped|duration_ms)/.test(line)).join('\n'));
  console.log('Packed CommonJS/ESM imports, declarations and browser bundles passed; '+packed.files.length+' allowlisted files.');
} finally {fs.rmSync(temp,{recursive:true,force:true});}
