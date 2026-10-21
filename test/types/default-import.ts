import Eq, { isEqual, isLooseEqual, isStrictEqual } from 'go-equality';

const equal: boolean = Eq.isEqual({ id: 1 }, { id: 1 });
const loose: boolean = Eq.isLooseEqual(1, '1');
const strict: boolean = Eq.isStrictEqual(1, Object(1));
const custom: boolean = Eq.isEqual.custom(1, 2, () => true);
const compare = Eq.isEqual.create(() => undefined, { mode: 'loose' });
if (!equal || !loose || strict || !custom || !compare(1, '1')) {
  throw new Error('Default import comparison failed');
}
if (Eq.isEqual !== isEqual || Eq.isLooseEqual !== isLooseEqual || Eq.isStrictEqual !== isStrictEqual) {
  throw new Error('Default and named exports must share their functions');
}
if (Eq.isEqual.strict !== isStrictEqual || Eq.isEqual.loose !== isLooseEqual) {
  throw new Error('Default import must retain attached aliases');
}

// A rule with an explicit receiver works after binding it or wrapping the call.
const settings = {
  ignoreCase: true,
  compare(this: { ignoreCase: boolean }, left: unknown, right: unknown) {
    if (typeof left === 'string' && typeof right === 'string') {
      return this.ignoreCase ? left.toLowerCase() === right.toLowerCase() : left === right;
    }
    return undefined;
  }
};
const boundRule = settings.compare.bind(settings);
const wrappedRule = (left: unknown, right: unknown) => settings.compare(left, right);
const boundCompare = Eq.isEqual.create(boundRule);
const { custom: compareNow, create: createComparator } = Eq.isEqual;
if (
  !compareNow('ADMIN', 'admin', boundRule) ||
  !boundCompare({ role: 'ADMIN', count: 1 }, { role: 'admin', count: 1 }) ||
  boundCompare({ role: 'ADMIN', count: 1 }, { role: 'admin', count: 2 }) ||
  !createComparator(wrappedRule)('ADMIN', 'admin')
) {
  throw new Error('Bound and wrapped customisers must retain their receiver and fallback rules');
}
const noReceiverCompare = isEqual.create(function (left, right) {
  // eslint-disable-next-line @typescript-eslint/no-this-alias -- Check contextual this on pre-satisfies compilers.
  const receiver: undefined = this;
  if (receiver !== undefined) {
    throw new Error('An unbound customiser must not receive a comparison context');
  }
  return typeof left === 'string' && typeof right === 'string' ? left === right : undefined;
});
if (!noReceiverCompare({ role: 'admin' }, { role: 'admin' })) {
  throw new Error('The contextual no-receiver callback must work for nested pairs');
}
