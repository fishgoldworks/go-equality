'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const api = require('./helpers/api');

const modes = [
  ['default', api.isEqual],
  ['loose', api.isLooseEqual],
  ['strict', api.isStrictEqual]
];
const forms = ['custom', 'create'];

function customised(mode, form, customizer) {
  return form === 'create'
    ? api.isEqual.create(customizer, { mode })
    : (left, right) => api.isEqual.custom(left, right, customizer, { mode });
}

function both(compare, left, right, expected, label) {
  assert.equal(compare(left, right), expected, label + ': forward');
  assert.equal(compare(right, left), expected, label + ': reverse');
}

function collection(kind, entries) {
  return kind === 'Set' ? new Set(entries) : new Map(entries.map((key) => [key, 'value']));
}

// Rows 0..n-2 can use their own column or the next one. The final row can
// use only column 0, so success needs one path moving all earlier matches.
function chainEdge(row, column, size, broken) {
  if (row === size - 1) {
    return column === 0;
  }
  return column === row || (column === row + 1 && !(broken && row === size - 2));
}

function hookChain(size, broken) {
  class Atom {
    constructor(side, id) {
      this.side = side;
      this.id = id;
    }

    equals(other) {
      if (!(other instanceof Atom) || this.side === other.side) {
        return false;
      }
      const row = this.side === 'left' ? this.id : other.id;
      const column = this.side === 'left' ? other.id : this.id;
      return chainEdge(row, column, size, broken);
    }
  }
  return [
    Array.from({ length: size }, (_, id) => new Atom('left', id)),
    Array.from({ length: size }, (_, id) => new Atom('right', id))
  ];
}

for (const [mode, compare] of modes) {
  for (const kind of ['Set', 'Map']) {
    test(mode + ': ' + kind + ' repairs long assignments across rejection-storage boundaries', () => {
      for (const size of [9, 65, 66, 129]) {
        for (const broken of [false, true]) {
          const [left, right] = hookChain(size, broken);
          const a = collection(kind, left);
          const b = collection(kind, right);
          both(compare, a, b, !broken, 'size ' + size + ', broken ' + broken);
          both(compare, a, collection(kind, right.slice().reverse()), !broken, 'permuted size ' + size);
        }
      }
    });
  }

  for (const form of forms) {
    for (const kind of ['Set', 'Map']) {
      test(mode + '/' + form + ': ' + kind + ' reassigns native-preferred members after callback vetoes', () => {
        for (const size of [9, 65, 66, 129]) {
          const members = Array.from({ length: size }, (_, id) => Object.freeze({ id }));
          let broken = false;
          const configured = customised(mode, form, (left, right) => {
            if (!members.includes(left) || !members.includes(right)) {
              return undefined;
            }
            return chainEdge(left.id, right.id, size, broken);
          });
          const left = collection(kind, members);
          const right = collection(kind, members.slice().reverse());
          both(configured, left, right, true, 'native preferred size ' + size);
          broken = true;
          both(configured, left, right, false, 'missing final column size ' + size);
          broken = false;
          both(configured, left, right, true, 'independent retry size ' + size);
        }
      });
    }

    test(mode + '/' + form + ': Map keys and values need the same entry assignment', () => {
      const keys = [
        { role: 'key', id: 0 },
        { role: 'key', id: 1 }
      ];
      const values = [
        { role: 'value', id: 0 },
        { role: 'value', id: 1 }
      ];
      const left = new Map(keys.map((key, i) => [key, values[i]]));
      const right = new Map(keys.map((key, i) => [key, values[i]]));
      let keyMode = 'identity';
      const configured = customised(mode, form, (a, b) => {
        if (keys.includes(a) && keys.includes(b)) {
          return keyMode === 'any' || a.id === b.id;
        }
        if (values.includes(a) && values.includes(b)) {
          return a.id !== b.id;
        }
        return undefined;
      });
      // Keys and values each have a perfect matching, but they disagree about
      // which entries to pair. Checking their multisets independently is wrong.
      both(configured, left, right, false, 'incompatible assignments');
      keyMode = 'any';
      both(configured, left, right, true, 'values force crossed native keys');
      right.set(keys[1], values[0]);
      both(configured, left, right, false, 'one value cannot satisfy two entries');
    });
  }

  test(mode + ': mixed primitive Map keys may require a three-entry value permutation', () => {
    const left = new Map([
      [0, 'a'],
      ['', 'b'],
      ['0', 'c']
    ]);
    const right = new Map([
      [0, 'b'],
      ['', 'a'],
      ['0', 'c']
    ]);
    for (const candidate of [
      compare,
      customised(mode, 'custom', () => undefined),
      customised(mode, 'create', () => undefined)
    ]) {
      both(candidate, left, right, mode === 'loose', 'permitted conversion');
      // The key and value multisets are unchanged, but matching 'b' now needs
      // the unequal string pair ''/'0'. Loose string comparison is not numeric.
      const impossible = new Map([
        [0, 'a'],
        ['', 'c'],
        ['0', 'b']
      ]);
      both(candidate, left, impossible, false, 'incompatible string keys');
    }
  });

  test(mode + ': primitive NaN keys retain native preference when other keys need unboxing', () => {
    const left = new Map([
      [NaN, 'native'],
      [Object(NaN), 'boxed'],
      [null, 'nullish']
    ]);
    const right = new Map([
      [Object(NaN), 'native'],
      [NaN, 'boxed'],
      [null, 'nullish']
    ]);
    both(compare, left, right, mode !== 'strict', 'crossed primitive and wrapper');
    right.set(NaN, 'native');
    both(compare, left, right, false, 'equal keys cannot conceal a missing value');
  });

  for (const kind of ['Set', 'Map']) {
    test(mode + ': ' + kind + ' rejects a dense Hall-deficient relation with no empty row or column', () => {
      const size = 66;
      let cut = 33;
      class Atom {
        constructor(side, id) {
          this.side = side;
          this.id = id;
        }

        equals(other) {
          if (!(other instanceof Atom) || this.side === other.side) {
            return false;
          }
          const row = this.side === 'left' ? this.id : other.id;
          const col = this.side === 'left' ? other.id : this.id;
          return row < cut === col < 33;
        }
      }
      const left = collection(
        kind,
        Array.from({ length: size }, (_, id) => new Atom('left', id))
      );
      const right = collection(
        kind,
        Array.from({ length: size }, (_, id) => new Atom('right', id))
      );
      both(compare, left, right, true, 'two balanced blocks');
      cut = 34;
      both(compare, left, right, false, '34 members compete for 33 candidates');
      cut = 33;
      both(compare, left, right, true, 'restored relation on a later call');
    });
  }

  test(mode + ': a single Map entry observes independent deferred key and value failures', () => {
    const make = (key, value) => new Map([[{ child: { key } }, { child: { value } }]]);
    for (const candidate of [
      compare,
      customised(mode, 'custom', () => undefined),
      customised(mode, 'create', () => undefined)
    ]) {
      const left = make(1, 'same');
      both(candidate, left, make(1, 'same'), true, 'both dependencies equal');
      both(candidate, left, make(2, 'same'), false, 'only the key fails');
      both(candidate, left, make(1, 'changed'), false, 'only the value fails');
    }
  });

  test(mode + ': selected Map entries retain both unresolved key and value dependencies', () => {
    const make = (reverse, failKey, failValue) => {
      const parent = new Map();
      const entries = Array.from({ length: 66 }, (_, id) => {
        const key = { parent, child: { id, tag: failKey && id === 32 ? 'wrong' : 'key' } };
        const value = { parent, child: { id, tag: failValue && id === 32 ? 'wrong' : 'value' } };
        return [key, value];
      });
      for (const [key, value] of reverse ? entries.slice().reverse() : entries) {
        parent.set(key, value);
      }
      return parent;
    };
    for (const candidate of [
      compare,
      customised(mode, 'custom', () => undefined),
      customised(mode, 'create', () => undefined)
    ]) {
      const left = make(false, false, false);
      both(candidate, left, make(true, false, false), true, 'equal cyclic entries');
      both(candidate, left, make(true, true, false), false, 'late key mismatch');
      both(candidate, left, make(true, false, true), false, 'late value mismatch');
    }
  });
}
