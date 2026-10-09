/**
 * A synchronous function that determines whether two values are equal under its
 * comparison rules. Its `boolean` result does not narrow their TypeScript types.
 */
export type EqualityComparator = (value: unknown, other: unknown) => boolean;
/**
 * A callback that supplies a custom equality rule for a pair of values.
 *
 * Return `true` or `false` to decide that pair, or `undefined` to use the selected
 * standard mode. Receives original values before identity checks, wrapper
 * unboxing and `equals()` methods. It may run for nested pairs, but is not a
 * guaranteed visitor; call order and counts can vary.
 *
 * Called without a receiver. Bind callbacks that declare a required `this` object
 * before passing them; arrow callbacks can capture their surrounding state.
 *
 * Keep inputs unchanged. The callback must be synchronous; a non-boolean result
 * other than `undefined` causes `TypeError`, and thrown errors propagate.
 * @see https://github.com/koyote130708/go-equality/blob/master/docs/API.md#caller-customisers
 */
export type EqualityCustomizer = (this: undefined, value: unknown, other: unknown) => boolean | undefined;
/**
 * Selects standard comparison rules. Default mode compares wrappers by their
 * primitive values; strict mode preserves them; loose mode also allows primitive
 * conversions and different ordinary-object constructors.
 */
export type EqualityMode = 'default' | 'strict' | 'loose';
/** Configures the standard comparison used when a customiser leaves a pair undecided. */
export interface EqualityOptions {
  /** Used when the callback returns `undefined`. Omitted or `undefined` selects `'default'`. */
  readonly mode?: EqualityMode | undefined;
}
/** A deep-comparison function with strict, loose and custom comparison methods. */
export interface EqualityFunction {
  /**
   * Determines whether two values are deeply equal.
   *
   * Compares nested contents of arrays and supported objects, so separate objects
   * can compare equal. Primitive wrappers use their contained values: `Object(1)`
   * equals `1`, but the number `1` does not equal the string `'1'`.
   *
   * Applicable `equals()` methods can override standard rules. Errors from getters,
   * proxy traps, invoked methods and invalid binary views propagate.
   * @param value The first value to compare.
   * @param other The second value to compare.
   * @returns `true` if the values are deeply equal; otherwise `false`.
   * @throws `TypeError` if an invoked `equals()` method returns a non-boolean.
   * @see https://github.com/koyote130708/go-equality/blob/master/docs/API.md#isequalvalue-other
   */
  (value: unknown, other: unknown): boolean;
  /**
   * Determines whether two values are deeply equal, preserving primitive types and
   * distinguishing wrapper objects from primitive values.
   *
   * The same function as `isStrictEqual`.
   * @see https://github.com/koyote130708/go-equality/blob/master/docs/API.md#isequalstrictvalue-other
   */
  readonly strict: typeof isStrictEqual;
  /**
   * Determines whether two values are deeply equal, allowing primitive conversions
   * such as `1` matching `'1'`.
   *
   * The same function as `isLooseEqual`.
   * @see https://github.com/koyote130708/go-equality/blob/master/docs/API.md#isequalloosevalue-other
   */
  readonly loose: typeof isLooseEqual;
  /**
   * Determines whether two values are deeply equal, using your callback to override
   * individual comparisons.
   *
   * Return `true` or `false` from the callback to decide a pair, or `undefined` to use
   * the selected mode. The callback runs before identity checks and can reject
   * identical values. It is not guaranteed to visit every nested value.
   *
   * @param value The first value to compare.
   * @param other The second value to compare.
   * @param customizer A synchronous callback that leaves its inputs unchanged.
   * @param options Options selecting a fallback mode; an omitted `mode` selects `'default'`.
   * @returns `true` if the values are equal under the custom rules
   * and fallback mode; otherwise `false`.
   * @throws `TypeError` for invalid configuration, callback or hook results. Errors from
   * invoked user code or invalid binary views propagate.
   * @see https://github.com/koyote130708/go-equality/blob/master/docs/API.md#isequalcustomvalue-other-customizer-options
   */
  readonly custom: (
    value: unknown,
    other: unknown,
    customizer: EqualityCustomizer,
    options?: EqualityOptions
  ) => boolean;
  /**
   * Creates a reusable function for deep comparison using your callback and a saved
   * fallback mode.
   *
   * Validates the configuration once and saves the fallback mode. It does not
   * compare values or run the callback until the returned function is called.
   * Each comparison has fresh state; results are not cached between calls.
   *
   * @param customizer A synchronous callback returning `boolean` or `undefined`.
   * @param options Options selecting a fallback mode; an omitted `mode` selects `'default'`.
   * @returns A function accepting two values and returning a `boolean`.
   * @throws `TypeError` for invalid configuration at creation, or invalid callback
   * results during comparison. Errors from comparisons propagate to the caller.
   * @see https://github.com/koyote130708/go-equality/blob/master/docs/API.md#isequalcreatecustomizer-options
   */
  readonly create: (customizer: EqualityCustomizer, options?: EqualityOptions) => EqualityComparator;
}
/** Determines whether two values are deeply equal. Callable documentation is on `EqualityFunction`. */
export const isEqual: EqualityFunction;
/**
 * Determines whether two values are deeply equal, allowing primitive conversions
 * such as `1` matching `'1'`.
 *
 * The conversions also apply inside nested data. Primitive wrappers use their
 * contained values, and ordinary object constructors may differ. Arbitrary
 * objects are not converted to primitives. Applicable `equals()` methods can
 * override standard rules; inspection and user-code errors propagate.
 * @param value The first value to compare.
 * @param other The second value to compare.
 * @returns `true` if the values are deeply equal under loose
 * comparison rules; otherwise `false`.
 * @throws `TypeError` if an invoked `equals()` method returns a non-boolean.
 * @see https://github.com/koyote130708/go-equality/blob/master/docs/API.md#islooseequalvalue-other
 */
export function isLooseEqual(value: unknown, other: unknown): boolean;
/**
 * Determines whether two values are deeply equal, preserving primitive types and
 * distinguishing wrapper objects from primitive values.
 *
 * Separate objects can match by their contents. A wrapper is distinct from its
 * primitive value; two wrappers can match by their values and own properties.
 * Resolved `constructor` properties must match with `===` unless applicable
 * `equals()` methods override that check.
 * Inspection and user-code errors propagate.
 * @param value The first value to compare.
 * @param other The second value to compare.
 * @returns `true` if the values are deeply equal under strict
 * comparison rules; otherwise `false`.
 * @throws `TypeError` if an invoked `equals()` method returns a non-boolean.
 * @see https://github.com/koyote130708/go-equality/blob/master/docs/API.md#isstrictequalvalue-other
 */
export function isStrictEqual(value: unknown, other: unknown): boolean;
