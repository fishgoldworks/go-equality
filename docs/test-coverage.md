# Test coverage map

This guide maps observable contracts to their tests. The [README development section](../README.md#development) describes setup and validation commands; [package.json](../package.json) owns their executable definitions. Test counts and coverage percentages come from the current run rather than a saved report.

## Behavioral suites

| Contract                                                                                                | Tests                                                                                                                            |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Public comparison modes and representative values                                                       | [isEqual](../test/isEqual.test.js), [isLooseEqual](../test/isLooseEqual.test.js), [isStrictEqual](../test/isStrictEqual.test.js) |
| Primitive/wrapper rules, own properties, built-in payloads, constructors, cross-realm and opaque values | [semantics](../test/semantics.test.js)                                                                                           |
| Cycles, repeated references, complete Map entries, candidate reassignment, and regression cases         | [regressions](../test/regressions.test.js)                                                                                       |
| Native collection paths, graph invalidation, byte windows, and optimized-path boundaries                | [optimization](../test/optimization.test.js)                                                                                     |
| Structural collection sizes, rejection compaction, sharing, and nonlocal cyclic failures                | [collection matching](../test/collection-matching.test.js)                                                                       |
| Bilateral instance hooks, vetoes, result validation, and exception propagation                          | [hooks](../test/hooks.test.js)                                                                                                   |
| Hook invocation with overridden or missing call methods and callable proxies                            | [hook dispatch](../test/hook-dispatch.test.js)                                                                                   |
| Attached aliases, caller precedence, options, factories, invalid results, and custom matching           | [custom API](../test/custom-api.test.js)                                                                                         |
| Generated cyclic graphs and differential checks within shared semantics                                 | [generated cases](../test/generated.test.js)                                                                                     |
| Caller-defined relations on cyclic graphs                                                               | [custom graphs](../test/custom-graphs.test.js)                                                                                   |
| Reproducible README generation, metadata changes, API coverage and generated anchors                    | [documentation generation](../test/docs-generation.test.js)                                                                      |
| Executable README examples, metadata consistency, and documentation links                               | [documentation](../test/docs.test.js)                                                                                            |

The [independent graph oracle](../test/helpers/oracle.js) uses an eager fixed-point implementation and exhaustive matching rather than the production augmenting-path matcher. Exhaustive small matching matrices and seeded graph generation check ambiguous assignments without assuming transitivity. Differential agreement is considered only where the reference shares the intended semantics.

## Distribution and environment checks

| Boundary                                                                                                                   | Check                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public declarations, CommonJS namespace imports and rejected call signatures                                               | [Consumer fixture](../test/types/consumer.ts), [CommonJS fixture](../test/types/require.cts) and [compiler configuration](../test/types/tsconfig.json) |
| Complete builds, failure preservation, and distribution replacement                                                        | [build checks](../scripts/test-build.js)                                                                                                               |
| CommonJS, global, and AMD loader environments                                                                              | [loader checks](../scripts/test-loaders.js)                                                                                                            |
| Full public suite through both generated bundles                                                                           | [artifact checks](../scripts/test-artifacts.js) using [the API selector](../test/helpers/api.js)                                                       |
| Installed tarball contents, imports, CommonJS/ESM declarations, browser bundles, attached APIs, metadata, and README links | [package checks](../scripts/test-package.js)                                                                                                           |
| Structural comparisons under a constrained V8 heap                                                                         | [memory checks](../scripts/test-memory.js)                                                                                                             |
| Actual-browser HTMLDDA, hooks, customizers, nesting, and collections                                                       | [browser suite](../test/browser/suite.js) and [browser harness](../scripts/test-browser.py)                                                            |
| Larger reproducible graph samples                                                                                          | [stress tool](../scripts/stress.js)                                                                                                                    |

Node VM loader checks do not replace actual-browser tests. Configured jobs in [CI](../.github/workflows/ci.yml) describe intended environments; only executed results establish a pass.

## Interpreting results

The suite tests behavior through public exports, except for narrowly scoped algorithmic regression guards. Repeating a suite against another artifact provides distribution evidence, not additional unique input scenarios. Type fixtures protect signatures and the absence of an incorrect type-guard promise; runtime behavior still needs runtime tests.

Coverage measures executed source paths, not correctness for every JavaScript value or user callback. Resource checks use V8 heap-region limits rather than whole-process memory limits. Timing benchmarks have no pass/fail speed threshold. Preserve the [supported-input limitations](../README.md#errors-and-supported-inputs) when interpreting failures or expanding coverage.
