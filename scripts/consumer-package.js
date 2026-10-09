'use strict';
const runCleanups = require('./cleanup');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run, describeTarball } = require('./release-tools');
const { packageRoot } = require('./package-layout');

// Both copied build output and installed tarballs resolve by package name from
// outside the checkout. No contributor dependencies can supply missing files.
function createConsumer(candidate) {
  if (!candidate && !fs.statSync(path.join(packageRoot, 'package.json'), { throwIfNoEntry: false })?.isFile()) {
    throw new Error('Missing consumer package; run npm run build first.');
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'go-equality-consumer-'));
  const cleanup = () => fs.rmSync(directory, { recursive: true, force: true });
  try {
    const consumer = path.join(directory, 'consumer');
    fs.mkdirSync(consumer);
    fs.writeFileSync(
      path.join(consumer, 'package.json'),
      JSON.stringify({ name: 'go-equality-consumer-smoke', version: '1.0.0', private: true })
    );
    const entry = path.join(consumer, 'node_modules/go-equality');
    if (candidate) {
      if (!process.env.npm_execpath) {
        throw new Error('Run this command through npm.');
      }
      run(
        process.execPath,
        [
          process.env.npm_execpath,
          'install',
          '--offline',
          '--ignore-scripts',
          '--no-audit',
          '--no-fund',
          '--package-lock=false',
          '--cache',
          path.join(directory, 'cache'),
          candidate.tarball
        ],
        consumer
      );
      if (describeTarball(candidate.tarball).sha256 !== candidate.sha256) {
        throw new Error('Candidate changed during installation.');
      }
    } else {
      fs.mkdirSync(path.dirname(entry), { recursive: true });
      fs.cpSync(packageRoot, entry, { recursive: true });
    }
    return { consumer, entry, cleanup };
  } catch (error) {
    runCleanups([cleanup], [error]);
  }
}
module.exports = createConsumer;
