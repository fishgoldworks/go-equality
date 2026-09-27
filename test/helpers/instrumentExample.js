'use strict';
const assert = require('node:assert/strict');
const { parse } = require('acorn');

// Associate annotations with parsed expressions, including multiline calls.
function instrumentExample(code) {
  const comments = [];
  const tree = parse(code, { ecmaVersion: 'latest', sourceType: 'module', onComment: comments });
  const statements = [];
  const pending = [tree];
  while (pending.length) {
    const node = pending.pop();
    if (node.type === 'ExpressionStatement') {
      statements.push(node);
    }
    for (const value of Object.values(node)) {
      const children = Array.isArray(value) ? value : [value];
      for (const child of children) {
        if (child && typeof child === 'object' && typeof child.type === 'string') {
          pending.push(child);
        }
      }
    }
  }
  const edits = [];
  for (const comment of comments) {
    const expected = /^(?:(?:=>\s*)?(true|false)|throws (TypeError|RangeError|Error))$/.exec(comment.value.trim());
    if (!expected) {
      continue;
    }
    const statement = statements.find(
      (node) => node.end <= comment.start && code.slice(node.end, comment.start).trim() === ''
    );
    assert.ok(statement, 'A result annotation must follow a checked expression statement.');
    const expression = code.slice(statement.expression.start, statement.expression.end);
    const replacement = expected[2]
      ? `assert.throws(() => (${expression}), { name: '${expected[2]}' });`
      : `assert.equal(${expression}, ${expected[1]});`;
    edits.push({ start: statement.start, end: statement.end, replacement });
  }
  let source = code;
  for (const edit of edits.sort((left, right) => right.start - left.start)) {
    source = source.slice(0, edit.start) + edit.replacement + source.slice(edit.end);
  }
  return { source, assertions: edits.length };
}

module.exports = instrumentExample;
