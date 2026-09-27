'use strict';
const {spawnSync}=require('node:child_process');
require('./test-loaders')();
const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const tests=fs.readdirSync(path.join(root,'test')).filter(name=>name.endsWith('.test.js')).map(name=>'test/'+name);
for(const file of ['go-equality.js','go-equality.min.js']) {
  for(const format of ['commonjs','global','amd']) {
    console.log('\nArtifact suite: '+file+' ('+format+')');
    const result=spawnSync(process.execPath,['--test','--test-reporter=tap',...tests],{
      cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,
      env:{...process.env,EQUALITY_ENTRY:path.join(root,'dist',file),EQUALITY_FORMAT:format},
    });
    if(result.error)throw result.error;
    if(result.status!==0){process.stdout.write(result.stdout);process.stderr.write(result.stderr);process.exit(result.status||1);}
    console.log(result.stdout.split('\n').filter(line=>/^# (tests|pass|fail|skipped|duration_ms)/.test(line)).join('\n'));
  }
}
