# Changelog

## Unreleased

Planned version: 2.0.0. See [Migration](README.md#migration) for upgrading from 1.0.4.

### Breaking changes

- Restricted public imports to the package root, the listed browser bundles and package metadata. Import comparison functions from `go-equality` instead of internal `src/` paths.
- Required instance `equals()` methods to return booleans. Either method can reject a comparison; both must return `true` to bypass structural comparison. Exceptions propagate to the caller.
- Limited loose coercion to primitive values. Arbitrary objects are no longer converted through application `valueOf()` or `toString()` methods.
- Compared own non-enumerable and symbol properties, sparse array holes, array extras and supported built-in decorations consistently. Regular expressions include `lastIndex`; typed arrays and binary views use their documented contents.
- Defined wrapper, constructor, cross-realm and unsupported-object comparison rules. Default and loose modes unwrap genuine primitive wrappers; strict mode keeps them distinct from primitives.
- Required Node.js 8.0.0 or later for CommonJS consumers. Native default and named ES module imports require Node.js 12.20.0+ within 12.x, or 14.13.0 and later.
- Removed shape-based Buffer detection. VM or sandbox code comparing host Buffers must expose the host's trusted `Buffer` constructor before loading the library.

### Added

- Added `isEqual.strict` and `isEqual.loose` aliases, while retaining the standalone `isStrictEqual` and `isLooseEqual` exports.
- Added `isEqual.custom()` for individual custom comparisons and `isEqual.create()` for reusable comparison functions. Callbacks return `true` or `false` to decide equality, or `undefined` to use the selected default, strict or loose rules.
- Included TypeScript declarations supporting TypeScript 3.0 and later, with default and named imports, callback inference and validation of unbound receivers.

### Changed

- Adopted the MIT licence for version 2 and included its complete notice in both browser bundles. Historical releases retain their original licences.

### Fixed

- Corrected circular comparisons and unordered Map/Set matching, including one-to-one candidate assignment and complete key/value comparisons.
- Corrected proxy property comparisons that could ignore mismatched exposed keys or depend on key or operand order.
- Compared ordinary Node Buffers through the typed-array rules, preserving extra properties and numeric customiser calls; explicit instance and subclass equality hooks remain supported.
- Kept loading and unrelated comparisons working when optional native constructors or methods are absent. Unsupported wrapper and shared-buffer inspection preserves identity and customisation rules; unavailable supported RegExp flag getters fail clearly when inspection is requested.
- Preserved browser `document.all` behaviour in readable and minified bundles.

### Performance

- Used iterative traversal for deep and cyclic inputs, native collection fast paths and compact matching storage. Ambiguous unordered collections can still require substantial time and memory; results are not cached between comparisons.

### Documentation

- Added complete comparison rules, supported-type tables, custom comparison examples and declaration guidance. Kept executable examples and aligned result comments, using New Zealand English.
- Clarified the overview, migration steps and versioned browser downloads, with repository links matching package metadata.

### Maintenance

- Generated a complete consumer package from a private development root, with no runtime dependencies or contributor hooks. Included readable/minified browser bundles and a source map back to the readable source.
- Made builds regenerate consumer documentation and preserve the previous distribution on generation or build failure. Preserved original failures when cleanup also fails.
- Verified exact release archives across installed consumers, optional-capability cases, TypeScript compilers, supported Node versions and Chromium, Firefox and WebKit. Browser checks execute the packaged README example using local candidate bytes.
- Kept playground directories out of Git, formatting, linting, coverage and published packages without removing local experiments.

## 1.0.4 — 2022-10-19

- Converted to CommonJS module format.
- Added a build script.
- Added a changelog file.
- Added the bundle files.

## 1.0.3 — 2022-09-01

- Updated the readme file.

## 1.0.0 — 2022-08-21

- Initial release
