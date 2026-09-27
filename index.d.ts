/** Synchronous binary comparison; no type narrowing is implied. */
export type EqualityComparator = (value: unknown, other: unknown) => boolean;
/** true/false settles the original pair; undefined delegates to the selected mode. */
export type EqualityCustomizer = (value: unknown, other: unknown) => boolean | undefined;
export type EqualityMode = 'default' | 'strict' | 'loose';
export interface EqualityOptions {
  /** Governs only pairs for which the customizer returns undefined. Defaults to 'default'. */
  readonly mode?: EqualityMode | undefined;
}
/** Deep value equality with attached modes and opt-in caller customisation. */
export interface EqualityFunction {
  (value: unknown, other: unknown): boolean;
  readonly strict: typeof isStrictEqual;
  readonly loose: typeof isLooseEqual;
  /** Compare now. Receives original pairs before identity, unboxing and instance hooks. */
  readonly custom: (value: unknown, other: unknown, customizer: EqualityCustomizer, options?: EqualityOptions) => boolean;
  /** Snapshot configuration once; return a plain binary comparator with fresh state per call. */
  readonly create: (customizer: EqualityCustomizer, options?: EqualityOptions) => EqualityComparator;
}
/** Deep value equality; genuine primitive wrappers are compared by their payload. */
export const isEqual: EqualityFunction;
/** Deep equality with primitive coercion and constructor-independent object structure. */
export function isLooseEqual(value: unknown, other: unknown): boolean;
/** Deep equality preserving primitive types, primitive wrappers, and constructors. */
export function isStrictEqual(value: unknown, other: unknown): boolean;
