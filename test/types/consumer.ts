import { isEqual, isLooseEqual, isStrictEqual } from 'go-equality';
const values: boolean[] = [isEqual({x: 1}, {x: 1}), isLooseEqual(1, '1'), isStrictEqual(1, Object(1))];
function checkUnknown(value: unknown): boolean {
  return isEqual(value, 1);
}
// @ts-expect-error both operands are required
isEqual(1);
// @ts-expect-error equality functions return booleans, not arbitrary values
const result: string = isStrictEqual(null, undefined);
function noTypeGuard(value: unknown): void {
  if (isEqual(value, 1)) {
    // @ts-expect-error this comparator does not narrow an unknown value to number
    value.toFixed();
  }
}
void values; void checkUnknown; void noTypeGuard; void result;

import type { EqualityComparator, EqualityCustomizer, EqualityMode, EqualityOptions, EqualityFunction } from 'go-equality';
const customizer: EqualityCustomizer = (left, right) => {
  if (typeof left === 'string' && typeof right === 'string') return left.toLowerCase() === right.toLowerCase();
  return undefined;
};
const mode: EqualityMode = 'strict';
const options: EqualityOptions = { mode };
const grouped: EqualityFunction = isEqual;
const strict: EqualityComparator = isEqual.strict;
const loose: EqualityComparator = isEqual.loose;
const customResult: boolean = isEqual.custom({ name: 'UP' }, { name: 'up' }, customizer, options);
const customCompare: EqualityComparator = isEqual.create(customizer, { mode: 'loose' });
const createdResult: boolean = customCompare('A', 'a');
isEqual.custom(undefined, undefined, () => undefined, { mode: undefined });
// @ts-expect-error custom() compares now; it does not return a function
isEqual.custom(1, 2, customizer)(1, 2);
// @ts-expect-error customizer is required
isEqual.custom(1, 2);
// @ts-expect-error create() requires a customizer
isEqual.create();
// @ts-expect-error customizers must return a primitive boolean or undefined
isEqual.create(() => 'yes');
// @ts-expect-error asynchronous customizers are not supported
isEqual.custom(1, 2, async () => true);
// @ts-expect-error unknown mode
isEqual.create(customizer, { mode: 'Strict' });
// @ts-expect-error unknown option
isEqual.create(customizer, { strict: true });
// @ts-expect-error options cannot be null
isEqual.create(customizer, null);
// @ts-expect-error aliases are read-only
isEqual.strict = isStrictEqual;
// @ts-expect-error attached factory is read-only
isEqual.create = () => isEqual;
// @ts-expect-error returned comparator is a plain binary function
customCompare.loose(1, '1');
// @ts-expect-error returned comparator needs both operands
customCompare(1);
// @ts-expect-error customizer must accept arbitrary compared values, not just strings
isEqual.create((a: string, b: string) => a === b);
function noCustomTypeGuard(value: unknown): void {
  if (customCompare(value, 1)) {
    // @ts-expect-error custom comparison is not a type guard
    value.toFixed();
  }
}
void grouped; void strict; void loose; void customResult; void createdResult; void noCustomTypeGuard;
