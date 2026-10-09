'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

module.exports = function resolveLibrary(location) {
  const absolute = path.resolve(location);
  const isDirectory = fs.statSync(absolute, { throwIfNoEntry: false })?.isDirectory();
  // Resolve from inside directories so a neighbouring .js or .json file cannot win.
  // Node then honours the package main and its normal index fallback.
  const entry = isDirectory
    ? createRequire(path.join(absolute, 'package.json')).resolve('./')
    : require.resolve(absolute);
  let directory = isDirectory ? absolute : path.dirname(entry);
  for (;;) {
    const manifest = path.join(directory, 'package.json');
    if (fs.existsSync(manifest)) {
      const metadata = require(manifest);
      return { entry, version: metadata.version ?? null, manifest };
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return { entry, version: null, manifest: null };
    }
    directory = parent;
  }
};
