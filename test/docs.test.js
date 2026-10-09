'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const api = require('./helpers/api');

const root = path.resolve(__dirname, '..');
const { readDocuments, examples: extractExamples, checkLinks, bindImports } = require('./helpers/documentation');
const documents = readDocuments(root);
const readme = documents['README.md'];
const reference = documents['docs/API.md'];
const examples = extractExamples(documents);
const names = ['isEqual', 'isLooseEqual', 'isStrictEqual'];
const documented = [...names, 'isEqual.strict', 'isEqual.loose', 'isEqual.custom', 'isEqual.create'];
const instrument = require('./helpers/instrumentExample');

// Check both documents against the source, bundles or installed API selected by the runner.
for (const { file, index, code } of examples) {
  test(file + ' executable JavaScript block ' + (index + 1), () => {
    const { source, assertions } = instrument(code);
    assert.ok(assertions > 0, 'Each example must state at least one checked result');
    vm.runInNewContext(
      bindImports(source),
      { __api: api, Equality: api, assert },
      { filename: file + ' example ' + (index + 1), timeout: 5000 }
    );
  });
}

test('README links every public function to the full API documentation', () => {
  assert.match(readme, /^# Go Equality$/m);
  assert.match(readme, /^## Installation$/m);
  assert.match(readme, /^## Usage$/m);
  assert.match(readme, /^### ES modules$/m);
  assert.match(readme, /^### CommonJS$/m);
  assert.match(readme, /^### Browser$/m);
  assert.match(readme, /^## API summary$/m);
  assert.doesNotMatch(readme, /#api-reference|^## API reference$|^### API summary$/m);
  assert.match(readme, /^## Contents$/m);
  for (const heading of [
    '## API summary',
    '### Supported types',
    '#### Value and structural comparison',
    '#### Typed arrays',
    '#### Identity-only comparison',
    '#### When custom comparison is useful'
  ]) {
    assert.ok(reference.includes('\n' + heading + '\n'), 'Missing reference section: ' + heading);
  }
  assert.match(reference, /^## Equality$/m);
  assert.doesNotMatch(readme, /^#### isEqual/m);
  assert.match(readme, /^\|\s+API\s+\|\s+Description\s+\|\s+Returns\s+\|$/m);
  const summary = readme.split('## API summary\n')[1].split('## Behaviour\n')[0];
  for (const name of documented) {
    assert.ok(summary.includes('[`' + name + '('), name + ' must have a linked summary row');
    const row = summary.split('\n').find((line) => line.includes('[`' + name + '('));
    assert.match(row, /\]\(docs\/API\.md#/);
  }
  assert.match(readme, /docs-100%25-brightgreen/);
  assert.match(readme, /^## Further reading$/m);
  assert.match(readme, /^## Licence$/m);
  for (const name of documented) {
    const escapedName = name.replaceAll('.', '\\.');
    const section = reference.match(
      new RegExp('^### `' + escapedName + '\\([^\\n]*\\)`\\n([\\s\\S]*?)(?=^#{1,3} |$(?![\\s\\S]))', 'm')
    );
    assert.ok(section, name + ' must have a signature heading and function reference');
    assert.match(section[1], /^\*\*Parameters\*\*$/m);
    if (name !== 'isEqual.create') {
      assert.match(section[1], /^\|\s+`value`\s+\|\s+`unknown`\s+\|/m);
      assert.match(section[1], /^\|\s+`other`\s+\|\s+`unknown`\s+\|/m);
    }
    if (name === 'isEqual.custom' || name === 'isEqual.create') {
      assert.match(section[1], /^\|\s+`customizer`\s+\|\s+`EqualityCustomizer`\s+\|/m);
      assert.match(section[1], /^\|\s+`options\?`\s+\|\s+`EqualityOptions`\s+\|\s+`undefined`\s+\|/m);
    }
    assert.match(section[1], /^\*\*Examples\*\*$/m);
    assert.match(
      section[1],
      name === 'isEqual.create' ? /\*\*Returns:\*\* `EqualityComparator`/ : /\*\*Returns:\*\* `boolean`/
    );
    assert.match(section[1], /\*\*Notes\*\*/);
    assert.match(section[1], /\/\/ => true/);
    assert.match(section[1], /\/\/ => false/);
  }
});

test('Documentation assertion count and release metadata are consistent', () => {
  assert.ok(examples.length >= 32);
  const assertions = examples.reduce((sum, { code }) => sum + instrument(code).assertions, 0);
  assert.ok(assertions >= 130, 'Do not silently stop executing documented examples');
  const pkg = require('../package.json');
  const lock = require('../package-lock.json');
  assert.match(
    readme,
    new RegExp(
      '^[-*+]\\s+\\*\\*Version:\\*\\* \\[' + pkg.version.replaceAll('.', '\\.') + '\\]\\(CHANGELOG\\.md\\)$',
      'm'
    )
  );
  assert.match(readme, /^[-*+]\s+\*\*Licence:\*\* \[MIT\]\(LICENSE\.md\)$/m);
  assert.equal(pkg.version, lock.version);
  assert.equal(pkg.version, lock.packages[''].version);
  assert.equal(pkg.license, 'MIT');
  assert.equal(pkg.license, lock.packages[''].license);
  assert.deepEqual(pkg.engines, lock.packages[''].engines);
  assert.deepEqual(Object.keys(api).sort(), names);
});

test('README and API links resolve across documents, including target anchors', () => {
  checkLinks(root, documents);
});

test('the full reference inventories each exported TypeScript type', () => {
  const declarations = fs.readFileSync(path.join(root, 'index.d.ts'), 'utf8');
  const exported = [...declarations.matchAll(/^export (?:type|interface) (\w+)/gm)].map((match) => match[1]);
  const section = reference.split('## TypeScript types\n')[1]?.split('\n## ')[0];
  assert.ok(section, 'Document the type-only exports in the full API reference.');
  const entries = [...section.matchAll(/^\|\s+`(\w+)`\s+\|/gm)].map((match) => match[1]);
  assert.deepEqual(entries.sort(), exported.sort(), 'Every exported type must have exactly one table entry.');
  assert.match(readme, /\]\(docs\/API\.md#typescript-types\)/);
});

test('editor tooltip reference links target current API anchors', () => {
  const links = [];
  const publicFiles = [
    'index.d.ts',
    'src/isEqual.js',
    'src/isLooseEqual.js',
    'src/isStrictEqual.js',
    'src/customEquality.js'
  ];
  const referenceLink = /@see https:\/\/github\.com\/koyote130708\/go-equality\/blob\/master\/docs\/API\.md#([^\s*]+)/g;
  for (const file of publicFiles) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const matches = [...text.matchAll(referenceLink)];
    assert.ok(matches.length > 0, file + ': public tooltips must link to the full reference.');
    for (const [, fragment] of matches) {
      links.push('[' + file + '](docs/API.md#' + fragment + ')');
    }
  }
  checkLinks(root, { 'README.md': links.join('\n') });
});
