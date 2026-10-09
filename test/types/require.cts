// eslint-disable-next-line @typescript-eslint/no-require-imports -- This fixture tests CommonJS import-equals support.
import Eq = require('go-equality');

const equal: boolean = Eq.isEqual({ id: 1 }, { id: 1 });
const strict: Eq.EqualityComparator = Eq.isEqual.strict;
const custom: Eq.EqualityComparator = Eq.isEqual.create(() => undefined, { mode: 'loose' });
const result: boolean = custom(1, '1');
// @ts-expect-error the CommonJS export is a namespace, not a callable default
Eq(1, 1);
// @ts-expect-error the factory returns a plain comparator without attached modes
custom.strict(1, 1); // eslint-disable-line @typescript-eslint/no-unsafe-call -- Compiler must reject absent modes.
void equal;
void strict;
void result;
