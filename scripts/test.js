'use strict';
const path = require('node:path');
const {spawnSync} = require('node:child_process');

// Node options must precede test paths; otherwise coverage/filter flags can be ignored.
// Keep compile-only TypeScript fixtures out of the runtime suite on every Node version.
const result = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), 'test/*.test.js'], {
    cwd:path.resolve(__dirname, '..'), stdio:'inherit'
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
