'use strict';

const compareObjects = require('./compareObjects');
const { typeInfo } = require('./typeInfo');

// Include browser HTMLDDA objects without allocating primitive wrappers.
const isObject = (value) =>
  value !== null && (typeof value === 'object' || (typeof value === 'undefined' && value !== undefined));
const sameValueZero = (a, b) => a === b || (a !== a && b !== b);

class ComparisonContext {
  constructor(mode) {
    this.mode = mode;
    // The context never escapes one synchronous comparison. Its nodes already
    // hold their inputs strongly; Map avoids a WeakMap allocation for EVERY row.
    this.pairs = new Map();
    this.types = new Map();
    this.pending = [];
  }

  info(value) {
    let info = this.types.get(value);
    if (!info) {
      info = typeInfo(value);
      this.types.set(value, info);
    }
    return info;
  }

  pair(left, right, queue = true) {
    if (left === right) {
      return true;
    }
    if (typeof left === 'function' || typeof right === 'function') {
      return false;
    }
    let leftObject = isObject(left);
    let rightObject = isObject(right);
    if (this.mode !== 'strict') {
      if (leftObject) {
        const info = this.info(left);
        if (info.boxed) {
          left = info.value;
          leftObject = false;
        }
      }
      if (rightObject) {
        const info = this.info(right);
        if (info.boxed) {
          right = info.value;
          rightObject = false;
        }
      }
    }
    if (!leftObject && !rightObject) {
      // Deliberately limit coercion to primitives: [] is not equal to 0.
      // eslint-disable-next-line eqeqeq -- Loose primitive comparison is the documented equality contract.
      return sameValueZero(left, right) || (this.mode === 'loose' && left == right);
    }
    if (!leftObject || !rightObject) {
      return false;
    }
    const first = this.pairs.get(left);
    if (first) {
      if (first.right === right) {
        return this.reference(first);
      }
      const known = first.alternatives && first.alternatives.get(right);
      if (known) {
        return this.reference(known);
      }
    }
    const node = {
      left,
      right,
      valid: true,
      expanded: false,
      queued: queue,
      dependants: null,
      watchers: null,
      collection: null,
      alternatives: null,
      hasDependencies: false
    };
    if (!first) {
      this.pairs.set(left, node);
    } else {
      if (!first.alternatives) {
        first.alternatives = new Map();
      }
      first.alternatives.set(right, node);
    }
    if (queue) {
      this.pending.push(node);
    }
    return node;
  }

  reference(node) {
    if (!node.valid) {
      return false;
    }
    // A fully checked leaf has no provisional assumptions to invalidate. Self
    // edges are tautologies in the greatest-fixed-point relation, not blockers.
    return node.expanded && !node.hasDependencies && !node.collection ? true : node;
  }

  probe(left, right) {
    // Most rejected collection candidates are settled leaves. Expand them now
    // without first retaining a queue entry for every unsuccessful trial.
    const ref = this.pair(left, right, false);
    if (typeof ref === 'boolean') {
      return ref;
    }
    const unexpanded = !ref.expanded;
    this.expand(ref);
    if (!ref.queued && !ref.hasDependencies && !ref.collection) {
      // The collection edge cache retains the boolean result. A settled leaf
      // cannot later be invalidated; provisional graph nodes MUST stay indexed.
      this.forgetLeaf(ref);
      return ref.valid;
    }
    // Only a newly expanded collection needs its initial matching queued here.
    // Re-enqueuing an already expanded cyclic ancestor would never terminate.
    if (unexpanded && ref.collection) {
      this.enqueue(ref);
    }
    return this.reference(ref);
  }

  forgetLeaf(node) {
    const first = this.pairs.get(node.left);
    if (first === node) {
      // An index header that also owns alternative pairs must remain available.
      if (!node.alternatives) {
        this.pairs.delete(node.left);
      }
    } else {
      first.alternatives.delete(node.right);
    }
  }

  expand(node) {
    if (node.expanded || !node.valid) {
      return;
    }
    if (!compareObjects(node, this)) {
      this.invalidate(node);
    }
    node.expanded = true;
  }

  enqueue(node) {
    if (node.valid && !node.queued) {
      node.queued = true;
      this.pending.push(node);
    }
  }

  watch(parent, ref) {
    if (typeof ref !== 'boolean') {
      // Probing a later edge can disprove an earlier edge on the same
      // augmenting path. A newly attached observer must see that failure too.
      if (!ref.valid) {
        this.enqueue(parent);
        return;
      }
      if (!ref.watchers) {
        ref.watchers = new Set();
      }
      ref.watchers.add(parent);
    }
  }

  require(parent, ref) {
    if (typeof ref === 'boolean') {
      return ref;
    }
    if (!ref.valid) {
      return false;
    }
    if (ref === parent) {
      return true;
    }
    parent.hasDependencies = true;
    // Most deterministic children have just one parent. Allocate an array only
    // for genuine sharing; adjacent duplicate dependencies need no new entry.
    const parents = ref.dependants;
    if (!parents) {
      ref.dependants = parent;
    } else if (Array.isArray(parents)) {
      if (parents[parents.length - 1] !== parent) {
        parents.push(parent);
      }
    } else if (parents !== parent) {
      ref.dependants = [parents, parent];
    }
    return true;
  }

  invalidate(node) {
    const invalid = [node];
    while (invalid.length) {
      const current = invalid.pop();
      if (!current.valid) {
        continue;
      }
      current.valid = false;
      // Required property/value edges propagate failure immediately. Only
      // alternative collection edges need a queued matching repair.
      if (current.watchers) {
        for (const parent of current.watchers) {
          this.enqueue(parent);
        }
      }
      const parents = current.dependants;
      if (Array.isArray(parents)) {
        for (const parent of parents) {
          if (parent.valid) {
            invalid.push(parent);
          }
        }
      } else if (parents && parents.valid) {
        invalid.push(parents);
      }
    }
  }

  run(left, right) {
    const root = this.pair(left, right);
    if (typeof root === 'boolean') {
      return root;
    }
    // A finite, monotone greatest fixed point: assumptions only turn false.
    // Drain/reuse the FIFO queue rather than retaining a processed entry for
    // every level of a deep chain. Mandatory invalidation is also iterative.
    let next = 0;
    while (this.pending.length && root.valid) {
      const node = this.pending[next];
      this.pending[next++] = null;
      if (next === this.pending.length) {
        this.pending.length = 0;
        next = 0;
      }
      node.queued = false;
      if (!node.valid) {
        continue;
      }
      this.expand(node);
      if (node.valid && node.collection && !node.collection.validate()) {
        this.invalidate(node);
      }
    }
    return root.valid;
  }
}

module.exports = ComparisonContext;
