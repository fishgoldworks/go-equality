'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const name = require('../package.json').name;

function fixture(run) {
    const prefix = path.join(os.tmpdir(), name + '-build-test-');
    const directory = fs.mkdtempSync(prefix);
    try {
        for (const file of ['package.json', 'LICENSE.md', 'index.js', 'index.mjs', 'index.d.ts', 'src', 'scripts']) {
            const source = path.join(root, file);
            if (fs.existsSync(source)) fs.cpSync(source, path.join(directory, file), {recursive:true});
        }
        fs.mkdirSync(path.join(directory, 'dist'));
        fs.writeFileSync(path.join(directory, 'dist', 'previous.txt'), 'previous distribution');
        fs.writeFileSync(path.join(directory, 'inject.cjs'), `
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const terser = require('terser');
const mode = process.env.GO_LIBRARY_TEST_FAILURE;
if (mode === 'rollback-cleanup') {
    const fail = target => {
        if (path.dirname(target) === __dirname && path.basename(target).startsWith('.go-')) {
            throw Object.assign(Error('Injected cleanup failure at ' + target), {code:'EACCES'});
        }
    };
    const remove = fs.rmSync;
    fs.rmSync = (target, options) => { fail(target); return remove(target, options); };
    const removeAsync = fsp.rm;
    fsp.rm = async (target, options) => { fail(target); return removeAsync(target, options); };
}
if (mode === 'minify' || mode === 'smoke') {
    const minify = () => {
        if (mode === 'minify') throw Error('Injected minifier failure');
        return {code:'throw Error("Injected smoke failure");', map:'{}'};
    };
    terser.minify = async () => minify();
    terser.minify_sync = minify;
}
if (mode === 'replace' || mode.startsWith('rollback')) {
    let failed = false;
    const fail = target => {
        if ((!failed || mode.startsWith('rollback')) && path.resolve(target) === path.join(__dirname, 'dist')) {
            failed = true;
            throw Object.assign(Error('Injected replacement failure'), {code:'EACCES'});
        }
    };
    const rename = fs.renameSync;
    fs.renameSync = (from, to) => { fail(to); return rename(from, to); };
    const renameAsync = fsp.rename;
    fsp.rename = async (from, to) => { fail(to); return renameAsync(from, to); };
}
`);
        const build = (mode, args = []) => spawnSync(process.execPath,
            ['--require', path.join(directory, 'inject.cjs'), path.join(directory, 'scripts', 'build.js'), ...args], {
                cwd:directory, encoding:'utf8', timeout:30000,
                env:{...process.env, NODE_PATH:path.join(root, 'node_modules'), GO_LIBRARY_TEST_FAILURE:mode}
            });
        run(directory, build);
        assert.deepEqual(fs.readdirSync(directory).filter(file => file.startsWith('.' + name + '-build-')), [], 'Temporary build directories must be cleaned');
    } finally {
        assert.ok(path.resolve(directory).startsWith(path.resolve(prefix)), 'Cleanup must stay in the owned fixture directory');
        fs.rmSync(directory, {recursive:true, force:true});
    }
}

function assertPreserved(directory, result) {
    assert.ifError(result.error);
    assert.notEqual(result.status, 0, 'An unsuccessful build must fail');
    assert.deepEqual(fs.readdirSync(path.join(directory, 'dist')), ['previous.txt']);
    assert.equal(fs.readFileSync(path.join(directory, 'dist', 'previous.txt'), 'utf8'), 'previous distribution');
}

for (const mode of ['minify', 'smoke', 'replace']) {
    test(mode + ' failure preserves the previous distribution', () => fixture((directory, build) => {
        assertPreserved(directory, build(mode));
    }));
}
for (const mode of ['bundle', 'minify']) {
    test('removed ' + mode + ' mode fails without changing the distribution', () => fixture((directory, build) => {
        const result = build('', [mode]);
        assertPreserved(directory, result);
        assert.match(result.stderr, /Usage: node scripts\/build\.js/);
    }));
}
test('one build replaces stale output with the complete distribution', () => fixture((directory, build) => {
    const result = build('');
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const expected = ['go-equality.js', 'go-equality.min.js'];
    assert.deepEqual(fs.readdirSync(path.join(directory, 'dist')).sort(), expected.sort());
}));

for (const mode of ['rollback', 'rollback-cleanup']) test(mode + ' failure retains a recoverable previous distribution', () => fixture((directory, build) => {
    const result = build(mode);
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    const backups = fs.readdirSync(directory).filter(file => file.startsWith('.' + name + '-build-') && file.endsWith('-previous'));
    assert.equal(backups.length, 1);
    const backup = path.join(directory, backups[0]);
    assert.equal(fs.readFileSync(path.join(backup, 'previous.txt'), 'utf8'), 'previous distribution');
    assert.ok(result.stderr.includes(backup), 'Failure must identify the retained backup');
    assert.ok(!fs.existsSync(path.join(directory, 'dist')));
    // Demonstrate that the reported backup can be restored once the filesystem permits it.
    fs.renameSync(backup, path.join(directory, 'dist'));
    if (mode === 'rollback-cleanup') {
        const staging = backup.slice(0, -'-previous'.length);
        assert.ok(result.stderr.includes('cleanup also failed at ' + staging), 'Failure must also identify the staging directory');
        assert.equal(path.dirname(staging), directory);
        fs.rmSync(staging, {recursive:true, force:true});
    }
}));
test('a clean checkout can build without an existing distribution', () => fixture((directory, build) => {
    fs.unlinkSync(path.join(directory, 'dist', 'previous.txt'));
    fs.rmdirSync(path.join(directory, 'dist'));
    const result = build('');
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(fs.existsSync(path.join(directory, 'dist', name + '.js')));
    assert.ok(fs.existsSync(path.join(directory, 'dist', name + '.min.js')));
}));
