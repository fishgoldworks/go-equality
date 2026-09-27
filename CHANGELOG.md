# Changelog

## Unreleased

### Development

- Adopt the immutable Engineering Playbook v0.12.0 lint artifact with ESLint 10 and shared formatting; require lint and format checks before existing validation and CI.
- Apply the agreed formatting throughout maintained sources and retain intentional equality/type-test exceptions locally. Runtime comparison expressions are unchanged.
- Check formatted multiline documentation examples and preserve build/cleanup errors explicitly.

## 2.0.0

This major release includes correctness repairs, performance refinements, caller customizers, and browser support.

### Breaking changes

- Require Node.js 22.16.0 or later for Node usage.
- Correct cyclic comparisons and unordered Map/Set matching with one-to-one candidate assignment and complete Map-entry comparisons.
- Compare own non-enumerable and symbol properties, array extras, sparse holes, and supported built-in decorations consistently.
- Normalize genuine primitive wrappers in default and loose modes; preserve wrappers in strict mode. Loose coercion applies only to primitives and ignores constructors for ordinary-object structure.
- Require boolean instance `equals()` results, allow either instance hook to veto, and propagate user exceptions. Invoke hooks through captured `Reflect.apply`.
- Define typed-array values, DataView byte windows, invalid dates, RegExp `lastIndex`, null-prototype dictionaries, cross-realm values, opaque objects, and browser `document.all` behavior.
- Limit supported entry points to the root API, listed browser bundles, and package metadata. Internal helpers are no longer public.

### API and implementation

- Preserve `isEqual`, `isLooseEqual`, and `isStrictEqual`; add stable read-only `isEqual.strict` and `isEqual.loose` aliases.
- Add immediate `isEqual.custom()` and reusable `isEqual.create()` comparators, with true/false decisions, undefined delegation, validated options, and fresh comparison state for every call.
- Use an iterative pair-dependency engine for deep and cyclic inputs. Add native collection fast paths, candidate filtering, compact rejection tracking, and aligned byte comparisons while preserving the general matcher.
- Include TypeScript declarations, CommonJS and named ESM interoperability, and rebuilt readable/compact UMD bundles. Remove stale source maps and guard unrelated browser module globals.
- Keep zero runtime dependencies and the existing LGPL-3.0-only licence.

### Validation and packaging

- Use native Node public-contract, oracle, generated-graph, hook, documentation, loader, packed-consumer, and constrained-memory tests.
- Check declarations with pinned TypeScript and run actual-browser regressions for both bundles; CI defines Chromium, Firefox, and WebKit jobs.
- Build the UMD bundle and minify it sequentially with pinned tooling. Use Terser compression and local identifier mangling, preserve public names and equality-sensitive behavior, and check generated syntax and artifact behavior.
- Compile CommonJS and ES module consumers against installed declarations and exercise the packed browser bundles, including exported subpaths and loaders.
- Publish only runtime files and consumer documentation. Keep development records, tests, scripts, benchmarks, and CI configuration out of npm; validate installed README links and package metadata before packing.
- Name tests by public API or protected behavior. Remove temporary development plans, superseded reports, and raw verification output from the source documentation.

### v1.0.4

2022-10-19

- Converted to CommonJS module format.
- Added a build script.
- Added a changelog file.
- Added the bundle files.

### v1.0.3

2022-09-01

- Updated the readme file.

### v1.0.0

2022-08-21

- Initial release
