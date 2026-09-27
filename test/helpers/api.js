'use strict';
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const entry = process.env.EQUALITY_ENTRY ? path.resolve(process.env.EQUALITY_ENTRY) : path.resolve(__dirname, '../..');
if (process.env.EQUALITY_FORMAT === 'global' || process.env.EQUALITY_FORMAT === 'amd') {
  const sandbox = {};
  let result;
  if (process.env.EQUALITY_FORMAT === 'amd') {
    sandbox.define = (_dependencies, factory) => {
      result = factory();
    };
    sandbox.define.amd = {};
  }
  vm.runInNewContext(fs.readFileSync(entry, 'utf8'), sandbox, { filename: entry });
  module.exports = process.env.EQUALITY_FORMAT === 'amd' ? result : sandbox.Equality;
} else {
  module.exports = require(entry);
}
