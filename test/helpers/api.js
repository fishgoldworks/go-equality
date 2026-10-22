'use strict';
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const format = process.env.EQUALITY_FORMAT ?? 'commonjs';
if (!['commonjs', 'global', 'amd'].includes(format)) {
  throw new Error('Unsupported EQUALITY_FORMAT: ' + JSON.stringify(format));
}
const selectedEntry = process.env.EQUALITY_ENTRY;
if (selectedEntry !== undefined && selectedEntry.trim() === '') {
  throw new Error('EQUALITY_ENTRY must name a module or bundle when supplied.');
}
const entry = selectedEntry === undefined ? path.resolve(__dirname, '../..') : path.resolve(selectedEntry);
if (format === 'global' || format === 'amd') {
  // Host Buffer inputs need the trusted constructor in the receiving realm.
  const sandbox = process.env.EQUALITY_WITHOUT_BUFFER ? {} : { Buffer: require('node:buffer').Buffer };
  let result;
  if (format === 'amd') {
    sandbox.define = (_dependencies, factory) => {
      result = factory();
    };
    sandbox.define.amd = {};
  }
  vm.runInNewContext(fs.readFileSync(entry, 'utf8'), sandbox, { filename: entry });
  module.exports = format === 'amd' ? result : sandbox.goEquality;
} else {
  module.exports = require(entry);
}
