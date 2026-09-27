import { javascript, developmentFiles } from '@fishgold/eslint-config';
import { browser, node } from '@fishgold/eslint-config/environments';
import { tests } from '@fishgold/eslint-config/tests';
import { typescript } from '@fishgold/eslint-config/typescript';

export default [
  { ignores: ['dist/**', 'coverage/**', 'vendor/**', '.tmp/**', 'nbproject/**'] },
  ...javascript({ devFiles: [...developmentFiles, 'benchmarks/**'] }),
  node({
    files: [
      'index.js',
      'src/**/*.js',
      'scripts/**/*.js',
      'test/*.test.js',
      'test/{data,helpers}/**/*.js',
      'benchmarks/**/*.js'
    ],
    commonjs: true
  }),
  node({ files: ['*.config.mjs'] }),
  browser({ files: ['test/browser/**/*.js'] }),
  { files: ['test/browser/**/*.js'], languageOptions: { sourceType: 'script' } },
  ...tests({ runner: 'node', files: ['test/**/*.js', 'scripts/test*.js'] }),
  ...typescript({ tsconfigRootDir: import.meta.dirname })
];
