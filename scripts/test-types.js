'use strict';
const runCleanups = require('./cleanup');
const { parseArgs } = require('node:util');
const { describeTarball } = require('./release-tools');
const { values } = parseArgs({ options: { tarball: { type: 'string' } } });
const candidate = values.tarball !== undefined ? describeTarball(values.tarball) : undefined;
const fixture = require('./consumer-package')(candidate);
const errors = [];
try {
  require('./consumer-types')(fixture.consumer, [process.execPath], [process.execPath]);
  console.log('Installed CommonJS/ESM type fixtures and emitted default imports passed.');
} catch (error) {
  errors.push(error);
}
runCleanups([() => fixture.cleanup()], errors);
