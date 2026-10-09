'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const documentFiles = ['README.md', 'docs/API.md'];
function readDocuments(root) {
  return Object.fromEntries(
    documentFiles.map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n')])
  );
}
// Scan standalone fenced blocks once so example selection and link checking agree.
// This is the documentation's fenced-block subset, not a complete Markdown parser.
function fencedBlocks(text) {
  const result = [];
  let block = null;
  let offset = 0;
  for (const line of text.match(/[^\n]*(?:\n|$)/g) || []) {
    const content = line.replace(/\r?\n$/, '');
    if (block) {
      if (block.close.test(content)) {
        block.end = offset + line.length;
        result.push(block);
        block = null;
      } else {
        block.code += line.replace(block.dedent, '');
      }
    } else {
      const opening = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(content);
      if (opening && !(opening[2][0] === '`' && opening[3].includes('`'))) {
        block = {
          start: offset,
          end: text.length,
          language: opening[3].trim().split(/\s+/)[0],
          code: '',
          close: new RegExp('^ {0,3}' + opening[2][0] + '{' + opening[2].length + ',}[ \t]*$'),
          dedent: new RegExp('^ {0,' + opening[1].length + '}')
        };
      }
    }
    offset += line.length;
  }
  if (block) {
    result.push(block);
  }
  return result;
}
function examples(documents, language = '(?:js|javascript)') {
  const selected = new RegExp('^(?:' + language + ')$');
  return Object.entries(documents).flatMap(([file, text]) =>
    fencedBlocks(text)
      .filter((block) => selected.test(block.language))
      .map((block, index) => ({ file, index, code: block.code }))
  );
}
function withoutCode(text) {
  for (const block of fencedBlocks(text).reverse()) {
    text = text.slice(0, block.start) + text.slice(block.end);
  }
  return text;
}
function anchors(text) {
  const result = new Set();
  const used = new Map();
  for (const [, heading] of withoutCode(text).matchAll(/^#{1,6} (.+)$/gm)) {
    const base = heading
      .toLowerCase()
      .replace(/[`*]/g, '')
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/ /g, '-');
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    result.add(base + (count ? '-' + count : ''));
  }
  return result;
}
function checkLinks(root, documents) {
  for (const [file, text] of Object.entries(documents)) {
    for (const [, target] of withoutCode(text).matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(?:https?:|mailto:)/.test(target)) {
        continue;
      }
      const [relative, fragment] = target.split('#');
      const destination = relative ? path.resolve(root, path.dirname(file), relative) : path.join(root, file);
      assert.ok(fs.existsSync(destination), file + ': missing linked file ' + target);
      if (fragment) {
        assert.ok(anchors(fs.readFileSync(destination, 'utf8')).has(fragment), file + ': unknown anchor ' + target);
      }
    }
  }
}
function bindImports(code) {
  let bound = false;
  let source = code.replace(/^import (?:\* as )?(\w+) from 'go-equality';$/gm, (_, alias) => {
    bound = true;
    return `const ${alias} = __api;`;
  });
  source = source.replace(/^import \{([^}]+)\} from 'go-equality';$/gm, (_, imports) => {
    bound = true;
    return `const {${imports}} = __api;`;
  });
  source = source.replace(/require\('go-equality'\)/g, () => {
    bound = true;
    return '__api';
  });
  assert.doesNotMatch(source, /\b(?:import\s|require\s*\()/, 'Unsupported import in executable example');
  return (bound ? '' : 'const { isEqual, isLooseEqual, isStrictEqual } = __api;\n') + source;
}
module.exports = { documentFiles, readDocuments, examples, checkLinks, bindImports };
