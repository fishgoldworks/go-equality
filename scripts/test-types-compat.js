'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const settings = {
  name: 'go-equality',
  package: 'package',
  groups: [['contracts', ['require.cts', 'consumer.ts', 'default-import.ts'], 'ES2020']],
  exportsOnly: false,
  indexChecks: false,
  emit: 'default-import.ts'
};

// Keep the current compiler's complete module/emit suite in test-types.js.
// This runner reuses its contracts in an isolated legacy consumer, including
// rejection assertions on compilers predating @ts-expect-error (TypeScript 3.9).
function check({
  compiler = require.resolve('typescript/lib/tsc.js'),
  directory = path.join(root, settings.package)
} = {}) {
  const compilerRoot = path.resolve(compiler, '../..');
  const ts = require(path.join(compilerRoot, 'lib/typescript.js'));

  const version = ts.versionMajorMinor.split('.').map(Number);
  const atLeast = (major, minor) => version[0] > major || (version[0] === major && version[1] >= minor);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), settings.name + '-typescript-'));
  try {
    const installed = path.join(temporary, 'node_modules', settings.name);
    fs.mkdirSync(installed, { recursive: true });
    // Copy only consumer files when this library publishes its repository root.
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    const entries =
      settings.package === '.'
        ? [...manifest.files, 'package.json', 'README.md', 'LICENSE']
        : fs.readdirSync(directory);
    for (const entry of entries) {
      const from = path.join(directory, entry);
      if (fs.existsSync(from)) {
        fs.cpSync(from, path.join(installed, entry), { recursive: true });
      }
    }
    fs.writeFileSync(path.join(temporary, 'package.json'), '{"private":true}');
    let checked = 0;
    let rejected = 0;
    for (const [group, names, lib, mode] of settings.groups) {
      if (mode === 'NodeNext' && !atLeast(4, 7)) {
        continue;
      }
      if (mode === 'Bundler' && !atLeast(5, 0)) {
        continue;
      }
      const folder = path.join(temporary, group);
      fs.mkdirSync(folder);
      const expectations = new Map();
      const files = [];
      for (const name of names) {
        let source = fs.readFileSync(path.join(root, 'test/types', name), 'utf8');

        // Type-only import markers affect emit, not these compile-only assertions.
        if (!atLeast(4, 5)) {
          source = source.replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, (statement) =>
            statement.replace(/\btype /g, '')
          );
        }

        source = source.replace(/@ts-expect-error/g, '@expected-error');
        const filename = path.join(folder, mode ? name : name.replace(/\.[cm]ts$/, '.ts'));
        const lines = source.split(/\r?\n/);
        lines.forEach((line, index) => {
          if (!/^\s*\/\/\s*@expected-error\b/.test(line)) {
            return;
          }
          let next = index + 1;
          while (next < lines.length && /^\s*(\/\/.*)?$/.test(lines[next])) {
            next++;
          }
          expectations.set(filename.replace(/\\/g, '/') + ':' + (next + 1), false);
        });
        fs.writeFileSync(filename, source);
        files.push(filename);
      }
      const options = {
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: [],
        target: lib === 'ES5' ? 'ES5' : atLeast(3, 8) ? 'ES2020' : 'ESNext',
        lib: [lib === 'ES2020' && !atLeast(3, 8) ? 'ESNext' : lib],
        module: mode === 'Bundler' ? 'ESNext' : mode || (settings.exportsOnly ? 'NodeNext' : 'commonjs'),
        moduleResolution: mode || (settings.exportsOnly ? 'NodeNext' : 'node'),
        esModuleInterop: true
      };
      if (atLeast(4, 1)) {
        options.noUncheckedIndexedAccess = true;
      }
      if (atLeast(4, 4)) {
        options.exactOptionalPropertyTypes = true;
        options.useUnknownInCatchVariables = true;
      }
      if (atLeast(4, 2) && settings.indexChecks) {
        options.noPropertyAccessFromIndexSignature = true;
      }
      for (const exact of atLeast(4, 4) ? [false, true] : [undefined]) {
        if (exact !== undefined) {
          options.exactOptionalPropertyTypes = exact;
        }
        for (const location of expectations.keys()) {
          expectations.set(location, false);
        }
        const parsed = ts.parseJsonConfigFileContent({ compilerOptions: options, files }, ts.sys, temporary);
        const program = ts.createProgram(parsed.fileNames, parsed.options);
        const unexpected = [
          ...parsed.errors,
          ...program.getOptionsDiagnostics(),
          ...program.getGlobalDiagnostics(),
          ...program.getSyntacticDiagnostics()
        ];
        for (const diagnostic of program.getSemanticDiagnostics()) {
          const key =
            diagnostic.file &&
            diagnostic.file.fileName.replace(/\\/g, '/') +
              ':' +
              (diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1);
          if (key && expectations.has(key)) {
            expectations.set(key, true);
          } else {
            unexpected.push(diagnostic);
          }
        }
        const missing = [...expectations].filter(([, hit]) => !hit).map(([location]) => location);
        const diagnostics = ts.formatDiagnostics(unexpected, {
          getCanonicalFileName: (f) => f,
          getCurrentDirectory: () => temporary,
          getNewLine: () => '\n'
        });
        assert.equal(
          unexpected.length + missing.length,
          0,
          diagnostics + '\nExpected a rejected call at:\n' + missing.join('\n')
        );
      }
      checked += files.length;
      rejected += expectations.size;
    }
    if (settings.emit) {
      const filename = path.join(temporary, 'emitted.ts');
      fs.copyFileSync(path.join(temporary, 'contracts', settings.emit.replace(/\.[cm]ts$/, '.ts')), filename);
      execFileSync(
        process.execPath,
        [
          compiler,
          '--strict',
          '--skipLibCheck',
          'false',
          '--target',
          'ES2017',
          '--module',
          'commonjs',
          '--moduleResolution',
          'node',
          '--esModuleInterop',
          '--outDir',
          path.join(temporary, 'output'),
          filename
        ],
        { cwd: temporary, stdio: 'inherit' }
      );
      execFileSync(process.execPath, [path.join(temporary, 'output/emitted.js')], { cwd: temporary, stdio: 'inherit' });
    }
    console.log(
      'TypeScript ' +
        ts.version +
        ': ' +
        checked +
        ' shared consumer fixtures and ' +
        rejected +
        ' required rejections passed (strict, skipLibCheck=false, types=[]).'
    );
  } finally {
    const resolved = path.resolve(temporary);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith(settings.name + '-typescript-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

module.exports = check;
if (require.main === module) {
  const options = {};
  const args = process.argv.slice(2);
  while (args.length) {
    const flag = args.shift();
    if (!['--compiler', '--package'].includes(flag) || !args.length) {
      throw new Error(
        'Usage: node scripts/test-types-compat.js [--compiler path/to/tsc.js] [--package built-or-installed-package]'
      );
    }
    options[flag === '--compiler' ? 'compiler' : 'directory'] = path.resolve(args.shift());
  }
  check(options);
}
