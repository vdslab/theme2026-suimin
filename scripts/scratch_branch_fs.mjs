import { buildFlavorIndex } from "../src/lib/flavorData.js";
import fs from "fs";
import { sunburstHierarchy, sunburstRadius } from "../src/lib/sunburstLayout.js";
import { sunburstLabelLines } from "../src/lib/sunburstLabels.js";
import { partition } from "d3-hierarchy";

const json = JSON.parse(fs.readFileSync("./src/data/flavor_beans.json", "utf8"));
const data = buildFlavorIndex(json);

for (const [w, h] of [[800, 600], [500, 450], [400, 400], [350, 350], [300, 300], [250, 250], [200, 200]]) {
  const radius = sunburstRadius(w, h);
  const root = sunburstHierarchy(data.root);
  partition().size([2 * Math.PI, radius])(root);
  const nodes = root.descendants().filter((n) => n.depth && n.value && n.children?.length);

  console.log(`\n=== w=${w}, h=${h}, radius=${radius.toFixed(1)} ===`);
  for (const n of nodes) {
    const text = sunburstLabelLines(n.data.name);
    const r = (n.y0 + n.y1) / 2;
    const padding = Math.min(
      3,
      (n.y1 - n.y0) * 0.05,
      (n.x1 - n.x0) * r * 0.06,
    );
    const halfAngle = Math.max(0, (n.x1 - n.x0) / 2 - 0.004);
    const angle = (((n.x0 + n.x1) / 2) * 180) / Math.PI;
    const lines = Array.isArray(text) ? text : [text];
    const characters = Math.max(...lines.map((line) => Array.from(line).length));

    let maxFs = null;
    let maxTangent = null;
    for (let fs = 12; fs >= 1; fs -= 0.1) {
      const halfWidth = (characters * fs) / 2;
      const halfHeight = fs * (lines.length === 1 ? 0.75 : 1.2);
      for (const tangent of [false, true]) {
        const radial = tangent ? halfHeight : halfWidth;
        const angular = tangent ? halfWidth : halfHeight;
        const near = r - radial;
        const far = r + radial;
        const visible =
          near >= n.y0 + 1 + padding &&
          Math.hypot(far, angular) <= n.y1 - 1 - padding &&
          Math.atan2(angular + padding, near) <= halfAngle;
        if (visible) {
          maxFs = fs;
          maxTangent = tangent;
          break;
        }
      }
      if (maxFs !== null) break;
    }
    if (maxFs < 10) {
      console.log(`  Branch '${n.data.name}' (depth ${n.depth}): maxFs=${maxFs?.toFixed(1)}, tangent=${maxTangent}`);
    }
  }
}

