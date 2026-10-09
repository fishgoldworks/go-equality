# Comparison design

This guide explains how the comparison engine works and which rules an optimisation must preserve. The [API reference](API.md#comparison-rules) describes the public comparison rules, [supported types](API.md#supported-types), and errors.

## Entry points and comparison state

The standard comparison functions call [compare.js](../src/compare.js). Primitive values and identical references can often be compared without tracking an object graph. Other comparisons use [ComparisonContext](../src/ComparisonContext.js), which stores type information, object pairs, pending work, and dependencies for one synchronous call.

[customEquality.js](../src/customEquality.js) checks the customiser and options. Its factory saves only the callback and mode; each call creates fresh comparison state. [CustomComparisonContext](../src/CustomComparisonContext.js) passes the original values to the callback before identity checks, wrapper unboxing, or instance hooks. A boolean decides equality for those values; `undefined` uses the selected standard mode. Custom comparisons must run the callback before shortcuts that could bypass its decision, even for identical references. See [caller customisers](API.md#caller-customisers) for details.

## Cycles and unordered matching

Value equality allows different patterns of shared references: one shared child can equal two separate children with the same contents. To handle cycles, the engine starts by assuming each object pair is equal. A failed required comparison makes that pair unequal, then makes any pairs depending on it unequal too. A pair can change from equal to unequal, but never back. This is a **monotone dependency graph**. Expansion and failure propagation use iteration to avoid growing the JavaScript call stack.

Sets and Maps need a one-to-one assignment of members or complete key/value entries. [matchCollection.js](../src/matchCollection.js) checks possible matches as needed. It uses **augmenting paths** to reassign earlier matches when that allows another member to find a match. Keeping the first match permanently can give the wrong answer: loose coercion and custom equality need not be transitive.

Preserve these rules when changing graph or matching code:

- A tentative match that later fails must not remain cached as a final success.
- Failure of a required child makes its parent unequal. Failure of a selected collection match instead triggers a search for another assignment.
- Selected tentative matches need watchers so a later failure triggers reassignment. If a match fails before its watcher is attached, attaching the watcher must still schedule that work.
- Only fully checked leaf pairs can be removed from the temporary pair index. Pairs with unresolved dependencies and entries that hold alternative pairs must remain available.
- Rejection bitsets store only permanently false candidates. Successful candidates stay in the row map, and unresolved matches keep the references needed to detect later failures.

For finite inputs that stay unchanged and callbacks that give consistent answers, this process computes the **greatest fixed point**: the largest set of equal pairs consistent with all required comparisons. See [errors and supported inputs](API.md#errors-and-supported-inputs) for restrictions on changing getters, callbacks, and shared memory.

## Types, built-in contents, and properties

[typeInfo.js](../src/typeInfo.js) identifies supported types and reads their built-in contents, such as Date timestamps, through native methods. [compareObjects.js](../src/compareObjects.js) combines instance hooks, built-in contents, properties, and collections. [compareProperties.js](../src/compareProperties.js) compares own keys and tracks dependencies between property values, including non-enumerable and symbol-keyed properties.

Key membership uses the captured `Reflect.ownKeys()` lists on both sides. Matching key positions need no lookup; differing orders use a temporary Set of the other list. Do not substitute descriptor-based ownership checks: a proxy can expose a different set of keys from those its property descriptors describe.

Ordinary Buffers inherit a byte-only `equals` method. [isBufferEquals.js](../src/isBufferEquals.js) excludes that method from application-hook dispatch so Buffer contents, properties and numeric customisers follow the typed-array rules. Explicit instance and subclass hooks retain their normal precedence. The library captures the environment's trusted `Buffer` prototype and method at load time. A receiving Node VM must expose the host Buffer constructor before loading the library when it receives host Buffers. Without that reference, methods are not excluded on the basis of names or metadata; they follow the ordinary application-hook protocol.

The CommonJS source and browser bundles use ES2017 syntax so they can load on Node 8.0.0. Optional native facilities are detected before their methods are captured: absent BigInt, `SharedArrayBuffer`, or newer RegExp flag getters must not break unrelated comparisons. BigInt and BigInt typed-array values require the runtime's native support; no global polyfills are installed. Preserve these capability boundaries when changing type detection.

The default/strict constructor precheck reads the resolved `constructor` properties and compares them with `===`; it does not recover allocation-time class identity. An own constructor field is also ordinary compared data, including in loose mode. Proxy targets are not unwrapped: exposed properties can compare equal even when hidden target payloads differ. These are compatibility boundaries, not invitations to infer native identity from shape.

Ordinary dictionaries with null prototypes are supported. Native built-ins whose prototype chains have been replaced with unrelated or null prototypes are outside the supported inputs. Unsupported types require the same reference or an explicit customiser or supported instance-hook decision. Keep these limits documented in the API reference and summarised in the README.

## Performance constraints

[compareCollections.js](../src/compareCollections.js) uses saved native membership methods only when they prove a complete assignment under the selected mode. Partial identity matches must not reserve members that another complete assignment would need. Mixed loose types, wrappers, object keys, and customisers can require the general matcher.

Removing completed leaf pairs and storing rejected candidates compactly reduces memory use during a call. Ambiguous collections can still require memory that grows with the square of their size and work that grows faster than their size. Equality results are never cached between calls.

Byte-oriented values can be compared in aligned blocks, with individual byte comparisons for unaligned views and remaining bytes. Typed arrays must still compare numeric values: changing them to byte comparisons would break NaN and signed-zero equality. Optimisations must also preserve own-property comparison, extra properties on built-ins, sparse array holes, and customiser calls.

See the [development guide](development.md#benchmarks-and-memory) for benchmarks and measurement methods. The [test coverage map](test-coverage.md) links these rules to their tests.
