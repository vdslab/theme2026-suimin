export function networkLayout(width, height) {
  const unit = Math.max(
    0.55,
    Math.min(1.6, Math.min(width / 700, height / 540)),
  );
  return { width, height, cx: width / 2, cy: height / 2, unit };
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
