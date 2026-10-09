'use strict';
console.error(
  'This is the private development root. Use npm run pack:package, verify the resulting tarball with npm run verify:all -- --tarball <tarball>, and publish that exact verified archive.'
);
process.exitCode = 1;
