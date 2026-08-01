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
//   2. 北緯72度より上を切り落とす
//   3. 使っていない objects.land を削除し、トポロジーを組み直す
//
// 1と2の狙いは同じ。メルカトル図法では高緯度が極端に引き伸ばされるので、
// コーヒー産地の無い南極・北極圏を残すと、データが重いうえに
// 縦パンの可動域(WorldMap.jsx の worldBounds)が空白の海まで広がってしまう。

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as topojsonClient from "topojson-client";
import { topology } from "topojson-server";

const DROP_COUNTRIES = new Set(["Antarctica", "Fr. S. Antarctic Lands"]);
// 初期表示で画面上端に見えるのは約79°N。それより上だけを落とすので、
// 通常の見た目は変わらず、グリーンランド北部と北極諸島だけが消える。
const CLIP_NORTH_LAT = 72;
// 元データ(world-atlas)と同じ量子化。座標の丸め精度＝ファイルサイズに直結する。
const QUANTIZATION = 1e5;

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
const source = topojsonClient.feature(topo, topo.objects.countries);
const features = source.features.filter(
  (f) => !DROP_COUNTRIES.has(f.properties?.name),
);

// 2) 緯度CLIP_NORTH_LATの半平面(lat <= CLIP_NORTH_LAT)でリングを切る。
//    半平面は凸なので Sutherland–Hodgman がそのまま使える。
//    切り口はクリップ線に沿って閉じられ、線より上に出た頂点だけが落ちる。
const inside = (p) => p[1] <= CLIP_NORTH_LAT;
const intersect = (a, b) => {
  const t = (CLIP_NORTH_LAT - a[1]) / (b[1] - a[1]);
  return [a[0] + t * (b[0] - a[0]), CLIP_NORTH_LAT];
};

const clipRing = (ring) => {
  const out = [];
  // GeoJSONのリングは末尾が始点と同じなので、閉じる点を除いて回す
  const pts = ring.slice(0, -1);
  if (pts.length === 0) return null;
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const prev = pts[(i + pts.length - 1) % pts.length];
    const curIn = inside(cur);
    const prevIn = inside(prev);
    if (curIn) {
      if (!prevIn) out.push(intersect(prev, cur));
      out.push(cur);
    } else if (prevIn) {
      out.push(intersect(prev, cur));
    }
  }
  // 面積の無い残骸(3頂点未満)は捨てる
  if (out.length < 3) return null;
  out.push(out[0]);
  return out;
};

// 外周が消えたポリゴンは穴ごと捨てる
const clipPolygon = (rings) => {
  const shell = clipRing(rings[0]);
  if (!shell) return null;
  const holes = rings.slice(1).map(clipRing).filter(Boolean);
  return [shell, ...holes];
};

let clippedCount = 0;
const clipped = [];
for (const f of features) {
  const g = f.geometry;
  let coordinates = null;
  if (g.type === "Polygon") {
    coordinates = clipPolygon(g.coordinates);
  } else if (g.type === "MultiPolygon") {
    const polys = g.coordinates.map(clipPolygon).filter(Boolean);
    coordinates = polys.length ? polys : null;
  } else {
    throw new Error(`未対応のgeometry: ${g.type}`);
  }
  if (!coordinates) continue; // 全体がクリップ線より上だった国
  if (JSON.stringify(coordinates) !== JSON.stringify(g.coordinates)) {
    clippedCount++;
  }
  clipped.push({
    type: "Feature",
    properties: f.properties,
    geometry: { type: g.type, coordinates },
  });
}

// 3) クリップで境界が変わっているのでトポロジーを組み直す
//    (topology()が共有境界のarc化・量子化・bbox付与をまとめてやってくれる)
const out = topology(
  { countries: { type: "FeatureCollection", features: clipped } },
  QUANTIZATION,
);

writeFileSync(outPath, JSON.stringify(out));

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
console.log(
  `${outPath}\n` +
    `  国: ${source.features.length} -> ${clipped.length} (うち${clippedCount}カ国を${CLIP_NORTH_LAT}°Nで切断)\n` +
    `  arc: ${topo.arcs.length} -> ${out.arcs.length}\n` +
    `  サイズ: ${kb(readFileSync(srcPath).length)} -> ${kb(readFileSync(outPath).length)}`,
);
