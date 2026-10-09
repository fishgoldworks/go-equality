'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

function run(command, args, cwd = root, env = process.env, inherit = false) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: inherit ? 'inherit' : 'pipe'
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      'Command failed (' +
        (result.signal || result.status) +
        '): ' +
        command +
        '\n' +
        (result.stdout || '') +
        (result.stderr || '')
    );
  }
  return result.stdout;
}

function runNpm(args, inherit = false) {
  if (!process.env.npm_execpath) {
    throw new Error('Run this command through npm.');
  }
  return run(process.execPath, [process.env.npm_execpath, ...args], root, process.env, inherit);
}

function describeTarball(filename, checkRecordedDigest = true) {
  const tarball = path.resolve(filename);
  if (!fs.existsSync(tarball) || !fs.statSync(tarball).isFile()) {
    throw new Error('Tarball does not exist: ' + tarball);
  }
  const sha256 = createHash('sha256').update(fs.readFileSync(tarball)).digest('hex');
  if (checkRecordedDigest && fs.existsSync(tarball + '.sha256')) {
    const recorded = fs
      .readFileSync(tarball + '.sha256', 'utf8')
      .trim()
      .split(/\s+/)[0];
    if (recorded !== sha256) {
      throw new Error('Tarball SHA-256 does not match its recorded digest: ' + tarball);
    }
  }
  return { tarball, sha256 };
}

module.exports = { describeTarball, run, runNpm };
