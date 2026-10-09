# Changelog

## Unreleased

Planned version: 2.0.0. This major release includes correctness repairs, performance refinements, caller customisers, and browser support.

### Optional native capabilities

- Kept package loading and ordinary comparisons working when optional constructors or native getters are missing.
- Prevented missing BigInt unboxing support from invoking application coercion through an inherited method. Unsupported wrappers and shared buffers retain identity and customisation rules.
- Rejected RegExp flag comparisons when the engine supports a flag but its getter is unavailable, instead of silently ignoring it. Identity, customisers and instance hooks keep their usual precedence.
- Added fresh-load capability checks to source, focused-source, installed CommonJS/ES module consumers and both bundle formats, including minified output. These run alongside actual supported-runtime and browser checks.

### Breaking changes

- Removed shape-based native Buffer guessing. VM/sandbox consumers passing host Buffers must expose the same trusted `Buffer` constructor before loading the library; native-Buffer handling is unsupported without it. Application equality methods are no longer suppressed because their class resembles Buffer.
- Corrected cyclic comparisons and unordered Map/Set matching with one-to-one candidate assignment and complete Map-entry comparisons.
- Compared own non-enumerable and symbol properties, array extras, sparse holes, and supported built-in decorations consistently.
- Normalised genuine primitive wrappers in default and loose modes; preserved wrappers in strict mode. Loose coercion applies only to primitives and ignores constructors for ordinary-object structure.
- Required boolean instance `equals()` results, allowed either instance hook to veto, and propagated user exceptions. Invoked hooks through captured `Reflect.apply`.
- Defined typed-array values, DataView byte windows, invalid dates, RegExp `lastIndex`, null-prototype dictionaries, cross-realm values, opaque objects, and browser `document.all` behaviour.
- Limited supported entry points to the root API, listed browser bundles, and package metadata. Internal helpers are no longer public.

### Fixed

- Fixed proxy property comparisons that could ignore mismatched exposed keys or change their result when key order or operand order changed.

- Declared the customiser's unbound receiver in TypeScript. Unbound callbacks with an explicit required `this` object are now rejected; bind them or wrap their owner call. Runtime behaviour is unchanged.
- Rejected browser report-output paths that overwrite candidate archives, digest sidecars, input bundles, the browser suite or the harness itself.
- Compared ordinary Node Buffers through the typed-array handler instead of treating their inherited native equals method as an application hook. Preserved extra own properties, numeric customiser decisions and heterogeneous Map/Set matching, while retaining explicit instance and subclass hooks.
- Ran the constrained-memory release check against the selected tarball, including when it differs from checkout code. Rejected missing or changed candidates and preserved standalone diagnostic entry overrides.
- Reported when a new package is already active but removal of its previous output failed. Identified the cleanup path, retained the original error, and avoided rolling back to a potentially incomplete backup.

### Documentation

- Clarified that `document.all` follows the ordinary unsupported-object hook rules; comparison with `null` or `undefined` still requires a caller customiser to override it.
- Clarified existing proxy-wrapper and resolved-constructor-property limits without changing runtime comparison rules. Documented all five type-only exports and linked the maintained boundary regressions from the coverage map.
- Used New Zealand English in documentation and comments, `// =>` for checked example results, and shared comment columns for related alternatives. Defined the source-line and public API reference coverage badges explicitly.
- Clarified customiser and wrapper explanations, simplified maintainer guides and code comments, and split the development instructions into readable steps.

- Added an API-choice guide, supported-type tables distinguishing value/structural and identity-only comparison, and a partial-customiser walkthrough with executable examples.
- Aligned maintained design and coverage links, clarified callback declarations, and verified the packed README matches its source. These changes document existing behaviour; they add no runtime APIs or built-in handlers.

### Packaging

- Generated a complete consumer `package/` from the private development root, preserving public imports and runtime requirements. Packed that directory, rejected root publication, and resolved type/artefact checks from isolated consumers of the exact candidate.

### Runtime compatibility

- Supported Node.js 8.0.0 CommonJS consumers with ES2017 source and bundles, while keeping contributor tooling on modern Node. Guarded optional BigInt, shared-memory and newer regular-expression capabilities so their absence does not prevent ordinary comparisons.
- Kept native BigInt and BigInt typed-array comparison available on runtimes that provide them, without installing global polyfills. Checked default and named ES module imports on Node 16.0.0 and modern Node.

### Imports

- Showed `import Eq from 'go-equality'` as the primary ES module usage and verified default imports in JavaScript and compiled TypeScript consumers of the installed package. Named imports and CommonJS usage remain supported.

### Licence

- Used the MIT licence for the library and included its full copyright and permission notice in both browser bundles.

### Testing

- Covered defensive dependency invalidation, binary length rechecks, and operation without `SharedArrayBuffer`; required full source-line, branch and function coverage during verification.

### Development

- Initially adopted the immutable Engineering Playbook v0.12.0 lint artefact, then replaced the private configuration with locally owned, exactly pinned upstream ESLint and formatting dependencies. Lint and format checks remain required before the other validation and CI gates.
- Applied the agreed formatting throughout maintained sources and retained intentional equality/type-test exceptions locally.
- Checked formatted multiline documentation examples and preserved build/cleanup errors explicitly.
- Added `pack:package` to build a fresh release candidate and record its SHA-256. Made `verify` and `verify:all` check one tarball across installed consumers and browsers, required exact Node 8.0.0 consumer verification, and rejected missing supplied archives without repacking. Rejected root packing and publication, and tested lifecycle and development-tool failures.

### API and implementation

- Preserved `isEqual`, `isLooseEqual`, and `isStrictEqual`; added stable read-only `isEqual.strict` and `isEqual.loose` aliases.
- Added immediate `isEqual.custom()` and reusable `isEqual.create()` comparators, with `true`/`false` decisions, `undefined` delegation, validated options, and fresh comparison state for every call.
- Used an iterative pair-dependency engine for deep and cyclic inputs. Added native collection fast paths, candidate filtering, compact rejection tracking, and aligned byte comparisons while preserving the general matcher.
- Included TypeScript declarations, CommonJS and named ESM interoperability, and rebuilt readable/compact UMD bundles. Removed stale source maps and guarded unrelated browser module globals.
- Kept zero runtime dependencies.

### Validation and packaging

- Used native Node public-contract, oracle, generated-graph, hook, documentation, loader, packed-consumer, and constrained-memory tests.
- Checked declarations with pinned TypeScript and ran actual-browser regressions for both bundles; CI defines Chromium, Firefox, and WebKit jobs.
- Built the UMD bundle and minified it sequentially with pinned tooling. Used Terser compression and local identifier mangling, preserved public names and equality-sensitive behaviour, and checked generated syntax and artefact behaviour.
- Compiled CommonJS and ES module consumers against installed declarations and exercised the packed browser bundles, including exported subpaths and loaders.
- Limited package contents to runtime files and consumer documentation. Kept development records, tests, scripts, benchmarks, and CI configuration out of npm; validated installed README links and package metadata before packing.
- Named tests by public API or protected behaviour. Removed temporary development plans, superseded reports, and raw verification output from the source documentation.

## 1.0.4 — 2022-10-19

- Converted to CommonJS module format.
- Added a build script.
- Added a changelog file.
- Added the bundle files.

## 1.0.3 — 2022-09-01

- Updated the readme file.

## 1.0.0 — 2022-08-21

- Initial release
