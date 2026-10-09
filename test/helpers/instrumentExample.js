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
    const expected = /^(?:=>\s*)?(?:(true|false)|throws (TypeError|RangeError|Error))$/.exec(comment.value.trim());
    if (!expected) {
      assert.ok(!comment.value.trim().startsWith('=>'), 'Unsupported result annotation: ' + comment.value.trim());
      continue;
    }
    const statement = statements.find(
      (node) => node.end <= comment.start && code.slice(node.end, comment.start).trim() === ''
    );
    assert.ok(statement, 'A result annotation must follow a checked expression statement.');
    // Insert around the expression rather than replacing a whole statement:
    // sequence expressions keep their grouping and nested annotations keep their edits.
    edits.push(
      { start: statement.expression.start, text: expected[2] ? 'assert.throws(() => (' : 'assert.equal((' },
      {
        start: statement.expression.end,
        text: expected[2] ? `), { name: '${expected[2]}' })` : `), ${expected[1]})`
      }
    );
  }
  let source = code;
  for (const edit of edits.sort((left, right) => right.start - left.start)) {
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.start);
  }
  return { source, assertions: edits.length / 2 };
}

module.exports = instrumentExample;
