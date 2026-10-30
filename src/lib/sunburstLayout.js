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
  const padding = 3;
  const radius = (node.y0 + node.y1) / 2;
  const halfAngle = Math.max(0, (node.x1 - node.x0) / 2 - 0.004);
  const angle = (((node.x0 + node.x1) / 2) * 180) / Math.PI;
  const chars = Array.from(text);
  const result = { visible: false, fontSize: 12, lines: [text], transform: "" };
  // Prefer radial text; long labels may use the tangent or wrap to two lines.
  for (const fontSize of [12, 11, 10]) {
    for (const lineCount of [1, 2]) {
      const perLine = Math.ceil(chars.length / lineCount);
      if (!perLine) return result;
      const lines = [];
      for (let i = 0; i < chars.length; i += perLine)
        lines.push(chars.slice(i, i + perLine).join(""));
      const halfWidth = (perLine * fontSize) / 2;
      const halfHeight = fontSize * (lines.length === 1 ? 0.75 : 1.2);
      for (const tangent of [false, true]) {
        const radial = tangent ? halfHeight : halfWidth;
        const angular = tangent ? halfWidth : halfHeight;
        const minimumRadius = Math.max(
          node.y0 + 1 + padding + radial,
          halfAngle < Math.PI / 2
            ? radial + (angular + padding) / Math.tan(halfAngle)
            : 0,
        );
        const maximumRadius =
          Math.sqrt(Math.max(0, (node.y1 - 1 - padding) ** 2 - angular ** 2)) -
          radial;
        const labelRadius =
          radius < minimumRadius || radius > maximumRadius
            ? (minimumRadius + maximumRadius) / 2
            : radius;
        const near = labelRadius - radial;
        const far = labelRadius + radial;
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
            labelRadius +
            ",0) rotate(" +
            rotation +
            ")",
        };
        if (layout.visible) return layout;
        Object.assign(result, layout);
      }
    }
  }
  return result;
}
