'use strict';

// Try every owned cleanup and retain errors in their original order, including
// falsy values thrown by a failed check. A single failure keeps its identity.
function runCleanups(cleanups, errors = []) {
  const failures = [...errors];
  for (const cleanup of cleanups) {
    try {
      cleanup();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) {
    throw failures[0];
  }
  if (failures.length > 1) {
    throw new AggregateError(failures, 'Verification and cleanup reported multiple errors.');
  }
}

module.exports = runCleanups;
