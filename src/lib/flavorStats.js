// Aggregates for "how many bags out of 10": for a selected flavor, the share of
// beans that list it, per origin and per roast level, with Wilson intervals.
import characterRows from "../data/flavorCharacter.json" with { type: "json" };
import { pathId } from "./flavorData.js";

export const ROAST_LEVELS = ["light", "medium", "dark"];
export const ROAST_JA = { light: "浅煎り", medium: "中煎り", dark: "深煎り" };
// Countries with fewer tagged beans than this are left out of the charts.
export const MIN_ORIGIN_BEANS = 50;
// Below this many beans, or with an interval wider than this many bags, a
// value is shown faded.
export const SMALL_SAMPLE = 30;
export const WIDE_INTERVAL_BAGS = 3;

// Light and Light-Medium are light; Medium-Dark and Dark are dark (too few
// beans for their own levels).
export function normalizeRoast(value) {
  const s = value?.toLowerCase() ?? "";
  if (s.includes("light")) return "light";
  if (s.includes("dark")) return "dark";
  if (s.includes("medium")) return "medium";
  return null;
}

export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

export const isUncertain = (cell) =>
  cell.t < SMALL_SAMPLE || (cell.hi - cell.lo) * 10 > WIDE_INTERVAL_BAGS;

function makeCell(k, t, base) {
  const [lo, hi] = wilson(k, t);
  const cell = { k, t, p: t ? k / t : 0, lo, hi, base };
  cell.uncertain = isUncertain(cell);
  // Clearly above or below the overall rate.
  cell.signal = lo > base ? "hi" : hi < base ? "lo" : "none";
  return cell;
}

// Per-bean attributes used by every aggregate; computed once per dataset.
export function beanAttributes(beans) {
  const counts = new Map();
  for (const b of beans) {
    const o = b.origin_country?.trim();
    if (o) counts.set(o, (counts.get(o) || 0) + 1);
  }
  const origins = [...counts]
    .filter(([, n]) => n >= MIN_ORIGIN_BEANS)
    .sort((a, b) => b[1] - a[1])
    .map(([o]) => o);
  const originSet = new Set(origins);
  const attrs = new Map(
    beans.map((b) => {
      const o = b.origin_country?.trim();
      return [
        b.id,
        {
          origin: originSet.has(o) ? o : null,
          roast: normalizeRoast(b.roast_level),
        },
      ];
    }),
  );
  return { origins, attrs };
}

// Share of beans listing `node` per level of `dim` ("origin" | "roast").
export function shareBy(data, attributes, node, dim) {
  const levels = dim === "origin" ? attributes.origins : ROAST_LEVELS;
  const t = new Map(levels.map((l) => [l, 0]));
  const k = new Map(levels.map((l) => [l, 0]));
  for (const bean of data.beans) {
    const level = attributes.attrs.get(bean.id)[dim];
    if (!t.has(level)) continue;
    t.set(level, t.get(level) + 1);
    if (node.beanIds.has(bean.id)) k.set(level, k.get(level) + 1);
  }
  const K = [...k.values()].reduce((a, b) => a + b, 0);
  const T = [...t.values()].reduce((a, b) => a + b, 0);
  const base = T ? K / T : 0;
  return {
    base,
    total: T,
    rows: levels.map((level) => ({
      level,
      ...makeCell(k.get(level), t.get(level), base),
    })),
  };
}

// Origin × roast shares, restricted to beans whose roast is known.
export function shareByOriginRoast(data, attributes, node) {
  const key = (o, r) => `${o}\u0000${r}`;
  const t = new Map();
  const k = new Map();
  let K = 0;
  let T = 0;
  for (const bean of data.beans) {
    const { origin, roast } = attributes.attrs.get(bean.id);
    if (!origin || !roast) continue;
    const id = key(origin, roast);
    const has = node.beanIds.has(bean.id);
    t.set(id, (t.get(id) || 0) + 1);
    if (has) k.set(id, (k.get(id) || 0) + 1);
    T += 1;
    if (has) K += 1;
  }
  const base = T ? K / T : 0;
  return {
    base,
    rows: attributes.origins.map((origin) => ({
      level: origin,
      cells: ROAST_LEVELS.map((roast) => ({
        roast,
        ...makeCell(
          k.get(key(origin, roast)) || 0,
          t.get(key(origin, roast)) || 0,
          base,
        ),
      })),
    })),
  };
}

// How much roast and origin each explain a flavor (posts 9160 / roast_origin.csv).
const characters = new Map(characterRows.map((r) => [pathId(r.path), r]));
export const flavorCharacter = (id) => characters.get(id) ?? null;
export const characterList = () => characterRows;
export const KIND_JA = {
  origin: "産地で決まる味",
  roast: "焙煎で決まる味",
  both: "焙煎と産地の両方が効く味",
  weak: "どの豆でも出会える味",
};

const bags = (p) => (Math.round(p * 100) / 10).toFixed(1);
export const formatBags = bags;

// The most likely level that is clearly above the overall rate and not faded.
export function bestLevel(share) {
  return (
    share.rows
      .filter((r) => r.signal === "hi" && !r.uncertain)
      .sort((a, b) => b.p - a.p)[0] ?? null
  );
}

// One-line advice shown above the detail, e.g. "…なら、まず深煎り（10袋中7.2袋）".
export function adviceFor(kind, name, origin, roast, label) {
  const o = bestLevel(origin);
  const r = bestLevel(roast);
  const part = (row) => `${label(row.level)}（10袋中${bags(row.p)}袋）`;
  const want = `${name}の味が書かれた豆が欲しいなら`;
  if (kind === "weak")
    return {
      text: `${name}は、どの産地・焙煎度の豆でも同じくらい出会える味です。`,
      pick: null,
    };
  const order = kind === "roast" ? [r, o] : kind === "origin" ? [o, r] : [r, o];
  const [first, second] = order;
  if (!first && !second)
    return {
      text: `${name}は、産地や焙煎度ではっきりした差が見えない味です。`,
      pick: null,
    };
  if (kind === "both" && first && second)
    return {
      text: `${want}、${part(first)}か、${part(second)}から。`,
      pick: first,
    };
  const pick = first ?? second;
  return { text: `${want}、まず${part(pick)}。`, pick };
}
