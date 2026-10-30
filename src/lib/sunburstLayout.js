import { hierarchy } from "d3-hierarchy";

// Collapse only redundant third-level leaves in the display hierarchy.
// The source nodes and IDs stay intact for bean counts and network selection.
export function sunburstHierarchy(dataRoot) {
  const children = (node) => {
    const onlyChild = node.children[0];
    return node.path.length === 2 &&
      node.children.length === 1 &&
      onlyChild.name === node.name &&
      !onlyChild.children.length
      ? []
      : node.children;
  };
  return hierarchy(dataRoot, children)
    .sum((node) => (children(node).length ? 0 : 1))
    .sort((a, b) => b.value - a.value);
}

export function sunburstNodeForId(root, id) {
  return root
    .descendants()
    .find(
      (node) =>
        node.data.id === id ||
        (!node.children && node.data.children.some((child) => child.id === id)),
    );
}

// Geometry uses viewport pixels, independently of flavor weights and counts.
export function sunburstRadius(width, height) {
  return Math.max(0, Math.min(width, height) / 2 - 12);
}

export function sunburstLabel(node, text) {
  const radius = (node.y0 + node.y1) / 2;
  const padding = Math.min(
    3,
    (node.y1 - node.y0) * 0.05,
    (node.x1 - node.x0) * radius * 0.06,
  );
  const halfAngle = Math.max(0, (node.x1 - node.x0) / 2 - 0.004);
  const angle = (((node.x0 + node.x1) / 2) * 180) / Math.PI;
  const lines = Array.isArray(text) ? text : [text];
  const characters = Math.max(...lines.map((line) => Array.from(line).length));
  let result = { visible: false, fontSize: 12, lines, transform: "" };
  if (!characters || halfAngle <= 0 || node.y1 - node.y0 <= 2) return result;
  const fit = (fontSize) => {
    const halfWidth = (characters * fontSize) / 2;
    const halfHeight = fontSize * (lines.length === 1 ? 0.75 : 1.2);
    for (const tangent of [false, true]) {
      const radial = tangent ? halfHeight : halfWidth;
      const angular = tangent ? halfWidth : halfHeight;
      // Always anchor at the sector's angular and radial midpoint.
      // Fit by changing orientation/font size rather than shifting the label.
      const near = radius - radial;
      const far = radius + radial;
      const rotation = tangent
        ? 90 + (angle > 90 && angle < 270 ? 180 : 0)
        : angle < 180
          ? 0
          : 180;
      const layout = {
        visible:
          near >= node.y0 + 1 + padding &&
          Math.hypot(far, angular) <= node.y1 - 1 - padding &&
          Math.atan2(angular + padding, near) <= halfAngle,
        fontSize,
        lines,
        transform:
          "rotate(" +
          (angle - 90) +
          ") translate(" +
          radius +
          ",0) rotate(" +
          rotation +
          ")",
      };
      if (layout.visible) return layout;
      result = layout;
    }
    return result;
  };
  for (const fontSize of [12, 11, 10]) {
    const layout = fit(fontSize);
    if (layout.visible) return layout;
  }
  // Every terminal tag remains labelled. Adapt only font size and orientation;
  // never move editorial line breaks according to the available space.
  if (!node.children?.length) {
    let lower = 0;
    let upper = 10;
    let best = result;
    for (let i = 0; i < 24; i++) {
      const fontSize = (lower + upper) / 2;
      const layout = fit(fontSize);
      if (layout.visible) {
        best = layout;
        lower = fontSize;
      } else upper = fontSize;
    }
    return best;
  }
  return result;
}
