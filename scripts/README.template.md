# Go Equality

**Check whether two JavaScript values are equal.**

[![Source line coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](#development)
[![Documentation](https://img.shields.io/badge/docs-100%25-brightgreen.svg)](docs/API.md)

- **Version:** [{{VERSION}}](CHANGELOG.md)
- **Licence:** [{{LICENSE}}](LICENSE.md)

Use `isEqual(value, other)` to compare primitives and the nested contents of arrays and supported objects. Separate instances can compare equal even when they do not share a reference. Choose `isEqual.strict()` or `isEqual.loose()` to control how type differences are handled.

For values that need their own comparison rules, use `isEqual.custom()` for an individual comparison or `isEqual.create()` to create a reusable comparison function. Your callback handles those values while the library compares the surrounding structure.

Circular references, `Date`, `RegExp`, `Map`, `Set`, typed arrays and binary buffers are supported. See [supported types](#supported-types) for their comparison rules and limitations.

No runtime dependencies. TypeScript declarations included.

**[View full API documentation](docs/API.md)**

## Contents

{{TOC}}

## Installation

Using npm:

```sh
npm install go-equality
```

Using Yarn:

```sh
yarn add go-equality
```

### Runtime support

| Environment | Requirement                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| CommonJS    | Node.js {{NODE_MIN_VERSION}} or later through the package root or function subpaths.                                                   |
| ES modules  | Native default and named imports work on Node.js 14.13.0 or later, or Node.js 12.20.0+ within 12.x, through CommonJS interoperability. |
| Browser     | ES2017 syntax plus `Map`, `Set`, `Symbol`, `Reflect.ownKeys` and `Reflect.apply`.                                                      |

- **Optional features:** BigInt, BigInt typed arrays, `SharedArrayBuffer` and newer regular-expression flags depend on the runtime. Their absence does not stop the package loading or comparing unrelated values. See [native capabilities](docs/API.md#native-runtime-capabilities) for the comparison rules when a feature is unavailable.
- **Polyfills:** The library does not install global polyfills.
- **Browser modules:** There is no standalone browser ES module build; use the [browser bundles](#browser).

For host Buffers passed into a Node VM or sandbox, follow the [Buffer setup requirements](docs/API.md#instance-equality-hooks) before loading the library.

## Usage

### ES modules

<!-- prettier-ignore -->
```javascript
import { isEqual } from 'go-equality';

isEqual({ user: { id: 1 } }, { user: { id: 1 } });   // => true
isEqual({ user: { id: 1 } }, { user: { id: 2 } });   // => false

isEqual(1, '1');                                     // => false
isEqual.strict(1, '1');                              // => false
isEqual.loose(1, '1');                               // => true
```

`isEqual` can also be imported with `import isEqual from 'go-equality/isEqual'`. The `isStrictEqual` and `isLooseEqual` subpaths follow the same pattern.

### CommonJS

<!-- prettier-ignore -->
```javascript
const { isEqual } = require('go-equality');

isEqual({ id: 1 }, { id: 1 });                       // => true
isEqual({ id: 1 }, { id: 2 });                       // => false
```

### Browser

Load Go Equality from jsDelivr or host a bundle yourself:

- [Minified bundle](https://cdn.jsdelivr.net/npm/{{NAME}}@{{VERSION}}/dist/go-equality.min.js)
- [Readable bundle](https://cdn.jsdelivr.net/npm/{{NAME}}@{{VERSION}}/dist/go-equality.js)

The bundle exposes `goEquality`:

<!-- prettier-ignore -->
```html
<script src="https://cdn.jsdelivr.net/npm/{{NAME}}@{{VERSION}}/dist/go-equality.min.js"></script>
<script>
  const { isEqual } = goEquality;

  isEqual({ id: 1 }, { id: 1 });   // => true
  isEqual({ id: 1 }, { id: 2 });   // => false
</script>
```

Both bundles are included under `dist/` in the npm package and support CommonJS and AMD loaders. The minified bundle includes a source map to the readable bundle.

**Import notes:** Function subpaths provide the same functions as the root imports, including `isEqual`'s attached methods. They support default and named ES module imports; CommonJS `require('go-equality/isEqual')` returns the function directly. Internal `src/` paths remain private. See [TypeScript](#typescript) for declarations and typing behaviour.

## API summary

See the **[full API documentation](docs/API.md)** for parameters,
return values, errors and examples.

The **fallback mode** supplies the standard comparison rules used when your customiser returns `undefined`. Set it with `options.mode`.

{{API_SUMMARY}}

## Behaviour

### Comparison modes

Every mode compares the contents of arrays and supported objects, including nested values. Choose how primitive types and wrapper objects should be handled:

- **Default:** compare primitive wrappers by the values they contain. For example, `new Number(1)` is considered equal to the primitive number `1`.
- **Strict:** preserve primitive types. `new Number(1)` differs from the primitive number `1`, while two `Number` objects containing `1` can compare equal.
- **Loose:** also allow primitive conversions, such as `1` matching `'1'`, including inside nested data.

A **primitive wrapper** is an object containing a primitive value. For example, `new Number(1)` creates a `Number` object containing the primitive number `1`. **Unboxed** below means that only the contained primitive value is compared. **Coercion** means converting primitive values for comparison.

| Rule                         | Default: `isEqual` | Strict: `isEqual.strict` | Loose: `isEqual.loose` |
| ---------------------------- | ------------------ | ------------------------ | ---------------------- |
| Primitive types              | Must match         | Must match               | May coerce             |
| Primitive wrappers           | Unboxed            | Preserved                | Unboxed                |
| Ordinary object constructors | Must match         | Must match               | Ignored                |

<!-- prettier-ignore -->
```javascript
isEqual(new Number(1), 1);                     // => true
isEqual.strict(new Number(1), 1);              // => false
isEqual.strict(new Number(1), new Number(1));  // => true
isEqual.loose(1, '1');                         // => true
```

In every mode, `NaN` equals `NaN`, and positive and negative zero are equal. Loose mode does not convert arbitrary objects to primitives.

Default and strict modes also check `constructor` values. See the [full comparison rules](docs/API.md#comparison-rules) for constructor checks and the custom rules that can override standard comparison.

### Supported types

Supported objects also compare their own properties, subject to the exceptions below.

- **Primitive values:** Compare values using the selected default, strict or loose mode. Symbols match by identity.
- **Ordinary objects:** Compare their own properties and nested values.
- **`Array`:** Compare elements in order. An empty slot differs from an element containing `undefined`.
- **`Date`:** Compare timestamps. Two invalid dates compare equal.
- **`RegExp`:** Compare the pattern, flags and `lastIndex`.
- **`Map`:** Compare key/value pairs regardless of insertion order.
- **`Set`:** Compare members regardless of insertion order.
- **Custom class instances:** Compare their own properties. Private fields are not inspected automatically.
- **Typed arrays:** Compare element types, lengths and values.
- **Node.js `Buffer`:** Compare byte values.
- **`ArrayBuffer`:** Compare byte contents.
- **`SharedArrayBuffer`:** Compare byte contents. Shared backing memory must remain unchanged during comparison.
- **`DataView`:** Compare the bytes inside the view, rather than the entire backing buffer.
- **Primitive wrappers:** Compare the contained primitive values; strict mode also compares their own properties.
- **`arguments` objects:** Compare indexed values, length and custom own properties.
- **Objects without a prototype:** Compare the own properties of objects created with `Object.create(null)`.

Own properties belong directly to an object rather than being inherited. Non-enumerable and symbol-keyed properties are included. Arrays and supported built-ins also compare extra own properties, with exceptions for primitive wrappers and `arguments` objects.

Each `Map` entry or `Set` member must match a separate entry or member in the other collection.

**Compared by reference only:** `Promise`, `WeakMap`, `WeakSet`, functions and other unsupported values normally require the same reference. A custom equality rule can change this behaviour.

Circular references are supported. A shared child object can match separate child objects with the same contents. See the [supported-type tables](docs/API.md#supported-types) for the complete rules and [runtime support](#runtime-support) for optional native features.

### Custom equality

Use `isEqual.custom()` to compare values with your own rule, or `isEqual.create()` to save the rule for repeated comparisons. The callback, called a **customiser**, can handle particular values and leave others to standard comparison.

Ignore letter case when comparing strings; compare booleans normally:

<!-- prettier-ignore -->
```javascript
import { isEqual } from 'go-equality';

function ignoreCase(left, right) {
  if (typeof left === 'string' && typeof right === 'string') {
    return left.toLowerCase() === right.toLowerCase();
  }

  return undefined;
}

const saved = { search: 'Laptop', inStockOnly: true };
const current = { search: 'laptop', inStockOnly: true };
const changed = { search: 'laptop', inStockOnly: false };
const sameFilters = isEqual.create(ignoreCase);

isEqual(saved, current);                     // => false
isEqual.custom(saved, current, ignoreCase);  // => true
sameFilters(saved, current);                 // => true
sameFilters(saved, changed);                 // => false
```

| Customiser result | Effect on the current pair                                        |
| ----------------- | ----------------------------------------------------------------- |
| `true`            | Treat the pair as equal without comparing its nested values.      |
| `false`           | Treat the pair as unequal; do not use standard comparison for it. |
| `undefined`       | Continue with the selected standard comparison mode.              |

- The customiser runs before standard comparison and object `equals()` methods.
- Return `true`, `false` or `undefined` synchronously, and leave the inputs unchanged.
- Give a consistent answer for the same pair during one comparison.
- The customiser may run multiple times during one comparison. Each result applies to the current pair of values.
- It is not guaranteed to receive every nested value and receives no property name or path. Do not rely on the number or order of calls.

The example's rule applies to every string pair it receives. Use a separate comparison function when rules differ by field.

Pass `{ mode: 'strict' }` or `{ mode: 'loose' }` as the options argument to `isEqual.custom()` or `isEqual.create()` to choose the standard rules used when the callback returns `undefined`. The default is `'default'`.

See [custom equality](docs/API.md#custom-equality) for callback validation and how custom rules interact with object `equals()` methods.

### Errors and supported inputs

- Value mismatches return `false`.
- Invalid customisers, options, callback results or `equals()` results throw `TypeError`.
- Errors thrown while reading inputs or running user code are passed to the caller.
- Compared data must have a finite structure and remain unchanged during comparison, including shared backing memory. Circular references are supported.

Proxy targets are not unwrapped. See [errors and supported inputs](docs/API.md#errors-and-supported-inputs) for proxy behaviour, binary-view errors and the complete input requirements.

## TypeScript

TypeScript declarations are included; no separate `@types` package is required.

Comparison functions accept two `unknown` values and return `boolean`. They do not narrow the inputs as TypeScript type guards. `isEqual.create()` returns a reusable function with the same input and return types.

Consumer declarations support TypeScript 3.0 or later. Additional module-resolution requirements are:

- **Node16/NodeNext:** TypeScript 4.7 or later.
- **Bundler:** TypeScript 5.0 or later.

Named imports from function subpaths require Node16, NodeNext or Bundler resolution. With legacy `node` resolution, use named root imports or default subpath imports. Default subpath imports need `esModuleInterop` for CommonJS output, or `allowSyntheticDefaultImports` for ES module output.

See [TypeScript types](docs/API.md#typescript-types) for the comparator, customiser, mode and options declarations, and [Usage](#usage) for imports.

Customisers are called without an object bound as `this`. Bind callbacks that need `this`, or wrap the method call in an arrow function; see [caller customisers](docs/API.md#caller-customisers).

## Performance

Custom comparisons run your callback before built-in equality checks. They can take longer than standard comparisons, especially for large `Map` and `Set` values.

`isEqual.create()` checks the callback and options once. Each call still compares the values and runs your callback.

Large `Map` or `Set` values with many possible matches can require substantial time and memory. Memory use can grow with the square of the collection size. Deep nesting is supported, but comparisons have no fixed time or memory budget.

The library does not change inputs or cache comparison results between calls. See the [benchmark and memory guide](https://github.com/fishgoldworks/go-equality/blob/master/docs/development.md#benchmarks-and-memory) for measurements and limits.

## Migration

When upgrading from 1.0.4:

- **Imports:** Import `isEqual`, `isLooseEqual` and `isStrictEqual` from `go-equality`. Replace imports from internal `src/` paths; those paths are no longer public. Existing root calls remain supported.
- **Browser global:** Replace `Equality` with `goEquality`, for example `const { isEqual } = goEquality;`.
- **Instance hooks:** Make custom instance `equals()` methods return `true` or `false`. Either method can reject the comparison, and both must accept it to bypass the normal structural checks. For a partial rule that delegates to the library, use `isEqual.custom()` and return `undefined` when your rule does not apply.
- **Comparison changes:** Review comparisons that depend on loose object coercion, wrapper objects, sparse arrays, symbols, non-enumerable properties, constructors or `RegExp` `lastIndex`. Version 2 applies the documented rules consistently; loose mode does not call arbitrary object conversion methods. Convert application values explicitly when that is your intended rule.
- **VM Buffers:** When comparing host Buffers inside a Node VM or sandbox, expose the host's trusted `Buffer` constructor before loading the library.
- **Runtime requirements:** Use Node.js 8.0.0 or later for CommonJS. Check [runtime support](#runtime-support) for ES module and browser requirements.

See the [comparison rules](docs/API.md#comparison-rules) and [changelog](CHANGELOG.md) for the complete changes, including cycle and collection matching fixes and the MIT licence for version 2.

## Development

Use npm for development. Contributor tools require Node.js 22.18+ within Node 22, or Node.js 24+; the lint toolchain does not support Node 23. This requirement is separate from [consumer runtime support](#runtime-support). Contributor checks use TypeScript {{TYPESCRIPT_VERSION}}.

```sh
npm ci
npm run build
npm test
```

Edit `scripts/README.template.md` and `scripts/API.template.md`. `npm run build` regenerates `README.md` and `docs/API.md`, then assembles the consumer package under `package/`, including the browser bundles in `package/dist/`. Use `npm run docs` for documentation-only updates.

Run the standard gate with an exact Node.js 8.0.0 consumer executable, while keeping the command itself on a supported contributor Node version:

```sh
npm run verify -- --node /path/to/node-8.0.0
```

`npm run verify` checks lint, formatting, generated documentation, source coverage, declarations, build recovery, package contents and installed consumers. `npm run verify:all` adds Chromium, Firefox and WebKit checks against the same archive, including the browser bundles and README example.

See the [development guide](https://github.com/fishgoldworks/go-equality/blob/master/docs/development.md) for browser setup, exact-runtime selection, build recovery, release verification and local package installation. [Code quality](https://github.com/fishgoldworks/go-equality/blob/master/docs/code-quality.md) explains the shared tooling and formatting rules.

The coverage badge measures executable source-line coverage. The documentation badge measures public API reference coverage. Neither badge guarantees correctness for every input. See the [test coverage map](https://github.com/fishgoldworks/go-equality/blob/master/docs/test-coverage.md) for the contracts and checks behind these figures.

## Further reading

- [Full API documentation](docs/API.md): signatures, parameters, examples and behavioural contracts.
- [Changelog](CHANGELOG.md): release changes and migration from version 1.
- [Development guide](https://github.com/fishgoldworks/go-equality/blob/master/docs/development.md): contributor setup, verification, release and benchmark procedures.
- [Engine design](https://github.com/fishgoldworks/go-equality/blob/master/docs/design.md): comparison internals and optimisation constraints.
- [Test coverage map](https://github.com/fishgoldworks/go-equality/blob/master/docs/test-coverage.md): contracts, regression suites and known limits.

## Licence

Licensed under the [{{LICENSE}} licence](LICENSE.md).
