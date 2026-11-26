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

// Row and column orders for both views. "wheel" keeps the SCA order of the
// rows and origins by bean count; "similar" reorders both and cuts each tree
// into a few groups, which are separated by gaps and named in the margin.
export function matrixOrders(matrix, { rowGroups = 4, columnGroups = 4 } = {}) {
  const rowVectors = matrix.cells.map((row) => row.map((c) => c.smooth));
  const colVectors = matrix.origins.map((_, j) =>
    matrix.cells.map((row) => row[j].smooth),
  );
  const rows = reorder(rowVectors);
  const cols = reorder(colVectors);
  const one = (n) => new Map(Array.from({ length: n }, (_, i) => [i, 0]));
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
      rowGroups: rows.tree
        ? cutTree(rows.tree, rowGroups)
        : one(matrix.rows.length),
      colGroups: cols.tree
        ? cutTree(cols.tree, columnGroups)
        : one(matrix.origins.length),
    },
  };
}

// Only fairly certain cells count when naming groups and picking highlights.
const sure = (c) => (c.level <= 1 ? c.v : 0);
const groupsInOrder = (order, groups) => {
  const seen = new Map();
  for (const i of order) {
    const g = groups.get(i);
    if (!seen.has(g)) seen.set(g, []);
    seen.get(g).push(i);
  }
  return [...seen].map(([id, members]) => ({ id, members }));
};
// Labels for the reordered table: for each row group, the origins where its
// flavors are listed most often; for each column group, the flavor listed
// most often there. Names come from the data, so they follow any update.
export function matrixGroupNotes(matrix, similar, { name, origin } = {}) {
  const rowName = name ?? ((node) => node.name);
  const originName = origin ?? ((o) => o);
  const rows = groupsInOrder(similar.rows, similar.rowGroups).map((g) => {
    const score = matrix.origins.map((_, j) => ({
      j,
      v:
        g.members.reduce((s, i) => s + sure(matrix.cells[i][j]), 0) /
        g.members.length,
    }));
    const top = score
      .filter((s) => s.v > 0.4)
      .sort((a, b) => b.v - a.v)
      .slice(0, 2);
    return {
      ...g,
      lines: top.length
        ? [
            top.map((s) => originName(matrix.origins[s.j])).join("・"),
            "で出やすい",
          ]
        : ["産地の差は小さい"],
    };
  });
  const cols = groupsInOrder(similar.cols, similar.colGroups).map((g) => {
    const score = matrix.rows.map((node, i) => ({
      node,
      v:
        g.members.reduce((s, j) => s + sure(matrix.cells[i][j]), 0) /
        g.members.length,
    }));
    const top = score.filter((s) => s.v > 0.4).sort((a, b) => b.v - a.v)[0];
    return { ...g, lines: [top ? `${rowName(top.node)}が多い` : ""] };
  });
  return { rows, cols };
}

// The strongest, fairly certain cells, one per origin, for the sentences
// shown above the table.
export function matrixHighlights(matrix, n = 3) {
  const cells = [];
  matrix.cells.forEach((row, i) => {
    row.forEach((c, j) => {
      if (c.level === 0 && c.v > 0.5) cells.push({ i, j, ...c });
    });
  });
  cells.sort((a, b) => b.v - a.v || b.p - a.p);
  const out = [];
  const usedOrigins = new Set();
  const usedRows = new Set();
  for (const c of cells) {
    if (usedOrigins.has(c.j) || usedRows.has(c.i)) continue;
    usedOrigins.add(c.j);
    usedRows.add(c.i);
    out.push(c);
    if (out.length === n) break;
  }
  return out;
}
