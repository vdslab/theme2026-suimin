// Matrix reordering: average-linkage hierarchical clustering on correlation
// distance, then optimal leaf ordering (Bar-Joseph et al. 2001) so that
// adjacent rows are as similar as possible.

export function correlationDistance(a, b) {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  if (!da || !db) return 1;
  return 1 - num / Math.sqrt(da * db);
}

export function distanceMatrix(vectors, distance = correlationDistance) {
  return vectors.map((a, i) =>
    vectors.map((b, j) => (i === j ? 0 : distance(a, b))),
  );
}

// Returns the root of a binary tree: leaves are { index }, internal nodes
// { left, right, height, leaves }.
export function averageLinkage(dist) {
  let clusters = dist.map((_, index) => ({
    index,
    leaves: [index],
    height: 0,
  }));
  const avg = (a, b) => {
    let s = 0;
    for (const i of a.leaves) for (const j of b.leaves) s += dist[i][j];
    return s / (a.leaves.length * b.leaves.length);
  };
  while (clusters.length > 1) {
    let best = [0, 1, Infinity];
    for (let i = 0; i < clusters.length; i++)
      for (let j = i + 1; j < clusters.length; j++) {
        const d = avg(clusters[i], clusters[j]);
        if (d < best[2]) best = [i, j, d];
      }
    const [i, j, height] = best;
    const merged = {
      left: clusters[i],
      right: clusters[j],
      height,
      leaves: [...clusters[i].leaves, ...clusters[j].leaves],
    };
    clusters = clusters.filter((_, q) => q !== i && q !== j);
    clusters.push(merged);
  }
  return clusters[0];
}

// Flips subtrees so that the sum of distances between neighbors is minimal.
// Mutates and returns the tree; `tree.leaves` is the new order.
export function optimalLeafOrder(tree, dist) {
  const memo = new Map();
  // best[i][j]: cost of ordering `node` from leaf i to leaf j, with the
  // choices needed to rebuild that order.
  const solve = (node) => {
    if (memo.has(node)) return memo.get(node);
    const table = new Map();
    if (node.index !== undefined) {
      table.set(`${node.index},${node.index}`, { cost: 0 });
      memo.set(node, table);
      return table;
    }
    const L = solve(node.left);
    const R = solve(node.right);
    const ends = (child, i) =>
      child.index !== undefined
        ? [i]
        : child.left.leaves.includes(i)
          ? child.right.leaves
          : child.left.leaves;
    for (const i of node.left.leaves) {
      const ks = ends(node.left, i);
      for (const j of node.right.leaves) {
        const ms = ends(node.right, j);
        let best = { cost: Infinity };
        for (const k of ks) {
          const left = L.get(`${i},${k}`).cost;
          for (const m of ms) {
            const cost = left + dist[k][m] + R.get(`${m},${j}`).cost;
            if (cost < best.cost) best = { cost, k, m };
          }
        }
        table.set(`${i},${j}`, best);
        table.set(`${j},${i}`, { ...best, reversed: true });
      }
    }
    memo.set(node, table);
    return table;
  };
  const build = (node, i, j) => {
    if (node.index !== undefined) return [node.index];
    const entry = memo.get(node).get(`${i},${j}`);
    if (entry.reversed) return build(node, j, i).reverse();
    return [...build(node.left, i, entry.k), ...build(node.right, entry.m, j)];
  };
  const table = solve(tree);
  let best = null;
  for (const [key, entry] of table)
    if (!best || entry.cost < best[1].cost) best = [key, entry];
  const [i, j] = best[0].split(",").map(Number);
  const order = build(tree, i, j);
  // Rewrite the tree so that drawing it left to right follows `order`.
  const position = new Map(order.map((leaf, p) => [leaf, p]));
  const fix = (node) => {
    if (node.index !== undefined) return;
    fix(node.left);
    fix(node.right);
    const first = (n) => Math.min(...n.leaves.map((l) => position.get(l)));
    if (first(node.left) > first(node.right))
      [node.left, node.right] = [node.right, node.left];
    node.leaves = [...node.left.leaves, ...node.right.leaves];
  };
  fix(tree);
  return tree;
}

export function reorder(vectors) {
  if (vectors.length < 3)
    return { order: vectors.map((_, i) => i), tree: null };
  const dist = distanceMatrix(vectors);
  const tree = optimalLeafOrder(averageLinkage(dist), dist);
  return { order: tree.leaves, tree };
}

// Cuts the tree into at most `k` groups by splitting the highest merges.
export function cutTree(tree, k) {
  let groups = [tree];
  while (groups.length < k) {
    const splittable = groups.filter((g) => g.index === undefined);
    if (!splittable.length) break;
    const top = splittable.reduce((a, b) => (a.height >= b.height ? a : b));
    groups = groups.flatMap((g) => (g === top ? [g.left, g.right] : [g]));
  }
  const group = new Map();
  groups.forEach((g, q) => {
    for (const leaf of g.leaves ?? [g.index]) group.set(leaf, q);
  });
  return group;
}
