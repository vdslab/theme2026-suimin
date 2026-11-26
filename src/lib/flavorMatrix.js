// Data and colors for the whole map: flavors × origins, colored by how many
// times more often than the average a flavor is listed for an origin.

import { wilson } from "./flavorStats.js";
import { cutTree, reorder } from "./reorder.js";

export const MATRIX_COLORS = {
  hi: "#A8452A",
  lo: "#3F7A80",
  neutral: "#E1D3BF",
  surface: "#FFFBF3",
};

const hexToRgb = (hex) =>
  hex
    .slice(1)
    .match(/.{2}/g)
    .map((h) => parseInt(h, 16));
// `t` of `a` mixed into `b`.
export function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return `#${A.map((v, i) =>
    Math.round(v * t + B[i] * (1 - t))
      .toString(16)
      .padStart(2, "0"),
  ).join("")}`;
}

// v is log2 of the ratio to the average, clamped to [-2, 2].
export function plainColor(v, strength = Math.abs(v) / 2) {
  const c = MATRIX_COLORS;
  if (Math.abs(v) < 0.15 && strength === Math.abs(v) / 2) return c.surface;
  return mix(v > 0 ? c.hi : c.lo, c.surface, 0.1 + strength * 0.8);
}

// Value-Suppressing Uncertainty Palette (Correll, Moritz & Heer, CHI 2018):
// the less certain a cell, the fewer value bins and the closer to neutral.
export const VSUP_BINS = [8, 4, 2, 1];
export const UNCERTAINTY_JA = ["確か", "やや確か", "不確か", "とても不確か"];
const FADE = [0, 0.25, 0.55];
export function vsupColor(v, level) {
  if (level >= 3) return MATRIX_COLORS.neutral;
  const nb = VSUP_BINS[level];
  const w = 4 / nb;
  const bin = Math.min(nb - 1, Math.max(0, Math.floor((v + 2) / w)));
  const center = -2 + (bin + 0.5) * w;
  const base = plainColor(center, Math.abs(center) / 2);
  return FADE[level] ? mix(MATRIX_COLORS.neutral, base, FADE[level]) : base;
}

// Interval width in doublings (log2 of hi/lo). The cut points put roughly a
// quarter of the cells in each level with the 2026.10 data; they are a design
// choice, not a statistical threshold.
export const UNCERTAINTY_CUTS = [1.3, 2.3, 4];
export function uncertaintyLevel(loRatio, hiRatio) {
  const u = Math.log2(hiRatio) - Math.log2(Math.max(loRatio, 1 / 32));
  return UNCERTAINTY_CUTS.findIndex((c) => u < c) === -1
    ? 3
    : UNCERTAINTY_CUTS.findIndex((c) => u < c);
}

// rows: flavor nodes; origins: column labels; attributes from beanAttributes.
export function buildMatrix(data, attributes, rowNodes) {
  const { origins, attrs } = attributes;
  const totals = new Map(origins.map((o) => [o, 0]));
  for (const bean of data.beans) {
    const o = attrs.get(bean.id).origin;
    if (o) totals.set(o, totals.get(o) + 1);
  }
  const N = [...totals.values()].reduce((a, b) => a + b, 0);
  const cells = rowNodes.map((node) => {
    const k = new Map(origins.map((o) => [o, 0]));
    for (const id of node.beanIds) {
      const o = attrs.get(id)?.origin;
      if (o) k.set(o, k.get(o) + 1);
    }
    const K = [...k.values()].reduce((a, b) => a + b, 0);
    const base = K / N;
    return origins.map((o) => {
      const t = totals.get(o);
      const kk = k.get(o);
      const [lo, hi] = wilson(kk, t);
      const ratio = base ? kk / t / base : 0;
      const loR = base ? lo / base : 0;
      const hiR = base ? hi / base : 0;
      return {
        k: kk,
        t,
        p: kk / t,
        lo,
        hi,
        base,
        ratio,
        v: kk === 0 ? -2 : Math.max(-2, Math.min(2, Math.log2(ratio))),
        level: uncertaintyLevel(loR, hiR),
        // Smoothed log ratio used for clustering: zero counts stay finite.
        smooth: Math.log2((kk + 1) / (base * t + 1)),
      };
    });
  });
  return { rows: rowNodes, origins, cells };
}

// Row and column orders for both views. "wheel" keeps the SCA order of
// rowNodes and origins by bean count; "similar" reorders both.
export function matrixOrders(matrix, columnGroups = 4) {
  const rowVectors = matrix.cells.map((row) => row.map((c) => c.smooth));
  const colVectors = matrix.origins.map((_, j) =>
    matrix.cells.map((row) => row[j].smooth),
  );
  const rows = reorder(rowVectors);
  const cols = reorder(colVectors);
  return {
    wheel: {
      rows: matrix.rows.map((_, i) => i),
      cols: matrix.origins.map((_, j) => j),
    },
    similar: {
      rows: rows.order,
      cols: cols.order,
      rowTree: rows.tree,
      colTree: cols.tree,
      colGroups: cols.tree ? cutTree(cols.tree, columnGroups) : null,
    },
  };
}
