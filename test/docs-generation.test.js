'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const metadata = require('../package.json');
const api = require('../index.js');
const render = (...args) => require('../scripts/docs')(...args);
const templates = () =>
  Object.fromEntries(
    ['README', 'API'].map((name) => [name, fs.readFileSync(path.join(root, 'scripts', name + '.template.md'), 'utf8')])
  );

test('both documents match their maintained sources', () => {
  for (const [file, expected] of Object.entries(render(templates(), metadata, api))) {
    assert.equal(
      fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n'),
      expected,
      'Run npm run docs after editing documentation sources.'
    );
  }
});

test('generation updates both documents and preserves release history', () => {
  const updated = {
    ...metadata,
    version: '9.8.7',
    devDependencies: { ...metadata.devDependencies, typescript: '9.0.0' }
  };
  const result = render(templates(), updated, api, { node: '>=24.0.0' });
  const readme = result['README.md'];
  assert.match(readme, /[-*+]\s+\*\*Version:\*\* \[9\.8\.7\]\(CHANGELOG\.md\)/);
  assert.match(result['docs/API.md'], /\[go-equality 9\.8\.7\]\(\.\.\/CHANGELOG\.md\)/);
  assert.match(readme, /CommonJS\s+\|\s+Node\.js 24\.0\.0 or later/);
  assert.match(readme, /Contributor checks use TypeScript 9\.0\.0/);
  assert.match(readme, /docs-100%25-brightgreen/);
  const migration = templates().README.split('## Migration\n')[1].split('\n## ')[0];
  assert.ok(readme.includes(migration), 'Current metadata must not rewrite the documented upgrade history.');
});

test('one API summary source produces links appropriate to each document', () => {
  const sources = templates();
  sources.API = sources.API.replace(
    'Checks whether two values are deeply equal. Primitive wrappers are compared by their contained values. For example, `new Number(1)` is considered equal to the primitive number `1`.',
    'Updated summary description.'
  );
  const result = render(sources, metadata, api);
  for (const text of Object.values(result)) {
    assert.match(text, /Updated summary description\./);
  }
  assert.match(result['README.md'], /\[`isEqual\(value, other\)`\]\(docs\/API\.md#isequalvalue-other\)/);
  assert.match(result['docs/API.md'], /\[`isEqual\(value, other\)`\]\(#isequalvalue-other\)/);
  assert.doesNotMatch(result['README.md'], /^#### isEqual/m);
  const contents = result['README.md'].split('## Contents\n')[1].split('## Installation\n')[0];
  assert.match(contents, /- \[API summary\]\(#api-summary\)/);
  for (const [, target] of contents.matchAll(/\]\(([^)]+)\)/g)) {
    assert.ok(target.startsWith('#'), 'Contents must link within the current document: ' + target);
  }
  const introduction = result['README.md'].split('## Contents\n')[0];
  const summary = result['README.md'].split('## API summary\n')[1].split('\n## ')[0];
  assert.match(introduction, /\*\*\[View full API documentation\]\(docs\/API\.md\)\*\*/);
  assert.match(summary, /\*\*\[full API documentation\]\(docs\/API\.md\)\*\*/);
  assert.doesNotMatch(result['docs/API.md'], /\]\(docs\/API\.md\)/);
});

test('generation rejects missing, duplicate and undocumented API entries', () => {
  for (const replacement of ['### `missing', '### `isEqual.strict']) {
    const sources = templates();
    sources.API = sources.API.replace('### `isEqual.custom', replacement);
    assert.throws(() => render(sources, metadata, api), /public call forms/);
  }
  assert.throws(() => render(templates(), metadata, { ...api, isNewFunction() {} }), /public call forms/);
});

test('generation rejects incomplete summaries and missing or duplicated summary fields', () => {
  const sources = templates();
  sources.API = sources.API.replace(/^\| \[`isEqual\.custom[^\n]+\n/m, '');
  assert.throws(() => render(sources, metadata, api), /summary must cover all public call forms/);
  for (const replacement of ['', '{{API_SUMMARY}}\n{{API_SUMMARY}}']) {
    const sources = templates();
    sources.README = sources.README.replace('{{API_SUMMARY}}', replacement);
    assert.throws(() => render(sources, metadata, api), /exactly one API summary field/);
  }
});

test('both contents use duplicate anchors and ignore fenced headings', () => {
  const extra =
    '```text\n### Invisible heading\n```\n\n~~~text\n### Another invisible heading\n~~~\n\n## Repeated heading\n\n## Repeated heading\n\n';
  const sources = templates();
  for (const name of Object.keys(sources)) {
    sources[name] += '\n' + extra;
  }
  for (const result of Object.values(render(sources, metadata, api))) {
    assert.match(result, /\[API summary\]\(#api-summary\)/);
    assert.doesNotMatch(result, /\[Parameters\]|\[Examples\]|\[isEqual\(/);
    assert.match(result, /\[Repeated heading\]\(#repeated-heading\)/);
    assert.match(result, /\[Repeated heading\]\(#repeated-heading-1\)/);
    assert.doesNotMatch(result, /\[Invisible heading\]|\[Another invisible heading\]/);
    assert.ok(result.includes(extra), 'Source prose and fenced examples must be preserved.');
  }
});

test('generation rejects unresolved fields in either source', () => {
  for (const name of ['README', 'API']) {
    const sources = templates();
    sources[name] += '\n{{UNKNOWN_FIELD}}\n';
    assert.throws(() => render(sources, metadata, api), /Unknown template field/);
  }
});

test('generation requires signatures in API headings', () => {
  const sources = templates();
  sources.API = sources.API.replace('### `isEqual(value, other)`', '### `isEqual`');
  assert.throws(() => render(sources, metadata, api), /headings must include a signature/);
});

test('strict and loose aliases share complete entries without duplicate summary rows', () => {
  const documents = render(templates(), metadata, api);
  for (const text of Object.values(documents)) {
    const summary = text.split('## API summary\n')[1].split('\n## ')[0];
    assert.equal([...summary.matchAll(/^\| \[`/gm)].length, 5);
    assert.doesNotMatch(text, /^### `(?:isLooseEqual|isStrictEqual)\(/m);
  }
  assert.match(documents['docs/API.md'], /import \{ isEqual, isLooseEqual \} from 'go-equality';/);
  assert.match(documents['docs/API.md'], /import \{ isEqual, isStrictEqual \} from 'go-equality';/);
});

test('generation rejects undocumented, duplicate and incorrect alias mappings', () => {
  for (const name of ['isLooseEqual', 'isStrictEqual']) {
    const note = '**Direct import:** You can also import this function as `' + name + '` from `go-equality`.';
    for (const replacement of ['', note + '\n' + note]) {
      const sources = templates();
      sources.API = sources.API.replace(note, replacement);
      assert.throws(() => render(sources, metadata, api), /public call forms/);
    }
    assert.throws(() => render(templates(), metadata, { ...api, [name]: () => true }), /same function/);
    const sources = templates();
    sources.API = sources.API.replace('[`' + name + '`]', '[`missingAlias`]');
    assert.throws(() => render(sources, metadata, api), /summary must cover all public call forms/);
  }
});
