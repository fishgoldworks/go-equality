import Eq, { isEqual, isLooseEqual, isStrictEqual } from 'go-equality';
// @ts-expect-error the default API is an object, not a callable comparator
Eq(1, 1);
// @ts-expect-error default imports retain required operands
Eq.isEqual(1);
// @ts-expect-error default imports reject unknown methods
void Eq.compare;
const values: boolean[] = [isEqual({ x: 1 }, { x: 1 }), isLooseEqual(1, '1'), isStrictEqual(1, Object(1))];
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
    value.toFixed(); // eslint-disable-line @typescript-eslint/no-unsafe-call -- Compiler must reject narrowing.
  }
}
void values;
void checkUnknown;
void noTypeGuard;
void result;

import type {
  EqualityComparator,
  EqualityCustomizer,
  EqualityMode,
  EqualityOptions,
  EqualityFunction
} from 'go-equality';
const customizer: EqualityCustomizer = (left, right) => {
  if (typeof left === 'string' && typeof right === 'string') {
    return left.toLowerCase() === right.toLowerCase();
  }
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
// @ts-expect-error customiser is required
isEqual.custom(1, 2);
// @ts-expect-error create() requires a customiser
isEqual.create();
// @ts-expect-error customisers must return a primitive boolean or undefined
isEqual.create(() => 'yes');
// @ts-expect-error asynchronous customisers are not supported
isEqual.custom(1, 2, async () => true); // eslint-disable-line @typescript-eslint/require-await -- Compiler must reject async callbacks.
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
// @ts-expect-error customisation is available only on isEqual
void isEqual.strict.custom;
// @ts-expect-error customisation is available only on isEqual
void isEqual.strict.create;
// @ts-expect-error customisation is available only on isEqual
void isEqual.loose.custom;
// @ts-expect-error customisation is available only on isEqual
void isEqual.loose.create;
// @ts-expect-error customisation is available only on isEqual
void isStrictEqual.custom;
// @ts-expect-error customisation is available only on isEqual
void isStrictEqual.create;
// @ts-expect-error customisation is available only on isEqual
void isLooseEqual.custom;
// @ts-expect-error customisation is available only on isEqual
void isLooseEqual.create;
// @ts-expect-error returned comparator is a plain binary function
customCompare.loose(1, '1'); // eslint-disable-line @typescript-eslint/no-unsafe-call -- Compiler must reject absent modes.
// @ts-expect-error returned comparator needs both operands
customCompare(1);
// @ts-expect-error customiser must accept arbitrary compared values, not just strings
isEqual.create((a: string, b: string) => a === b);
function noCustomTypeGuard(value: unknown): void {
  if (customCompare(value, 1)) {
    // @ts-expect-error custom comparison is not a type guard
    value.toFixed(); // eslint-disable-line @typescript-eslint/no-unsafe-call -- Compiler must reject narrowing.
  }
}
void grouped;
void strict;
void loose;
void customResult;
void createdResult;
void noCustomTypeGuard;

// A customiser is called without a receiver. Bound rules remain valid.
function compareWithSettings(this: { ignoreCase: boolean }, left: unknown, right: unknown): boolean | undefined {
  if (typeof left === 'string' && typeof right === 'string') {
    return this.ignoreCase ? left.toLowerCase() === right.toLowerCase() : left === right;
  }
  return undefined;
}
// @ts-expect-error an unbound rule requires a receiver the library does not provide
const unboundRule: EqualityCustomizer = compareWithSettings;
// @ts-expect-error custom() does not bind the rule's required receiver
isEqual.custom('ADMIN', 'admin', compareWithSettings);
// @ts-expect-error create() does not bind the rule's required receiver
isEqual.create(compareWithSettings);
const settings = { ignoreCase: true };
const boundRule: EqualityCustomizer = compareWithSettings.bind(settings);
isEqual.custom('ADMIN', 'admin', boundRule);
isEqual.create(boundRule)('ADMIN', 'admin');
isEqual.create((left, right) => compareWithSettings.call(settings, left, right));
const undefinedReceiver = function (this: undefined, left: unknown, right: unknown) {
  return left === right;
};
const voidReceiver = function (this: void, left: unknown, right: unknown) {
  return left === right;
};
isEqual.create(undefinedReceiver);
isEqual.create(voidReceiver);
void unboundRule;

// Root inputs do not narrow a callback: it can receive nested pairs of other types.
isEqual.custom('ADMIN', 'admin', (left, right) => {
  // @ts-expect-error inline callback values are unknown, not inferred from root strings
  const leftText: string = left;
  // @ts-expect-error both inline callback values require narrowing
  const rightText: string = right;
  void leftText;
  void rightText;
  if (typeof left === 'string' && typeof right === 'string') {
    return left.toLowerCase() === right.toLowerCase();
  }
  return undefined;
});

const inferredComparator = isEqual.create(function (left, right) {
  // The contextual receiver is unavailable, not the EqualityFunction or an any value.
  // eslint-disable-next-line @typescript-eslint/no-this-alias -- Check contextual this on older compilers.
  const receiver: undefined = this;
  void receiver;
  // @ts-expect-error no receiver object is supplied to an unbound callback
  void this.ignoreCase;
  // @ts-expect-error factory callbacks also receive unknown values
  const leftNumber: number = left;
  // @ts-expect-error both factory callback values require narrowing
  const rightNumber: number = right;
  void leftNumber;
  void rightNumber;
  if (typeof left === 'number' && typeof right === 'number') {
    return left === right;
  }
  return undefined;
});
const inferredBoolean = inferredComparator({ count: 1 }, { count: 1 });
const inferredSignature: (left: unknown, right: unknown) => boolean = inferredComparator;
// @ts-expect-error the unannotated factory result still returns boolean, not any
const wrongInferredReturn: string = inferredBoolean;
// @ts-expect-error it requires both operands even when no explicit type is written
inferredComparator(1);
// @ts-expect-error the plain returned comparator has no strict mode
void inferredComparator.strict;
// @ts-expect-error the plain returned comparator has no loose mode
void inferredComparator.loose;
// @ts-expect-error the plain returned comparator cannot be customised again
void inferredComparator.custom;
// @ts-expect-error the plain returned comparator is not a factory
void inferredComparator.create;
// @ts-expect-error boolean comparison is not a positive or negative type guard
const inferredGuard: (left: unknown, right: unknown) => left is string = inferredComparator;
void inferredSignature;
void wrongInferredReturn;
void inferredGuard;

const { custom: detachedCustom, create: detachedCreate } = isEqual;
const detachedResult: boolean = detachedCustom(1, '1', () => undefined, { mode: 'loose' });
const detachedComparator = detachedCreate(() => undefined, { mode: undefined });
const detachedComparison: boolean = detachedComparator(undefined, undefined);
// @ts-expect-error a detached immediate comparison still requires a customiser
detachedCustom(1, 1);
// @ts-expect-error the declared configuration view is read-only
options.mode = 'loose';
// @ts-expect-error attached loose mode is read-only
isEqual.loose = isLooseEqual;
// @ts-expect-error attached custom comparison is read-only
isEqual.custom = detachedCustom;
// @ts-expect-error boxed boolean results are not valid customiser decisions
isEqual.create(() => new Boolean(true));
// @ts-expect-error null is not a delegation result
isEqual.create(() => null);
// @ts-expect-error an async decision is not accepted by the factory
isEqual.create(async () => true); // eslint-disable-line @typescript-eslint/require-await -- Compiler must reject async callbacks.
void detachedResult;
void detachedComparison;
