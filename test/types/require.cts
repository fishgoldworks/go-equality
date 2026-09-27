import Equality = require('go-equality');

const equal: boolean = Equality.isEqual({ id: 1 }, { id: 1 });
const strict: Equality.EqualityComparator = Equality.isEqual.strict;
const custom: Equality.EqualityComparator = Equality.isEqual.create(() => undefined, { mode: 'loose' });
const result: boolean = custom(1, '1');
// @ts-expect-error the CommonJS export is a namespace, not a callable default
Equality(1, 1);
// @ts-expect-error the factory returns a plain comparator without attached modes
custom.strict(1, 1);
void equal; void strict; void result;
