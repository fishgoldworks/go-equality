'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const metadata = require('../package.json');
const api = require('../index.js');
const render = (...args) => require('../scripts/docs')(...args);
const template = () => fs.readFileSync(path.join(root, 'scripts/README.template.md'), 'utf8');

test('README matches its documentation sources', () => {
  const expected = render(template(), metadata, api);
  assert.equal(
    fs.readFileSync(path.join(root, 'README.md'), 'utf8').replace(/\r\n/g, '\n'),
    expected,
    'Run npm run docs after editing the template, API or package metadata.'
  );
});

test('documentation generation updates current metadata and preserves release history', () => {
  const updated = {
    ...metadata,
    version: '9.8.7',
    engines: { node: '>=24.0.0' },
    devDependencies: { ...metadata.devDependencies, typescript: '9.0.0' }
  };
  const result = render(template(), updated, api);
  assert.match(result, /[-*+]\s+\*\*version\*\*:\s+9\.8\.7/);
  assert.match(result, /Node\.js \*\*24\.0\.0 or later\*\*/);
  assert.match(result, /pinned TypeScript 9\.0\.0/);
  assert.match(result, /All \*\*7 public call forms\*\*/);
  assert.match(result, /docs-7%20call%20forms-blue/);
  assert.match(result, /Version 2\.0\.0 includes grouped modes/);
});

test('documentation generation rejects missing, duplicate and undocumented call forms', () => {
  assert.throws(
    () => render(template().replace('#### isEqual.custom', '#### missing'), metadata, api),
    /public call forms/
  );
  assert.throws(
    () => render(template().replace('#### isEqual.custom', '#### isEqual.strict'), metadata, api),
    /public call forms/
  );
  assert.throws(() => render(template(), metadata, { ...api, isNewFunction() {} }), /public call forms/);
});

test('generated contents use duplicate anchors and ignore fenced headings', () => {
  const extra =
    '```text\n### Invisible heading\n```\n\n~~~text\n### Another invisible heading\n~~~\n\n### Repeated heading\n\n### Repeated heading\n\n';
  const result = render(template().replace('## License', extra + '## License'), metadata, api);
  assert.match(result, /\[Parameters\]\(#parameters-6\)/);
  assert.match(result, /\[Examples\]\(#examples-6\)/);
  assert.match(result, /\[Repeated heading\]\(#repeated-heading\)/);
  assert.match(result, /\[Repeated heading\]\(#repeated-heading-1\)/);
  assert.doesNotMatch(result, /\[Invisible heading\]|\[Another invisible heading\]/);
  assert.ok(result.includes(extra), 'Source prose and fenced examples must be preserved.');
});

test('documentation generation rejects unresolved template fields', () => {
  assert.throws(() => render(template() + '\n{{UNKNOWN_FIELD}}\n', metadata, api), /Unknown template field/);
});
