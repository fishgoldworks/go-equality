# Go Equality

<!-- Comparison draft based on README.md; maintained separately while under review. -->

**Deep equality utilities for JavaScript, with default, strict and loose modes plus custom comparison rules.**

[![Source line coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](#development)
[![Documentation](https://img.shields.io/badge/docs-100%25-brightgreen.svg)](docs/API.md)
[![Donate](https://img.shields.io/badge/donate-blue.svg)](https://www.paypal.com/donate/?business=T7Q29NNMZVW98&no_recurring=0&item_name=Support+Go+Equality&currency_code=USD)

- **Version:** [2.0.0](CHANGELOG.md)
- **Licence:** [MIT](LICENSE.md)

Compare arrays and supported objects by their nested contents, even when they are separate instances. Choose how primitive types and wrappers are treated, or supply a custom comparison rule. Circular references, Dates, regular expressions, Maps, Sets, typed arrays and binary buffers are supported; see [supported types](#supported-types) for their comparison rules.

No runtime dependencies. TypeScript declarations included.

**[View full API documentation](docs/API.md)**

## Contents

- [Installation](#installation)
- [Usage](#usage)
- [API summary](#api-summary)
- [Full API documentation](docs/API.md)
- [Behaviour](#behaviour)
  - [Supported types](#supported-types)
  - [Custom equality](#custom-equality)
- [TypeScript](#typescript)
- [Performance](#performance)
- [Migration](#migration)
- [Development](#development)
- [Further reading](#further-reading)
- [Licence](#licence)

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
| CommonJS    | Node.js 8.0.0 or later through the package root.                                                                                       |
| ES modules  | Native default and named imports work on Node.js 14.13.0 or later, or Node.js 12.20.0+ within 12.x, through CommonJS interoperability. |
| Browser     | ES2017 syntax plus `Map`, `Set`, `WeakMap`, `Symbol`, `Reflect.ownKeys` and `Reflect.apply`.                                           |

BigInt, BigInt typed arrays, `SharedArrayBuffer` and newer regular-expression flags are optional native features. Their absence does not stop the package loading or comparing other values; comparisons involving them require native support. Examples using `1n` require a runtime that can parse bigint literals. The library installs no global polyfills. There is no standalone browser ES module build.

## Usage

### ES modules

<!-- prettier-ignore -->
```javascript
import Eq from 'go-equality';

Eq.isEqual({ id: 1 }, { id: 1 });  // => true
Eq.isLooseEqual(1, '1');           // => true
Eq.isStrictEqual(1, Object(1));    // => false
Eq.isEqual.strict(1, Object(1));   // => false
Eq.isEqual.loose(1, '1');          // => true
```

Or import individual functions:

<!-- prettier-ignore -->
```javascript
import { isEqual, isLooseEqual, isStrictEqual } from 'go-equality';

isEqual({ id: 1 }, { id: 1 });     // => true
isLooseEqual(1, '1');              // => true
isStrictEqual(1, Object(1));       // => false
```

### CommonJS

<!-- prettier-ignore -->
```javascript
const Eq = require('go-equality');

Eq.isEqual([1, 2, 3], [1, 2, 3]);  // => true
Eq.isLooseEqual(null, undefined);  // => true
Eq.isStrictEqual(1, '1');          // => false
```

Or import individual functions:

<!-- prettier-ignore -->
```javascript
const { isEqual, isLooseEqual, isStrictEqual } = require('go-equality');

isEqual([1, 2, 3], [1, 2, 3]);     // => true
isLooseEqual(null, undefined);     // => true
isStrictEqual(1, '1');             // => false
```

### Browser

Serve either included browser bundle from your application. `Set` the script URL to its served location, then alias the global `Equality` object as `Eq`:

<!-- prettier-ignore -->
```html
<script src="dist/go-equality.min.js"></script>
<script>
  const Eq = Equality;

  Eq.isEqual([1, 2, 3], [1, 2, 3]);  // => true
  Eq.isLooseEqual(1, '1');           // => true
  Eq.isStrictEqual(1, Object(1));    // => false
</script>
```

The installed package includes `dist/go-equality.js` and `dist/go-equality.min.js`. Both standalone UMD bundles contain the same implementation and also support AMD loaders. The library makes no external requests.

**Import notes:** Use the package's default export or named root exports. Individual-function subpaths such as `go-equality/isEqual` and `go-equality/src/isEqual.js` are not public entry points. See [TypeScript](#typescript) for declarations and typing behaviour.

## API summary

See the **[full API documentation](docs/API.md)** for parameters,
return values, errors and examples.

| API                                                                                                             | Description                                                                                                                          | Returns                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| [`isEqual(value, other)`](docs/API.md#isequalvalue-other)                                                       | Determines whether two values are deeply equal. Primitive wrappers are compared as their wrapped values.                             | `true` if the values are deeply equal; otherwise `false`.                                                                       |
| [`isLooseEqual(value, other)`](docs/API.md#islooseequalvalue-other)                                             | Determines whether two values are deeply equal, allowing primitive conversions such as `1` matching `'1'`.                           | `true` if the values are deeply equal under loose comparison rules; otherwise `false`.                                          |
| [`isStrictEqual(value, other)`](docs/API.md#isstrictequalvalue-other)                                           | Determines whether two values are deeply equal, preserving primitive types and distinguishing wrapper objects from primitive values. | `true` if the values are deeply equal under strict comparison rules; otherwise `false`.                                         |
| [`isEqual.strict(value, other)`](docs/API.md#isequalstrictvalue-other)                                          | Determines whether two values are deeply equal while preserving primitive types and wrappers. Alias of `isStrictEqual`.              | `true` if the values are deeply equal under strict comparison rules; otherwise `false`.                                         |
| [`isEqual.loose(value, other)`](docs/API.md#isequalloosevalue-other)                                            | Determines whether two values are deeply equal with primitive conversions. Alias of `isLooseEqual`.                                  | `true` if the values are deeply equal under loose comparison rules; otherwise `false`.                                          |
| [`isEqual.custom(value, other, customizer, options?)`](docs/API.md#isequalcustomvalue-other-customizer-options) | Deeply compares two values, using your callback to override individual comparisons.                                                  | `true` if the values are equal under the custom rules and fallback mode; otherwise `false`.                                     |
| [`isEqual.create(customizer, options?)`](docs/API.md#isequalcreatecustomizer-options)                           | Creates a reusable function for deep comparison using your callback and a saved fallback mode.                                       | A reusable function that accepts two values and returns `true` if they are equal under the configured rules; otherwise `false`. |

The attached methods are read-only, non-enumerable properties of `isEqual`. The root export object is not callable. For custom strict or loose comparison, pass `{ mode: 'strict' }` or `{ mode: 'loose' }` to `isEqual.custom()` or `isEqual.create()`.

## Behaviour

### Comparison modes

All three modes compare nested contents of arrays and supported objects, so separate objects can be equal. Choose a mode according to which differences should matter:

- **Default:** compare primitive wrappers by their contained values, so `Object(1)` matches `1`.
- **Loose:** also allow primitive conversions, such as `1` matching `'1'`, including inside nested data.
- **Strict:** preserve primitive types and keep a wrapper distinct from its primitive value. Two wrapper objects can still compare equal.

A **primitive wrapper** is an object holding a primitive value, such as `Object(1)`. **Unboxed** below means that only the contained primitive value is compared. **Coercion** means converting primitive values for comparison.

| Rule                         | Default: `isEqual` | Loose: `isLooseEqual` | Strict: `isStrictEqual` |
| ---------------------------- | ------------------ | --------------------- | ----------------------- |
| Primitive types              | Must match         | May coerce            | Must match              |
| Primitive wrappers           | Unboxed            | Unboxed               | Preserved               |
| Ordinary object constructors | Must match         | Ignored               | Must match              |

In every mode, `NaN` equals `NaN`, and positive and negative zero are equal. Loose mode does not convert arbitrary objects to primitives. Customisers and supported instance hooks can override the standard rules; see the [full comparison rules](docs/API.md#comparison-rules).

### Supported types

- Ordinary objects, arrays, null-prototype dictionaries and custom class instances compare their own properties, including non-enumerable and symbol-keyed properties. Array order matters, and a hole differs from explicit `undefined`.
- Dates, regular expressions, Maps, Sets, typed arrays, Buffers, ArrayBuffers, SharedArrayBuffers and DataViews compare their relevant contents. `Map` and `Set` order does not matter; matching is one-to-one. Regular expressions include `lastIndex`.
- Promises, WeakMaps, WeakSets, functions and other unsupported values normally require the same reference. Private class fields are not inspected automatically.

Circular references are supported; equality does not require the same pattern of shared references. See the [supported-type tables](docs/API.md#supported-types) for wrapper exceptions, binary views and the complete rules.

### Custom equality

Pass a comparison callback, called a **customiser**, when particular values need a special equality rule. Use `isEqual.custom()` to compare now, or `isEqual.create()` to save the callback and fallback mode in a reusable function. A callback returning `undefined` leaves the pair to the selected standard mode.

For example, compare strings in a search filter without case, while keeping the stock flag significant:

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

isEqual(saved, current);       // => false
sameFilters(saved, current);   // => true
sameFilters(saved, changed);   // => false
```

| Customiser result | Effect on the current pair                              |
| ----------------- | ------------------------------------------------------- |
| `true`            | Accept as equal; an object pair's children are skipped. |
| `false`           | Reject as unequal; this does not request fallback.      |
| `undefined`       | Use the selected standard mode.                         |

The customiser runs before standard checks and instance `equals()` hooks. It is synchronous, must keep inputs unchanged and must return a primitive boolean or `undefined`. It is not guaranteed to visit every nested value and receives no property path: this example applies to every string pair it receives. Use a dedicated comparator when rules differ by field.

See [custom equality](docs/API.md#custom-equality) for the walkthrough, validation, callback precedence and instance hooks.

### Errors and supported inputs

Value mismatches return `false`. Errors from getters, proxies and callbacks propagate; invalid callback or hook results throw `TypeError`. Compared graphs must be finite and remain unchanged during comparison, including shared backing memory. See [errors and supported inputs](docs/API.md#errors-and-supported-inputs) for the full contract.

## TypeScript

Declarations are included; no separate `@types` package is required. Declaration checks use TypeScript 5.8.3. The three root functions accept two `unknown` values and return `boolean`. `isEqual.create()` returns a reusable function with that signature. Customiser, mode, options and comparator types are also exported. Equality functions do not narrow values as TypeScript type guards. See the import notes under [Usage](#usage) for supported entry points.

## Performance

Standard comparisons can skip work using primitive equality, identical references and native collection membership. Custom comparisons run your callback before those shortcuts, which can cost more, especially for large Sets and Maps. A factory saves repeated configuration checks; it still performs deep comparison and calls your callback.

The engine does not mutate inputs or cache equality results between calls. Ambiguous unordered collections can require repeated comparisons and substantial memory, including storage that grows with the square of the collection size. Iterative traversal avoids recursion limits but does not impose a fixed time or memory budget.

See the [benchmark and memory guide](https://github.com/koyote130708/go-equality/blob/master/docs/development.md#benchmarks-and-memory) for measurement commands, methodology and limits. Local benchmark timings are observations, not universal speed guarantees.

## Migration

Version 2 fixes comparisons involving cycles, unordered collections, custom instances and hooks, own non-enumerable and symbol properties, and browser builds. It also defines the rules for sparse arrays, `RegExp` `lastIndex`, wrappers, hook return values, unsupported types, constructors, and objects from different JavaScript environments. Loose mode no longer converts arbitrary objects to primitives. Only the documented root API, its attached methods, and listed distribution entry points are public; internal helpers have changed. CommonJS usage supports Node.js 8.0.0 or later; see [runtime support](#runtime-support) for ES module and optional-native requirements. The standalone `isLooseEqual` and `isStrictEqual` exports remain supported alongside the attached aliases and custom methods. Review the [comparison rules](docs/API.md#comparison-rules) and [changelog](CHANGELOG.md) before upgrading.

## Development

Contributing requires Node.js 22.18+ within Node 22, or Node.js 24+; the lint toolchain does not support Node 23. This requirement is separate from [consumer runtime support](#runtime-support).

```sh
npm ci
npm run docs
npm run build
npm test
```

Edit `scripts/README.template.md` for this overview and `scripts/API.template.md` for the full API documentation. `npm run docs` generates `README.md` and `docs/API.md`, reuses the API summary and validates the public API inventory and navigation. The build assembles the complete consumer package under `package/`, including browser bundles in `package/dist/`.

Run the standard gate with an exact Node.js 8.0.0 consumer executable, while keeping the command itself on a supported contributor Node version:

```sh
npm run verify -- --node /path/to/node-8.0.0
```

`verify` checks lint, formatting, generated documentation, source coverage, declarations, bundles and an installed package. `verify:all` adds Chromium, Firefox and WebKit checks of the same archive. See the [development guide](https://github.com/koyote130708/go-equality/blob/master/docs/development.md) for browser setup, exact-runtime selection, build recovery, release verification and local package installation. [Code quality](https://github.com/koyote130708/go-equality/blob/master/docs/code-quality.md) explains the shared tooling and formatting rules.

The coverage badge reports executable source-line coverage. The docs badge reports checked public API reference coverage. Neither percentage measures how understandable the writing is or guarantees correctness for every input; see the [test coverage map](https://github.com/koyote130708/go-equality/blob/master/docs/test-coverage.md).

## Further reading

- [Full API documentation](docs/API.md): signatures, parameters, examples and behavioural contracts.
- [Changelog](CHANGELOG.md): release changes and migration from version 1.
- [Development guide](https://github.com/koyote130708/go-equality/blob/master/docs/development.md): contributor setup, verification, release and benchmark procedures.
- [Engine design](https://github.com/koyote130708/go-equality/blob/master/docs/design.md): comparison internals and optimisation constraints.
- [Test coverage map](https://github.com/koyote130708/go-equality/blob/master/docs/test-coverage.md): contracts, regression suites and known limits.

The npm package contains runtime source, TypeScript declarations, both browser bundles, package metadata, `README.md`, `docs/API.md`, the licence and the changelog. Contributor guides, tests, benchmarks, scripts and CI configuration stay in the [source repository](https://github.com/koyote130708/go-equality).

## Licence

[MIT](LICENSE.md) Copyright (c) Michael Ko.
