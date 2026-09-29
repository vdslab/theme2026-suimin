// 豆 → タグ エッジを R1〜R2 の円環内だけで引くための経路計算。
// B-スプラインを極座標 (角度, 半径) 上で評価するので、制御点の半径が R1〜R2 にある限り
// 曲線も円環からはみ出さない（デカルト座標で補間すると弦が中心側へ食い込む）。
import type { Polar, Radii, RelationEdge } from "./layout";

/**
 * hierarchy: 豆 → L1角度 → L2角度 → タグ角度 と外側から順に寄せ、タグに近いほど束になる
 * midRing:   豆 → [Rmid, 豆角度] → [Rmid, タグ角度] → タグ（同じタグへのエッジだけが束になる）
 */
export type RingRoute = "hierarchy" | "midRing";

const TAU = Math.PI * 2;

/** a を base からの最短回りの角度に揃える（周回の継ぎ目 0/2π をまたいでも遠回りしない） */
function unwrap(a: number, base: number): number {
  const d = (((a - base) % TAU) + TAU * 1.5) % TAU - Math.PI;
  return base + d;
}

function controlPoints(edge: RelationEdge, radii: Radii, route: RingRoute): Polar[] {
  const r1 = radii.tag;
  const r2 = radii.bean;
  const w = r2 - r1;
  const tag = edge.chain[edge.chain.length - 1];
  // 端点は点の縁から少し離す
  const start = { angle: edge.bean.angle, radius: r2 - 5 };
  const end = { angle: tag.angle, radius: r1 + 6 };
  const nearTag = { angle: tag.angle, radius: r1 + 0.15 * w };
  if (route === "midRing") {
    const mid = r1 + 0.5 * w;
    return [start, { angle: edge.bean.angle, radius: mid }, { angle: tag.angle, radius: mid }, nearTag, end];
  }
  // 階層を外側から順に円環内の半径へ割り当てる（L1 が豆寄り、末端タグが Wheel 寄り）
  const groups = edge.chain.slice(0, -1);
  const guides = groups.map((g, i) => ({
    angle: g.angle,
    radius: r1 + w * (0.75 - (0.5 * i) / Math.max(1, groups.length)),
  }));
  return [start, { angle: edge.bean.angle, radius: r2 - 0.12 * w }, ...guides, nearTag, end];
}

/** 一様 3 次 B-スプライン。端点を 3 重にして始点・終点を通す */
function sampleBSpline(pts: Polar[], stepAngle: number): Polar[] {
  const p = [pts[0], pts[0], ...pts, pts[pts.length - 1], pts[pts.length - 1]];
  const out: Polar[] = [];
  for (let i = 0; i + 3 < p.length; i++) {
    const [a, b, c, d] = [p[i], p[i + 1], p[i + 2], p[i + 3]];
    const span = Math.max(Math.abs(c.angle - b.angle), Math.abs(d.angle - a.angle) / 3);
    const n = Math.max(4, Math.ceil(span / stepAngle));
    for (let k = 0; k < n; k++) {
      const s = k / n;
      const b0 = (1 - s) ** 3 / 6;
      const b1 = (3 * s ** 3 - 6 * s ** 2 + 4) / 6;
      const b2 = (-3 * s ** 3 + 3 * s ** 2 + 3 * s + 1) / 6;
      const b3 = s ** 3 / 6;
      out.push({
        angle: b0 * a.angle + b1 * b.angle + b2 * c.angle + b3 * d.angle,
        radius: b0 * a.radius + b1 * b.radius + b2 * c.radius + b3 * d.radius,
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * beta: 束ね強度。0 なら豆からタグへ角度と半径を線形に補間した螺旋（束ねない）、
 * 1 なら制御点どおり。中間は極座標上で線形ブレンドする（curveBundle の β と同じ考え方）。
 */
export function routeEdge(edge: RelationEdge, radii: Radii, beta: number, route: RingRoute): Polar[] {
  const raw = controlPoints(edge, radii, route);
  const pts: Polar[] = [];
  for (const q of raw) {
    const prev = pts[pts.length - 1];
    pts.push(prev ? { angle: unwrap(q.angle, prev.angle), radius: q.radius } : q);
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  const blended = pts.map((q, i) => {
    const t = i / (pts.length - 1);
    const angle = first.angle + t * (last.angle - first.angle);
    const radius = first.radius + t * (last.radius - first.radius);
    return {
      angle: beta * q.angle + (1 - beta) * angle,
      radius: beta * q.radius + (1 - beta) * radius,
    };
  });
  return sampleBSpline(blended, 0.02);
}
