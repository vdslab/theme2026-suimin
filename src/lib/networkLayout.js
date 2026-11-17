export function networkLayout(width, height) {
  const unit = Math.max(
    0.55,
    Math.min(1.6, Math.min(width / 700, height / 540)),
  );
  return { width, height, cx: width / 2, cy: height / 2, unit };
}

const endpointId = (endpoint) =>
  typeof endpoint === "object" ? endpoint.id : endpoint;

// Links contain only displayed beans, so population-wide flavor counts never
// influence Jaccard. Sets also prevent duplicate links from inflating scores.
export function computeAnchorOrder(flavorNodes, beanLinks) {
  const anchors = [...flavorNodes].sort((a, b) =>
    (a.flavor?.id ?? a.id).localeCompare(b.flavor?.id ?? b.id),
  );
  if (anchors.length < 3) return anchors;
  const sets = new Map(anchors.map((n) => [n.id, new Set()]));
  for (const link of beanLinks) {
    const source = endpointId(link.source);
    const target = endpointId(link.target);
    if (sets.has(source)) sets.get(source).add(target);
    if (sets.has(target)) sets.get(target).add(source);
  }
  const scores = anchors.map((a) =>
    anchors.map((b) => {
      const left = sets.get(a.id);
      const right = sets.get(b.id);
      const intersection = [...left].filter((id) => right.has(id)).length;
      const union = left.size + right.size - intersection;
      return union ? intersection / union : 0;
    }),
  );
  let best = anchors.map((_, i) => i);
  let bestScore = -1;
  // Fix the first anchor to remove rotations; skip mirrored tours. At most
  // 7! / 2 tours (8 anchors). Sorted traversal breaks ties deterministically.
  const visit = (order, remaining, score) => {
    if (!remaining.length) {
      if (order[1] > order[order.length - 1]) return;
      const total = score + scores[order[order.length - 1]][0];
      if (total > bestScore + 1e-12) {
        bestScore = total;
        best = [...order];
      }
      return;
    }
    for (const next of remaining) {
      visit(
        [...order, next],
        remaining.filter((i) => i !== next),
        score + scores[order[order.length - 1]][next],
      );
    }
  };
  visit([0], best.slice(1), 0);
  return best.map((i) => anchors[i]);
}

export function computeAnchorPositions(anchorNodes, width, height) {
  const rx = Math.max(0, width / 2 - 65);
  const ry = Math.max(0, height / 2 - 55);
  return new Map(
    anchorNodes.map((node, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / anchorNodes.length;
      return [
        node.id,
        {
          x: width / 2 + Math.cos(angle) * rx,
          y: height / 2 + Math.sin(angle) * ry,
        },
      ];
    }),
  );
}

export function computeBeanInitialPosition(beanNode, anchorPositionMap, links) {
  const connected = new Set();
  for (const link of links) {
    const source = endpointId(link.source);
    const target = endpointId(link.target);
    if (source === beanNode.id && anchorPositionMap.has(target))
      connected.add(target);
    if (target === beanNode.id && anchorPositionMap.has(source))
      connected.add(source);
  }
  const positions = [...connected].map((id) => anchorPositionMap.get(id));
  if (!positions.length) return null;
  return {
    x: positions.reduce((sum, p) => sum + p.x, 0) / positions.length,
    y: positions.reduce((sum, p) => sum + p.y, 0) / positions.length,
  };
}

// Leave a gap to the anchor ring even for beans connected to just one flavor.
export function constrainBeanPosition(node, layout) {
  const rx = Math.max(1, (layout.width / 2 - 65) * 0.8);
  const ry = Math.max(1, (layout.height / 2 - 55) * 0.8);
  const dx = node.x - layout.cx;
  const dy = node.y - layout.cy;
  const radius = Math.hypot(dx / rx, dy / ry);
  if (radius > 1) {
    node.x = layout.cx + dx / radius;
    node.y = layout.cy + dy / radius;
  }
}

// Keep the same node objects, including inspected nodes and drag pinning.
export function resizeNetworkNodes(nodes, previous, next) {
  const sx = next.width / previous.width;
  const sy = next.height / previous.height;
  for (const node of nodes) {
    node.x *= sx;
    node.y *= sy;
    node.vx *= sx;
    node.vy *= sy;
    if (node.fx != null) node.fx *= sx;
    if (node.fy != null) node.fy *= sy;
  }
}
