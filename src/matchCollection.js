'use strict';

// Find one-to-one matches as needed. Try native matches first, but allow
// augmenting paths to reassign them when loose or custom equality requires it.
class CollectionMatcher {
  constructor(node, context, left, right, isMap) {
    this.node = node;
    this.context = context;
    this.left = left;
    this.right = right;
    this.isMap = isMap;
    this.size = left.length;
    this.leftMatch = new Int32Array(this.size).fill(-1);
    this.rightMatch = new Int32Array(this.size).fill(-1);
    this.edges = new Array(this.size);
    this.rejected = null;
    this.rejectionCounts = null;
    this.rightIndex = new Map();
    for (let i = 0; i < right.length; i++) {
      this.rightIndex.set(isMap ? right[i][0] : right[i], i);
    }
    this.visited = null;
    this.parent = null;
    this.rows = null;
  }

  edge(i, j) {
    const rejected = this.rejected && this.rejected[i];
    if (rejected && rejected[j >>> 3] & (1 << (j & 7))) {
      return false;
    }
    let row = this.edges[i];
    if (!row) {
      this.edges[i] = row = new Map();
    }
    let ref = row.get(j);
    if (ref === undefined) {
      const a = this.left[i];
      const b = this.right[j];
      ref = this.context.probe(this.isMap ? a[0] : a, this.isMap ? b[0] : b);
      if (this.isMap && ref !== false) {
        const value = this.context.probe(a[1], b[1]);
        if (value === false || ref === true) {
          ref = value;
        } else if (value !== true) {
          ref = [ref, value];
        }
      }
      if (ref === false) {
        this.reject(i, j, row, rejected);
      } else {
        row.set(j, ref);
      }
    }
    // Completed leaf comparisons and failures use booleans. A Map entry needs
    // two dependency references only while both its key and value are unresolved.
    if (typeof ref === 'boolean') {
      return ref;
    }
    return Array.isArray(ref) ? ref[0].valid && ref[1].valid : ref.valid;
  }

  reject(i, j, row, rejected) {
    if (rejected) {
      rejected[j >>> 3] |= 1 << (j & 7);
      return;
    }
    row.set(j, false);
    if (!this.rejectionCounts) {
      this.rejectionCounts = new Uint8Array(this.size);
    }
    if (++this.rejectionCounts[i] !== 64) {
      return;
    }
    // After many failures in a row, store one bit per rejected candidate to
    // save space. Successful and unresolved candidates stay in the Map;
    // unresolved candidates need their dependency references.
    if (!this.rejected) {
      this.rejected = new Array(this.size);
    }
    const bits = (this.rejected[i] = new Uint8Array(Math.ceil(this.size / 8)));
    for (const [column, ref] of row) {
      if (ref === false) {
        bits[column >>> 3] |= 1 << (column & 7);
        row.delete(column);
      }
    }
  }

  preferred(i) {
    return this.rightIndex.get(this.isMap ? this.left[i][0] : this.left[i]);
  }

  assign(i, j) {
    this.leftMatch[i] = j;
    this.rightMatch[j] = i;
    const ref = this.edges[i].get(j);
    // Recheck the collection if a selected match later fails. Old watchers can
    // safely remain: removing one would require reference counts when several
    // selected matches depend on the same pair.
    if (Array.isArray(ref)) {
      this.context.watch(this.node, ref[0]);
      this.context.watch(this.node, ref[1]);
    } else {
      this.context.watch(this.node, ref);
    }
  }

  augment(start) {
    const preferred = this.preferred(start);
    if (preferred !== undefined && this.rightMatch[preferred] === -1 && this.edge(start, preferred)) {
      this.assign(start, preferred);
      return true;
    }
    // Reuse scratch space across searches. Parent slots are written before
    // use; only the visited mask needs resetting for each augmenting path.
    if (!this.visited) {
      this.visited = new Uint8Array(this.size);
      this.parent = new Int32Array(this.size);
      this.rows = new Int32Array(this.size);
    } else {
      this.visited.fill(0);
    }
    const visited = this.visited;
    const parent = this.parent;
    const rows = this.rows;
    rows[0] = start;
    let count = 1;
    for (let next = 0; next < count; next++) {
      const i = rows[next];
      const first = this.preferred(i);
      for (let step = -1; step < this.size; step++) {
        const j = step === -1 ? first : step;
        if (j === undefined || (step !== -1 && j === first) || visited[j] || !this.edge(i, j)) {
          continue;
        }
        visited[j] = 1;
        parent[j] = i;
        const previous = this.rightMatch[j];
        if (previous !== -1) {
          rows[count++] = previous;
          continue;
        }
        let column = j;
        while (column !== -1) {
          const row = parent[column];
          const oldColumn = this.leftMatch[row];
          this.assign(row, column);
          column = oldColumn;
        }
        return true;
      }
    }
    return false;
  }

  validate() {
    // Invalidated cyclic assumptions can reopen assignments. Only the absence
    // of a full matching disproves a collection, not an individual candidate.
    for (let i = 0; i < this.size; i++) {
      const j = this.leftMatch[i];
      if (j !== -1 && !this.edge(i, j)) {
        this.leftMatch[i] = -1;
        this.rightMatch[j] = -1;
      }
    }
    for (let i = 0; i < this.size; i++) {
      if (this.leftMatch[i] === -1 && !this.augment(i)) {
        return false;
      }
    }
    return true;
  }
}

module.exports = CollectionMatcher;
