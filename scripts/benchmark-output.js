'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createRequire, registerHooks } = require('node:module');
const { fileURLToPath, pathToFileURL } = require('node:url');

const importedFiles = new Set();
const metadataFiles = new Set();
const scannedDirectories = new Set();
const scannedRequests = new Set();

function recordScopes(filename) {
  let directory = path.dirname(filename);
  while (!scannedDirectories.has(directory)) {
    scannedDirectories.add(directory);
    metadataFiles.add(path.join(directory, 'package.json'));
    const parent = path.dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }
}

function recordImportTargets(specifier, parentURL) {
  let directory = path.dirname(fileURLToPath(parentURL));
  while (path.basename(directory) !== 'node_modules') {
    const manifest = path.join(directory, 'package.json');
    if (fs.existsSync(manifest)) {
      let imports;
      try {
        imports = JSON.parse(fs.readFileSync(manifest, 'utf8').replace(/^\uFEFF/, '')).imports;
      } catch {
        // Node already resolved this import; a later metadata read must not replace its result.
        return;
      }
      for (const [key, target] of Object.entries(imports || {})) {
        const star = key.indexOf('*');
        let replacement = '';
        if (star < 0) {
          if (key !== specifier) {
            continue;
          }
        } else {
          const prefix = key.slice(0, star);
          const suffix = key.slice(star + 1);
          if (
            !specifier.startsWith(prefix) ||
            !specifier.endsWith(suffix) ||
            specifier.length < prefix.length + suffix.length
          ) {
            continue;
          }
          replacement = specifier.slice(prefix.length, specifier.length - suffix.length);
        }
        // Protect targets from every matching condition without choosing a different resolution.
        const pending = [target];
        while (pending.length) {
          const value = pending.pop();
          if (typeof value === 'string') {
            const target = value.replace(/\*/g, () => replacement);
            // An inactive URL target must not be interpreted as a package path.
            if (!/^[a-z][a-z\d+.-]*:/i.test(target)) {
              recordRequest(target, pathToFileURL(manifest).href);
            }
          } else if (value && typeof value === 'object') {
            pending.push(...Object.values(value));
          }
        }
      }
      return;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }
}

function recordRequest(specifier, parentURL) {
  const key = parentURL + '\0' + specifier;
  if (scannedRequests.has(key)) {
    return;
  }
  scannedRequests.add(key);
  let locations;
  if (path.isAbsolute(specifier)) {
    locations = [specifier];
  } else if (specifier.startsWith('file:')) {
    locations = [fileURLToPath(specifier)];
  } else if (/^[a-z][a-z\d+.-]*:/i.test(specifier) || !parentURL?.startsWith('file:')) {
    return;
  } else if (specifier.startsWith('#')) {
    recordImportTargets(specifier, parentURL);
    return;
  } else if (/^\.{1,2}(?:[\\/]|$)/.test(specifier)) {
    locations = [path.resolve(path.dirname(fileURLToPath(parentURL)), specifier)];
  } else {
    const name = specifier
      .split(/[\\/]/)
      .slice(0, specifier.startsWith('@') ? 2 : 1)
      .join(path.sep);
    locations = (createRequire(parentURL).resolve.paths(specifier) || []).flatMap((base) => [
      path.join(base, name),
      path.join(base, specifier)
    ]);
  }
  for (const location of locations) {
    metadataFiles.add(path.join(location, 'package.json'));
  }
}

// Register before loading comparators: module caches omit ESM files and resolution metadata.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    if (result.url.startsWith('file:')) {
      recordScopes(fileURLToPath(result.url));
      if (context.parentURL?.startsWith('file:')) {
        recordScopes(fileURLToPath(context.parentURL));
      }
      recordRequest(specifier, context.parentURL);
    }
    return result;
  },
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (url.startsWith('file:')) {
      importedFiles.add(fileURLToPath(url));
    }
    return result;
  }
});

function inputFiles() {
  const files = new Set([...Object.keys(require.cache), ...importedFiles]);
  for (const filename of files) {
    recordScopes(filename);
  }
  for (const manifest of metadataFiles) {
    if (fs.existsSync(manifest)) {
      files.add(manifest);
    }
  }
  return [...files];
}

// Keep reports separate from measured entries, metadata and modules loaded by
// the benchmark or its measurement workers. This protects accidental aliases, not concurrent edits.
module.exports = function benchmarkOutput(filename, libraries = [], loadedFiles = []) {
  if (filename === null || filename === undefined) {
    return null;
  }
  const output = path.resolve(filename);
  const outputStat = fs.statSync(output, { throwIfNoEntry: false, bigint: true });
  const inputs = new Set([...inputFiles(), ...loadedFiles]);
  for (const library of libraries) {
    inputs.add(library.entry);
    if (library.manifest) {
      inputs.add(library.manifest);
    }
  }
  for (const input of inputs) {
    const inputStat = fs.statSync(input, { throwIfNoEntry: false, bigint: true });
    if (
      output === path.resolve(input) ||
      (outputStat && inputStat && outputStat.dev === inputStat.dev && outputStat.ino === inputStat.ino)
    ) {
      throw new Error('Benchmark report would overwrite an input: ' + input);
    }
  }
  return output;
};

// Memory measurements load comparator dependencies in separate processes.
module.exports.inputFiles = inputFiles;
