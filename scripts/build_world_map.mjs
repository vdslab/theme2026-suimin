// src/data/world-50m.json を生成するスクリプト。
//
// 元データ: world-atlas (Natural Earth 50m) の countries-50m.json
//   npm pack world-atlas / https://unpkg.com/world-atlas@2/countries-50m.json
//
// 使い方:
//   node scripts/build_world_map.mjs <countries-50m.jsonのパス>
//
// やっていること:
//   1. 南極(Antarctica, Fr. S. Antarctic Lands)を削除
//      コーヒー産地が無いうえ、メルカトル図法では巨大に引き伸ばされて
//      縦パンの可動域(worldBounds)を無駄に広げるため。
//   2. 使っていない objects.land を削除
//   3. どのgeometryからも参照されなくなったarcを削除して番号を振り直す
//   4. bboxを残った範囲で計算し直す

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DROP_COUNTRIES = new Set(["Antarctica", "Fr. S. Antarctic Lands"]);

const srcPath = process.argv[2];
if (!srcPath) {
  console.error("usage: node scripts/build_world_map.mjs <countries-50m.json>");
  process.exit(1);
}

const outPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "data",
  "world-50m.json",
);

const topo = JSON.parse(readFileSync(srcPath, "utf8"));

// 1) 南極を除いた国だけを残す（land はこのアプリでは描画に使っていない）
const geometries = topo.objects.countries.geometries.filter(
  (g) => !DROP_COUNTRIES.has(g.properties?.name),
);

// 2) 残ったgeometryが参照しているarcを集める
//    TopoJSONのarc番号は反転参照が負値(~i)で入るため、実インデックスに直して数える
const usedArcs = new Set();
const collect = (arcs) => {
  if (typeof arcs[0] === "number") {
    for (const i of arcs) usedArcs.add(i < 0 ? ~i : i);
  } else {
    for (const child of arcs) collect(child);
  }
};
for (const g of geometries) if (g.arcs) collect(g.arcs);

// 3) 旧番号→新番号の対応表を作り、arc配列を詰め直す
//    (TopoJSONのarcは1本ごとに絶対座標+デルタで完結しているので、抜いても他に影響しない)
const oldToNew = new Map();
const arcs = [];
for (let i = 0; i < topo.arcs.length; i++) {
  if (!usedArcs.has(i)) continue;
  oldToNew.set(i, arcs.length);
  arcs.push(topo.arcs[i]);
}
const renumber = (a) =>
  typeof a[0] === "number"
    ? a.map((i) => (i < 0 ? ~oldToNew.get(~i) : oldToNew.get(i)))
    : a.map(renumber);
for (const g of geometries) if (g.arcs) g.arcs = renumber(g.arcs);

// 4) 残ったarcからbboxを計算し直す（量子化座標をtransformで実座標に戻す）
const [sx, sy] = topo.transform.scale;
const [dx, dy] = topo.transform.translate;
const bbox = [Infinity, Infinity, -Infinity, -Infinity];
for (const arc of arcs) {
  let qx = 0;
  let qy = 0;
  for (const [ddx, ddy] of arc) {
    qx += ddx;
    qy += ddy;
    const lng = qx * sx + dx;
    const lat = qy * sy + dy;
    if (lng < bbox[0]) bbox[0] = lng;
    if (lat < bbox[1]) bbox[1] = lat;
    if (lng > bbox[2]) bbox[2] = lng;
    if (lat > bbox[3]) bbox[3] = lat;
  }
}

const out = {
  type: "Topology",
  bbox,
  transform: topo.transform,
  objects: { countries: { type: "GeometryCollection", geometries } },
  arcs,
};

writeFileSync(outPath, JSON.stringify(out));

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
console.log(
  `${outPath}\n` +
    `  国: ${topo.objects.countries.geometries.length} -> ${geometries.length}\n` +
    `  arc: ${topo.arcs.length} -> ${arcs.length}\n` +
    `  サイズ: ${kb(readFileSync(srcPath).length)} -> ${kb(readFileSync(outPath).length)}`,
);
