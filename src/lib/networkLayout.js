import { forceSimulation, forceCollide, forceX, forceY } from "d3-force";

export const FORCE_SETTINGS = {
  centroidStrength: 0.45,
  beanRadius: 11,
  collisionIterations: 4,
};

// No link force or shared center force: every bean has its own combination
// target. Anchors remain fixed obstacles; their mutual layout is solved above.
export function createBeanSimulation(nodes, layout) {
  const { scale } = anchorGeometry(layout.width, layout.height);
  return forceSimulation(nodes)
    .force(
      "collide",
      forceCollide(
        (n) => (n.type === "bean" ? FORCE_SETTINGS.beanRadius : 38) * scale,
      ).iterations(FORCE_SETTINGS.collisionIterations),
    )
    .force(
      "x",
      forceX((n) => n.targetX ?? n.fx).strength(
        FORCE_SETTINGS.centroidStrength,
      ),
    )
    .force(
      "y",
      forceY((n) => n.targetY ?? n.fy).strength(
        FORCE_SETTINGS.centroidStrength,
      ),
    );
}

export function networkLayout(width, height) {
  const unit = Math.max(
    0.55,
    Math.min(1.6, Math.min(width / 700, height / 540)),
  );
  return { width, height, cx: width / 2, cy: height / 2, unit };
}

const endpointId = (endpoint) =>
  typeof endpoint === "object" ? endpoint.id : endpoint;

// Shared geometry keeps the fixed-anchor solver independent of D3 forces.
export function anchorGeometry(width, height) {
  const scale = Math.min(1, width / 320, height / 340);
  return {
    scale,
    cx: width / 2,
    cy: height / 2,
    rx: Math.max(1e-6, width / 2 - 52 * scale),
    ry: Math.max(1e-6, height / 2 - 46 * scale),
    selectedRadius: Math.min(110, width * 0.15, height * 0.16),
  };
}

export function computeSelectedPositions(selected, width, height) {
  const { cx, cy, selectedRadius, rx, ry, scale } = anchorGeometry(
    width,
    height,
  );
  // Equilateral triangle height = 1.5 * circumradius. Aim for 55% of
  // viewport height, limiting by width and the outer ring on narrow screens.
  const r =
    selected.length === 3
      ? Math.min(
          (height * 0.55) / 1.5,
          ry - 8 * scale,
          0.94 / Math.hypot(Math.sqrt(3) / (2 * rx), 1 / (2 * ry)),
        )
      : selected.length === 2
        ? Math.min(width * 0.22, rx - 44 * scale, height * 0.3)
        : selectedRadius;
  return new Map(
    selected.map((node, i) => {
      if (selected.length === 1) return [node.id, { x: cx, y: cy }];
      if (selected.length === 2)
        return [node.id, { x: cx + (i === 0 ? -r : r), y: cy }];
      // Selection order is always top, bottom-left, bottom-right.
      const angle = -Math.PI / 2 - (i * Math.PI * 2) / 3;
      return [
        node.id,
        { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r },
      ];
    }),
  );
}

function displayedBeanSets(anchors, links) {
  const sets = new Map(anchors.map((n) => [n.id, new Set()]));
  for (const link of links) {
    const source = endpointId(link.source),
      target = endpointId(link.target);
    if (sets.has(source)) sets.get(source).add(target);
    if (sets.has(target)) sets.get(target).add(source);
  }
  return sets;
}

const jaccard = (left, right) => {
  const intersection = [...left].filter((id) => right.has(id)).length;
  const union = left.size + right.size - intersection;
  return union ? intersection / union : 0;
};

function stableAngle(node) {
  let hash = 2166136261;
  for (const c of node.flavor?.id ?? node.id)
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return ((hash >>> 0) / 4294967296) * Math.PI * 2;
}

export function computeAnchorPositions(anchorNodes, width, height, links = []) {
  const selected = anchorNodes.filter((n) => n.type === "center");
  const related = anchorNodes
    .filter((n) => n.type === "flavor")
    .sort((a, b) => (a.flavor?.id ?? a.id).localeCompare(b.flavor?.id ?? b.id));
  const positions = computeSelectedPositions(selected, width, height);
  const geometry = anchorGeometry(width, height);
  const { cx, cy, rx, ry, scale } = geometry;
  const sets = displayedBeanSets(anchorNodes, links);
  const directions = related.map((node) => {
    let dx = 0,
      dy = 0;
    for (const anchor of selected) {
      const p = positions.get(anchor.id);
      const length = Math.hypot(p.x - cx, p.y - cy);
      const weight = jaccard(sets.get(node.id), sets.get(anchor.id));
      if (length > 1e-9) {
        dx += (weight * (p.x - cx)) / length;
        dy += (weight * (p.y - cy)) / length;
      }
    }
    // One central selection, zero scores and balanced weights have no unique
    // direction. A flavor-ID hash gives them a stable, data-independent angle.
    return Math.hypot(dx, dy) < 1e-9 ? stableAngle(node) : Math.atan2(dy, dx);
  });
  // Deterministic beam search on the outer ellipse: minimize angular deviation
  // jointly, subject to circle clearance. Anchors never enter the simulation
  // to resolve their mutual overlaps. 96 samples and 160 beams bound the work.
  let beams = [{ points: [], cost: 0 }];
  for (const direction of directions) {
    const candidates = Array.from({ length: 96 }, (_, i) => {
      const angle = direction + (i * Math.PI * 2) / 96;
      // Intersect a physical direction (not an ellipse parameter) with the ring.
      const radius = 1 / Math.hypot(Math.cos(angle) / rx, Math.sin(angle) / ry);
      return {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        cost:
          Math.acos(Math.max(-1, Math.min(1, Math.cos(angle - direction)))) **
          2,
      };
    }).filter((p) =>
      [...positions.values()].every(
        (q) => Math.hypot(p.x - q.x, p.y - q.y) >= 72 * scale,
      ),
    );
    const next = [];
    for (const beam of beams)
      for (const p of candidates) {
        if (
          beam.points.every(
            (q) => Math.hypot(p.x - q.x, p.y - q.y) >= 70 * scale,
          )
        ) {
          next.push({ points: [...beam.points, p], cost: beam.cost + p.cost });
        }
      }
    next.sort((a, b) => a.cost - b.cost);
    beams = next.slice(0, 160);
    if (!beams.length) throw new Error("Insufficient space for flavor anchors");
  }
  related.forEach((node, i) => {
    const { x, y } = beams[0].points[i];
    positions.set(node.id, { x, y });
  });
  return positions;
}

// Only selected anchors define a bean's combination. Related links are visual
// connections and must never move the centroid, even if there are many of them.
export function computeBeanTargetPosition(
  bean,
  positions,
  links,
  selectedPositions,
) {
  return computeBeanInitialPosition(bean, selectedPositions, links);
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

// Bound to the viewport, not the old central ellipse: that ellipse would pull
// beans away from the enlarged triangle's vertices and edge midpoints.
export function constrainBeanPosition(node, layout) {
  const geometry = anchorGeometry(layout.width, layout.height);
  const margin = 18 * geometry.scale;
  node.x = Math.max(margin, Math.min(layout.width - margin, node.x));
  node.y = Math.max(margin, Math.min(layout.height - margin, node.y));
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
