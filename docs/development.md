# Development guide

Use this guide to install contributor tools, build the package and run release checks. The [test coverage map](test-coverage.md) links comparison contracts to their regression suites.

The coverage badge reports executable source-line coverage measured by `npm run coverage`. Verification requires 100% source lines, branches and functions, measured separately by the modern Node test runner. Older-runtime consumer checks exercise compatibility without claiming those coverage measurements. Source-line coverage is not branch coverage or a guarantee of correctness.

The docs badge measures the proportion of public functions and attached methods with checked reference sections: currently 100%. This library exports no public constants. The documentation generator checks the complete public API inventory, and tests execute the examples. Documentation coverage does not mean every possible behaviour or example variant is tested.

## Contributor setup

Contributing requires Node 22.18+ within Node 22, or Node 24+ (the lint toolchain does not support Node 23). This tool requirement is separate from the published CommonJS runtime minimum of Node 8.0.0. Install the locked development tools for linting, formatting, bundling, minification and declaration checks:

```sh
npm ci
npm run docs
npm run build
npm run lint
npm run format:check
```

After installing the tools, run the unit tests or the coverage gate. The suite uses Node's built-in test runner; documentation checks also use the installed Acorn parser.

```sh
npm test
npm run coverage
```

## Standard verification

Release verification also requires an exact Node 8.0.0 executable. Select it with `--node`, replacing the example path below, or set `GO_EQUALITY_NODE8` to its path. A later Node 8 patch does not establish the declared minimum. Keep the verification command itself on a supported contributor Node version.

```sh
npm run verify -- --node /path/to/node-8.0.0
```

`npm run verify` runs the following checks:

- ESLint with no warnings and formatting checks.
- A fresh complete build and one packed release candidate, README and API-reference freshness checks, source tests with coverage, and TypeScript declaration tests.
- The public test suite against both bundles through CommonJS, global, and AMD loaders.
- The same installed tarball on the declared Node 8.0.0 CommonJS minimum and modern Node, including public behaviour, default and named ES module imports where supported, compiled TypeScript consumers, and both exported browser bundles.
- Build-failure recovery, release regressions (`test:release`), development-tool regressions (`test:tooling`), loader checks, and comparisons under a limited V8 heap.

## Build and documentation

`npm run build` assembles a complete consumer `package/` in a temporary directory: runtime sources, declarations, metadata, documentation and readable/minified bundles. It validates the output, then replaces the entire `package/` directory. If replacement fails, it restores the previous distribution. If restoration also fails, the error gives the retained backup path. Once the new package is active, a failure to remove the previous output still makes the command fail. The error identifies the active package and the cleanup path; remaining backup files may be incomplete, so the build does not restore them. Successful builds remove stale output. `npm run test:build` checks these cases in temporary copies.

Terser compresses the minified bundle to one line after the licence banner and shortens local variable names. Public property and function names are preserved. Rewrites that could change `document.all` comparisons or its `typeof` result are disabled. Property reads are treated as potentially running getters or proxy traps. Both bundles are checked against ES2017 syntax and run through the same tests, with separate consumer checks on Node 8.0.0.

Use `npm run lint:fix` and `npm run format`, then review the changes. Formatting uses single JS/TS quotes, double JSX quotes, semicolons, two spaces, and no optional trailing commas. Edit the maintained sources and regenerate the README, API reference and bundles. [Code quality](code-quality.md) explains the local configuration and formatting exceptions. CI runs `verify` on Node 22 and 24; repository administrators must require those checks in branch protection.

`npm run docs` generates `README.md` and `docs/API.md` from `scripts/README.template.md`, `scripts/API.template.md`, package metadata and the public API. Maintain the overview in the README template and complete API entries in the API template. The API summary is maintained once in the API template and reused with direct reference links in the README. The generator updates current metadata and both tables of contents, and checks that every public call form has one reference entry and summary row. Historical release descriptions stay as written. Documentation tests execute examples in both files and check cross-document links and anchors. `npm run test:docs` checks freshness without modifying files. CI regenerates and checks both outputs. The consumer package includes both documents unchanged; package checks verify their bytes, links and examples after installation.

### Executable examples and test selection

Documentation checks read standalone `js`/`javascript` fences and installed browser examples from `html` fences. Backtick or tilde fences may have three or more characters, up to three leading spaces and an info string after the language. A closing fence must use the same character with at least the opening length. Content inside another fenced block is not a nested example. This scanner is not a full Markdown parser: keep executable examples out of list/blockquote containers and raw HTML blocks.

Use `// => true`, `// => false`, or `// => throws TypeError`, `RangeError`, or `Error` after an expression statement. Legacy plain boolean/exception annotations remain accepted. Explicit `=>` annotations with unsupported results or misspellings fail rather than disappearing from the checks. To demonstrate another result type, assert a boolean property of the result or extend the checker with a tested expectation format. An annotation in a function or conditional is checked only when that code executes; the annotation count is not a statement-coverage measurement.

The runtime suite defaults to the canonical source. `EQUALITY_ENTRY` selects a module or bundle; when supplied it must be nonempty. `EQUALITY_FORMAT` selects `commonjs` (the default), `global`, or `amd`. Invalid explicit selections fail instead of switching back to the checkout or CommonJS. VM loader tests remain Node execution, not real-browser tests.

### Optional-capability checks

The [native capability inventory](API.md#native-runtime-capabilities) owns the required/optional classification and absent behaviour. [optional-capabilities.test.js](../test/optional-capabilities.test.js) runs the shared [ES2017 scenarios](../test/compatibility/optional-capabilities.js) in fresh child processes. Capabilities are removed before importing code; VM global/AMD checks remove them in the receiving realm before evaluating a bundle. Deleted globals, unavailable members, independent absences, combinations and native-present controls cover comparison modes, alias identity, unboxing, native payloads, customisers, hooks and errors.

These cases are part of `npm test`, coverage, both-bundle artefact checks and installed-package tests, so `verify` and `verify:all` require them. Installed checks repeat the matrix on each selected consumer runtime, including exact Node 8.0.0. Supported ES module checks initialise Node's module loader first, then remove capabilities before loading a fresh consumer with static default and named imports. This separates the library from the loader's own requirements: Node 12's CommonJS/ES module lexer needs `Buffer` during initialisation. Each child reports its scenario and assertion count; a successful exit without assertions is a failure. Focused source imports are checked for early dependency access, without adding public subpath exports.

Simulated API absence and simulated unsupported RegExp flag syntax test fallback paths, not historical engine compatibility. Actual Node consumer tests, ES2017 syntax checks and actual Chromium/Firefox/WebKit runs provide separate evidence. Modern browser results do not establish support for untested older browser releases.

## Browser verification

Real-browser regressions are separate from Node VM loader checks. Install the browser-test tooling (Python 3.10 or later) and all three browsers, then run the complete release gate:

```sh
python -m pip install -r test/browser/requirements.txt
python -m playwright install chromium firefox webkit
npm run verify:all -- --node /path/to/node-8.0.0 --destination artifacts
```

`verify:all` runs the standard gate and checks its exact tarball in Chromium, Firefox and WebKit. The browser harness blocks external requests and loads the readable and compact bundles from that archive into separate browser contexts. Browser cases cover `document.all`, both operand orders, nested/cyclic values, collection keys/values, hook dispatch, custom override/fallback and factory reuse. A system Chrome/Chromium executable can be selected with `CHROMIUM_PATH`; an installed system Chromium is also detected when the Playwright-managed executable is absent. Missing tooling or browsers fail rather than silently skip.

The browser report path (`--output`) must be distinct from the selected tarball, its digest sidecar, the input bundles, the browser suite and the browser harness itself. Equivalent paths, symlinks and hardlinks to those inputs are rejected before browser execution. `npm run test:release` includes dependency-free Python checks for this protection; they do not replace the real-browser gate.

## Release candidates

To prepare a candidate or rerun checks against a retained archive, use:

```sh
npm run pack:package -- --destination artifacts
npm run verify:all -- --tarball artifacts/go-equality-2.0.0.tgz --node /path/to/node-8.0.0
npm run test:package -- --tarball artifacts/go-equality-2.0.0.tgz --node /path/to/node-8.0.0
npm run test:package -- --tarball artifacts/go-equality-2.0.0.tgz --node /path/to/node-16.0.0
npm run test:browser -- --tarball artifacts/go-equality-2.0.0.tgz --browser all
```

`pack:package` builds fresh complete output, packs the generated `package/` directory, and reports the tarball path and SHA-256 digest. It writes the digest beside the archive as `.tgz.sha256`. Packing alone does not run the full release gate. Without `--destination`, packing and verification retain their candidate in a unique directory under the operating system's temporary directory. Use the ignored `artifacts/` directory for intentional release artefacts; keep disposable output outside the checkout.

`verify`, `verify:all`, `test:types`, `test:artifacts`, `test:package`, `test:memory` and `test:browser` consume a supplied `--tarball` without rebuilding or repacking, and fail if that file is missing. Package checks install the archive into a clean temporary consumer and always use modern Node; `--node` adds the selected consumer runtime. Node 16.0.0 also exercises default and named ES module imports and compiled TypeScript ES module consumers. For a checkout-only browser diagnostic, use `npm run test:browser -- --bundle-dir package/dist`; that does not verify a release archive.

CI builds and packs on Node 22, repeats the complete standard gate on Node 24 using that archive, and passes the same candidate and digest to the [consumer runtime matrix](../.github/workflows/ci.yml) and the Chromium, Firefox and WebKit jobs. The consumer matrix includes the CommonJS minimum and native ES module version boundaries.

Test output identifies the archive, runtime and browser versions that actually ran. The development root is private; its `prepack` and `prepublishOnly` hooks reject ordinary root packing/publication and direct contributors to `pack:package`. The generated package contains no contributor hooks or development dependencies. Once release is authorised, publish the exact verified tarball.

Temporary consumers are removed after checks, including when a check fails. If removal also fails, the command reports both the original error and cleanup errors, and still attempts the remaining cleanup. A cleanup failure makes the command fail even when its checks passed. `test:tooling` injects these failures without installing packages or removing real directories.

For local consumers, install the tarball or link the built `package/` directory. The repository root and Git checkout are not consumer packages. Run `npm run build` before standalone `test:types`, `test:artifacts` and `test:loaders`; `verify` owns that prerequisite, and supplied-tarball verification works without local `package/` output.

## Benchmarks and memory

`npm run benchmark` warms up the code before measuring local timings. It has no pass/fail speed threshold. Workloads include primitive values and identical references, application objects, arrays, deep and cyclic graphs, native and structural collections, and binary data. For paired before/after measurements, point it at an extracted previous package:

```sh
node --expose-gc scripts/benchmark.js --baseline ../go-equality-baseline --output comparison.json
node scripts/benchmark-memory.js --baseline ../go-equality-baseline --output memory.json
npm run test:memory
npm run test:loaders
npm run benchmark:custom
npm run test:stress
node scripts/stress.js --seeds 15000 --baseline ../go-equality-baseline
node scripts/audit-matching.js default matching-default.json
node scripts/audit-matching.js strict matching-strict.json
node scripts/audit-matching.js loose matching-loose.json
```

Input fixtures and assertions are outside the timed loops. Both versions warm up; sample order alternates between baseline-first and optimised-first. Results record individual samples, Node/V8/CPU details, and optional explicit garbage collection between samples. Measurements are local observations, not universal speed guarantees. A baseline can be an explicit module file or a directory resolved through its declared package entry or index fallback. It must support the comparison contract exercised by the selected workloads. `npm run test:tooling` checks these inputs, filename collisions and failure propagation; unexpected worker failures cause a nonzero exit rather than a successful measurement report.

Benchmark and matching-audit reports must not overwrite the compared entry files, their package metadata, or CommonJS and ES modules loaded by the tools and their memory workers. Equivalent paths, symlinks and hardlinks to those inputs are rejected. Existing separate reports can still be replaced. File tracking starts before comparators are loaded, and workers return their loaded files and package metadata before the parent writes a report. Metadata protection includes `package.json` files in parent folders, package lookup locations and targets of matching import aliases. The guard records these paths without changing Node’s chosen module or parsing unused package manifests. This is an accidental-overwrite guard, not protection against concurrent filesystem changes. Optional report paths are positional for the custom benchmark (`npm run benchmark:custom -- /path/to/custom.json`) and matching audit (`node scripts/audit-matching.js default /path/to/matching.json`).

File-symlink regression cases run wherever the filesystem permits them. On Windows without Developer Mode or symlink privileges, those cases report an explicit skip; direct-path and hardlink cases still run. Linux CI requires the symlink cases to pass.

A `--filter` that selects no cases is an error rather than a successful empty report. The custom benchmark checks each fixture/variant result is exactly `true` before calibration; a truthy value such as `1` is not a valid comparison result. The timing loops still include result consumption and loop overhead. The legacy `optimized` field in paired timing reports names the current implementation; the label itself does not establish an optimisation. A ratio below one means the current median is slower for that measurement.

`npm run test:stress` checks generated cyclic graphs against an independent reference implementation. The optional `--baseline` flag compares against a supplied prior package instead. Benchmarks and stress tools are available in the source repository. They are not included in the npm package.

The engine uses native collection lookups where they prove a complete match, reuses temporary matching storage, and compares aligned byte blocks when possible. It does not mutate inputs or cache equality results between calls. [Engine design](design.md) explains these optimisations and their constraints.

Collection matching releases completed leaf comparisons and stores rejected candidates compactly. Unresolved cyclic comparisons remain available until their dependencies are resolved. Ambiguous collections can still need substantial time and memory, including storage that grows with the square of the collection size.

`npm run benchmark:memory` measures each comparison in a fresh process. It records peak resident set size (RSS, the process memory held in RAM) and the change in heap use after the call. These include process overhead and do not isolate peak memory used by the comparator.

`npm run test:memory` checks results with a 64 MiB V8 old-space limit and a 4 MiB semi-space limit. These limit parts of the JavaScript heap, not total process memory. Release verification passes its exact tarball to this check; use `npm run test:memory -- --tarball /path/to/candidate.tgz` to check a retained candidate. Without `--tarball`, this command is a checkout diagnostic. `npm run test:types` checks declarations with pinned TypeScript 5.8.3, including `strict`, `exactOptionalPropertyTypes` and `skipLibCheck: false`. Compile-only and emitted consumers use only the ES2017 library definitions, with automatic `@types` inclusion disabled. This checks that declarations work without browser or contributor globals. Both checks are included in `verify` and CI.

The suite tests the public API, known regressions, all 512 possible match patterns between two groups of three values, and generated cyclic graphs checked against an independent reference implementation. It also compares acyclic results with Node's deep comparator where both libraries use the same rules. These tests cover representative inputs and edge cases; coverage percentages do not prove correctness for every value or callback.

See the [test coverage map](test-coverage.md) for links from public contracts to their tests.
