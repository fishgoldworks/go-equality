'use strict';

// Fixtures are created outside the timed loops. Each public comparison gets
// fresh per-call bookkeeping; the fixture graphs themselves remain unchanged.
function chain(depth, value = 1) {
  let root = { value };
  for (let i = 0; i < depth; i++) {
    root = { next: root };
  }
  return root;
}
function cycle(size, change = false) {
  const nodes = Array.from({ length: size }, (_, i) => ({ value: i }));
  nodes.forEach((node, i) => {
    node.next = nodes[(i + 1) % size];
  });
  if (change) {
    nodes[size - 1].value = -1;
  }
  return nodes[0];
}
const cases = [
  ['primitive equal', () => [123, 123]],
  ['primitive unequal', () => [123, 456, false]],
  [
    'same reference',
    () => {
      const a = { x: 1 };
      return [a, a];
    }
  ],
  ['primitive type mismatch', () => [12, '12', false]],
  ['boxed number', () => [Object(123), Object(123)]],
  [
    'flat object, 4 properties',
    () => [
      { id: 1, name: 'Ada', active: true, rank: null },
      { id: 1, name: 'Ada', active: true, rank: null }
    ]
  ],
  [
    'flat object, reversed key order',
    () => [
      { a: 1, b: 2, c: 3 },
      { c: 3, b: 2, a: 1 }
    ]
  ],
  ['flat object, early mismatch', () => [{ a: 1, b: 2 }, { a: 9, b: 2 }, false]],
  [
    'nested application data',
    () => {
      const a = {
        id: 3,
        user: { name: 'Ada', active: true },
        items: Array.from({ length: 10 }, (_, i) => ({ id: i, tags: ['a', 'b'], value: i * 2 }))
      };
      return [a, structuredClone(a)];
    }
  ],
  [
    'primitive array, 1000',
    () => [Array.from({ length: 1000 }, (_, i) => i), Array.from({ length: 1000 }, (_, i) => i)]
  ],
  [
    'object array, 4000',
    () => [Array.from({ length: 4000 }, (_, i) => ({ i })), Array.from({ length: 4000 }, (_, i) => ({ i }))]
  ],
  [
    'object array, 16000',
    () => [Array.from({ length: 16000 }, (_, i) => ({ i })), Array.from({ length: 16000 }, (_, i) => ({ i }))]
  ],
  ['deep chain, 20000', () => [chain(20000), chain(20000)]],
  ['deep unequal chain, 20000', () => [chain(20000), chain(20000, 2), false]],
  ['cyclic list, 1000', () => [cycle(1000), cycle(1000)]],
  ['cyclic unequal list, 1000', () => [cycle(1000), cycle(1000, true), false]],
  [
    'primitive set reversed, 16000',
    () => [
      new Set(Array.from({ length: 16000 }, (_, i) => i)),
      new Set(Array.from({ length: 16000 }, (_, i) => 15999 - i))
    ]
  ],
  [
    'primitive set mismatch, 1000',
    () => [
      new Set(Array.from({ length: 1000 }, (_, i) => i)),
      new Set(Array.from({ length: 1000 }, (_, i) => i + 1)),
      false
    ]
  ],
  [
    'structural set reversed, 100',
    () => [
      new Set(Array.from({ length: 100 }, (_, i) => ({ i }))),
      new Set(Array.from({ length: 100 }, (_, i) => ({ i: 99 - i })))
    ]
  ],
  [
    'primitive map reversed, 4000',
    () => [
      new Map(Array.from({ length: 4000 }, (_, i) => [i, i * 2])),
      new Map(Array.from({ length: 4000 }, (_, i) => [3999 - i, (3999 - i) * 2]))
    ]
  ],
  [
    'object-valued primitive-key map, 1000',
    () => [
      new Map(Array.from({ length: 1000 }, (_, i) => [i, { value: i }])),
      new Map(Array.from({ length: 1000 }, (_, i) => [999 - i, { value: 999 - i }]))
    ]
  ],
  [
    'structural map reversed, 100',
    () => [
      new Map(Array.from({ length: 100 }, (_, i) => [{ i }, i])),
      new Map(Array.from({ length: 100 }, (_, i) => [{ i: 99 - i }, 99 - i]))
    ]
  ],
  [
    'structural set reversed, 1000',
    () => [
      new Set(Array.from({ length: 1000 }, (_, id) => ({ id }))),
      new Set(Array.from({ length: 1000 }, (_, i) => ({ id: 999 - i })))
    ]
  ],
  [
    'structural map reversed, 1000',
    () => [
      new Map(Array.from({ length: 1000 }, (_, id) => [{ id }, id])),
      new Map(Array.from({ length: 1000 }, (_, i) => [{ id: 999 - i }, 999 - i]))
    ]
  ],
  ['Date', () => [new Date(123), new Date(123)]],
  ['RegExp', () => [/example/giu, /example/giu]],
  ['Float64Array, 16000', () => [new Float64Array(16000).fill(1.5), new Float64Array(16000).fill(1.5)]],
  ['ArrayBuffer, 65536 bytes', () => [new ArrayBuffer(65536), new ArrayBuffer(65536)]],
  [
    'loose primitive set reversed, 4000',
    () => [
      new Set(Array.from({ length: 4000 }, (_, i) => i)),
      new Set(Array.from({ length: 4000 }, (_, i) => 3999 - i))
    ],
    'isLooseEqual'
  ],
  [
    'strict object array, 4000',
    () => [Array.from({ length: 4000 }, (_, i) => ({ i })), Array.from({ length: 4000 }, (_, i) => ({ i }))],
    'isStrictEqual'
  ]
];
module.exports = cases.map(([name, make, method = 'isEqual']) => ({ name, make, method }));
