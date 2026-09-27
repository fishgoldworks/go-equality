# Comparison design

This guide explains implementation responsibilities and invariants. The [README](../README.md#comparison-rules) owns the public comparison rules, supported inputs, and exception policy.

## Entry points and state ownership

The standard comparison functions delegate to [compare.js](../src/compare.js). Primitive and identity checks can settle ordinary calls without constructing graph state. Otherwise, [ComparisonContext](../src/ComparisonContext.js) owns type information, compared pairs, pending work, and dependency invalidation for one synchronous invocation.

[customEquality.js](../src/customEquality.js) validates caller configuration. Its factory retains only the customizer and selected mode; each invocation receives fresh comparison state. [CustomComparisonContext](../src/CustomComparisonContext.js) passes original values to the caller before applicable identity, unboxing, and instance-hook decisions. A boolean settles the reached pair; undefined delegates. Custom paths must not use standard shortcuts to bypass the caller's decision.

## Cycles and unordered matching

Value equality does not require preserving shared-reference topology. The engine treats object pairs as a monotone dependency graph: a pair begins provisionally equal and can become false when a required comparison fails. False results propagate to dependants. Iterative expansion and invalidation avoid recursive stack growth on deep inputs.

Unordered Sets and Maps require a one-to-one assignment of members or complete key/value entries. [matchCollection.js](../src/matchCollection.js) discovers candidates lazily and uses augmenting paths to replace earlier assignments. A greedy match is insufficient because loose coercion and user-defined equality need not be transitive.

Keep these invariants when changing graph or matching code:

- A rejected candidate must not leave a provisional success cached as final.
- Required-child failures invalidate their parents; collection alternatives trigger matching repair.
- Selected provisional edges retain watchers. If an edge fails during the search before its watcher is attached, the later attachment must still schedule repair.
- Only settled leaf candidates are eligible for transient-index eviction. Unresolved dependencies and alternative pairs retain the references needed for invalidation.
- Rejection bitsets record permanently false candidates only. Valid or unresolved pairs cannot be represented as optimistic bits.

For finite stable graphs and pure callbacks, dependency invalidation computes the greatest fixed point of the comparison relation. Changing getters, callbacks, or shared memory falls under the limitations in [errors and supported inputs](../README.md#errors-and-supported-inputs).

## Classification, properties, and payloads

[typeInfo.js](../src/typeInfo.js) classifies supported values and accesses native payloads through intrinsic operations. [compareObjects.js](../src/compareObjects.js) coordinates instance hooks, built-in payloads, properties, and collections. [compareProperties.js](../src/compareProperties.js) handles own keys and property dependencies, including non-enumerable and symbol keys.

Ordinary dictionaries with null prototypes are supported. Native built-ins whose prototype chains have been reassigned are outside the supported classification contract. Opaque values require identity or an explicit supported hook/customizer decision. These boundaries must remain visible in the README.

## Performance boundaries

[compareCollections.js](../src/compareCollections.js) uses captured native membership operations only when they prove a valid assignment under the selected relation. Partial identity matches must not reserve members and prevent a different complete match. Mixed loose types, wrappers, structural keys, and caller customizers can require the general matcher.

Settled-leaf eviction and compact rejection storage reduce per-call retention; they do not eliminate the potentially quadratic space or superlinear work of ambiguous structural collections. There is no cross-call equality-result cache.

Aligned byte blocks are suitable for byte-oriented payloads, with tails and unaligned fallbacks. Typed-array numeric comparisons must retain NaN and signed-zero behavior rather than becoming byte comparisons. All-own-key semantics, decorations, sparse holes, and callback visitation rules must survive optimizations.

Benchmark commands and measurement methodology are maintained in the [README development section](../README.md#development). [The test coverage map](test-coverage.md) identifies the guards for these invariants.
