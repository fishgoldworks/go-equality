'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { examples } = require('../test/helpers/documentation');
const instrument = require('../test/helpers/instrumentExample');

function browserExamples(readme, metadata) {
  const prefix = 'https://cdn.jsdelivr.net/npm/' + metadata.name + '@' + metadata.version + '/dist/';
  const blocks = examples({ 'README.md': readme }, 'html');
  assert.ok(blocks.length > 0, 'README must contain a browser example');
  return Object.fromEntries(
    ['go-equality.js', 'go-equality.min.js'].map((filename) => [
      filename,
      blocks.map(({ code }) => {
        let external = 0;
        let assertions = 0;
        const html = code.replace(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g, (_, src, body) => {
          if (src) {
            assert.ok(
              [prefix + 'go-equality.js', prefix + 'go-equality.min.js'].includes(src),
              'Browser example must use the candidate CDN URL: ' + src
            );
            external++;
            return '<script src="' + prefix + filename + '"></script>';
          }
          const checked = instrument(body);
          assertions += checked.assertions;
          return '<script>' + checked.source + '</script>';
        });
        assert.equal(external, 1, 'Browser example must load exactly one candidate bundle');
        assert.ok(assertions > 0, 'Browser example must contain result assertions');
        return { html, assertions, url: prefix + filename };
      })
    ])
  );
}

module.exports = browserExamples;
if (require.main === module) {
  const { readme, metadata } = JSON.parse(fs.readFileSync(0, 'utf8'));
  process.stdout.write(JSON.stringify(browserExamples(readme, metadata)));
}
