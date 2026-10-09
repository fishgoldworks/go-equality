'use strict';

// Supported native ESM release lines; CommonJS consumers have a separate floor.
module.exports = function supportsNativeEsm(version) {
  const [major, minor] = version.trim().replace(/^v/, '').split('.').map(Number);
  return major > 14 || (major === 14 && minor >= 13) || (major === 12 && minor >= 20);
};
