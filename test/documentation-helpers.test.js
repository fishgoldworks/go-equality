'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { examples, checkLinks } = require('./helpers/documentation');
const instrument = require('./helpers/instrumentExample');

const fences = [
  ['plain JavaScript', '```javascript', '```'],
  ['short language', '```js', '```'],
  ['trailing spaces', '```javascript  ', '```'],
  ['space before language', '``` javascript', '```'],
  ['tilde fence', '~~~javascript', '~~~'],
  ['longer fence and closing fence', '````javascript', '`````'],
  ['language metadata', '```javascript title="example"', '```'],
  ['indented fence', '  ```javascript', '   ```']
];
for (const [name, open, close] of fences) {
  test('executable example extraction recognises ' + name, () => {
    const text = open + '\nfalse; // => true\n' + close + '\n';
    const found = examples({ 'README.md': text });
    assert.equal(found.length, 1, 'The example must not disappear from verification');
    assert.equal(found[0].code, 'false; // => true\n');
    assert.throws(() => vm.runInNewContext(instrument(found[0].code).source, { assert }), {
      name: 'AssertionError'
    });
    vm.runInNewContext(instrument(found[0].code.replace('=> true', '=> false')).source, { assert });
  });
}

test('code content loses only the indentation supplied by its opening fence', () => {
  const text = '   ~~~js\n   true; // => true\n  false; // => false\n     // keep two spaces\n~~~\n';
  assert.equal(examples({ readme: text })[0].code, 'true; // => true\nfalse; // => false\n  // keep two spaces\n');
});

test('code-looking fences inside another code block are not executable examples', () => {
  const text = [
    '````markdown',
    '```javascript',
    'false; // => true',
    '```',
    '````',
    '~~~javascript',
    'true; // => true',
    '~~~',
    ''
  ].join('\n');
  const found = examples({ readme: text });
  assert.equal(found.length, 1);
  assert.equal(found[0].code, 'true; // => true\n');
});

test('closing fences must match kind and length and cannot contain metadata', () => {
  const content = 'alpha\n```\n~~~~\n```` trailing-text\nomega\n';
  const found = examples({ readme: '````javascript\n' + content + '`````\n' });
  assert.equal(found.length, 1);
  assert.equal(found[0].code, content);
});

test('an unclosed executable fence extends to the end instead of silently disappearing', () => {
  const found = examples({ readme: '```javascript\nfalse; // => true' });
  assert.equal(found.length, 1);
  assert.equal(found[0].code, 'false; // => true');
});

test('HTML selection and JavaScript indices remain independent within each document', () => {
  const documents = {
    'README.md': '~~~html\n<script></script>\n~~~\n```js\ntrue; // => true\n```\n',
    'docs/API.md': '```javascript\nfalse; // => false\n```\n'
  };
  assert.deepEqual(
    examples(documents).map(({ file, index }) => [file, index]),
    [
      ['README.md', 0],
      ['docs/API.md', 0]
    ]
  );
  assert.equal(examples(documents, 'html')[0].code, '<script></script>\n');
});

test('fenced links and headings do not create false documentation anchors', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-equality-doc-helper-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const text = '# Real\n\n  ~~~~text\n# Fake\n[example](absent.md)\n~~~~~\n\n[valid](#real)\n';
  fs.writeFileSync(path.join(root, 'README.md'), text);
  checkLinks(root, { 'README.md': text });
  assert.throws(() => checkLinks(root, { 'README.md': text + '[invalid](#fake)\n' }), /unknown anchor/);
  assert.throws(() => checkLinks(root, { 'README.md': text + '[invalid](absent.md)\n' }), /missing linked file/);
});
