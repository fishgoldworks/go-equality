import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import imports from 'eslint-plugin-import-x';
import noOnlyTests from 'eslint-plugin-no-only-tests';
import globals from 'globals';
import { createRequire } from 'node:module';
import path from 'node:path';
import tseslint from 'typescript-eslint';

const require = createRequire(import.meta.url);
const resolver = require.resolve('eslint-import-resolver-typescript');
const typescriptParser = createRequire(require.resolve('typescript-eslint/package.json')).resolve(
  '@typescript-eslint/parser'
);
const javascriptFiles = ['**/*.{js,jsx,mjs,cjs}'];
const typescriptFiles = ['**/*.{ts,tsx,mts,cts}'];
const developmentFiles = [
  '**/*.{test,spec,stories}.*',
  '**/{test,tests,__tests__,__mocks__,.storybook}/**',
  '**/*.{config,setup}.{js,cjs,mjs,ts,cts,mts}',
  '**/scripts/**'
];
const developmentImports = [
  '**/*.test',
  '**/*.spec',
  '**/*.stories',
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.stories.*',
  '**/test/**',
  '**/tests/**',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/.storybook/**'
];
const productionRules = {
  'no-restricted-imports': [
    'error',
    { patterns: [{ group: developmentImports, message: 'Keep production contracts with their production owner.' }] }
  ],
  'no-restricted-modules': ['error', { patterns: developmentImports }]
};

export default [
  {
    ignores: [
      'package/**',
      'artifacts/**',
      '.go-equality-build-*/**',
      'coverage/**',
      '.tmp/**',
      'src/temp/**',
      'nbproject/**'
    ]
  },
  { ...prettier, files: [...javascriptFiles, ...typescriptFiles] },
  {
    files: [...javascriptFiles, ...typescriptFiles],
    languageOptions: { ecmaVersion: 'latest', parserOptions: { ecmaFeatures: { jsx: true } } },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { 'import-x': imports },
    settings: {
      'import-x/extensions': ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'],
      'import-x/resolver': { [resolver]: { alwaysTryTypes: false } }
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': ['error', { typeof: true }],
      'no-unused-vars': ['error', { args: 'all', argsIgnorePattern: '^_', caughtErrors: 'all' }],
      'no-unused-expressions': ['error', { enforceForJSX: true }],
      'no-var': 'error',
      'prefer-const': 'error',
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-throw-literal': 'error',
      'import-x/no-unresolved': ['error', { commonjs: true, caseSensitive: true, caseSensitiveStrict: true }],
      'import-x/no-duplicates': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-extraneous-dependencies': ['error', { devDependencies: developmentFiles }]
    }
  },
  {
    files: javascriptFiles,
    rules: {
      'import-x/no-extraneous-dependencies': ['error', { devDependencies: [...developmentFiles, 'benchmarks/**'] }]
    }
  },
  { files: javascriptFiles, ignores: [...developmentFiles, 'benchmarks/**'], rules: productionRules },
  { files: typescriptFiles, ignores: developmentFiles, rules: productionRules },
  {
    files: [
      'index.js',
      'src/**/*.js',
      'scripts/**/*.js',
      'test/*.test.js',
      'test/{compatibility,data,helpers,package}/**/*.js',
      'benchmarks/**/*.js'
    ],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' }
  },
  { files: ['*.config.mjs'], languageOptions: { globals: globals.nodeBuiltin } },
  { files: ['test/browser/**/*.js'], languageOptions: { globals: globals.browser, sourceType: 'script' } },
  {
    files: ['test/**/*.js', 'scripts/test*.js'],
    plugins: { 'no-only-tests': noOnlyTests },
    rules: {
      'no-only-tests/no-only-tests': [
        'error',
        { block: ['describe', 'it', 'test', 'suite'], functions: ['fit', 'fdescribe'] }
      ]
    }
  },
  ...tseslint.config({
    files: typescriptFiles,
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    settings: {
      'import-x/parsers': { [typescriptParser]: ['.ts', '.tsx', '.mts', '.cts'] },
      'import-x/resolver': { [resolver]: { project: path.join(import.meta.dirname, 'tsconfig.json') } }
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-unused-expressions': 'off',
      'no-throw-literal': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { args: 'all', argsIgnorePattern: '^_', caughtErrors: 'all' }],
      '@typescript-eslint/no-unused-expressions': ['error', { enforceForJSX: true }],
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: false }],
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/only-throw-error': 'error'
    }
  })
];
