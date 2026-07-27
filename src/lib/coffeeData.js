import rawData from "../data/coffee_data.json";
import { cleanVarieties } from "./varieties";

// coffee_data.json は「産地(国) × admin1地域」で集約したノード。表示用に整形する。
export const coffeeData = rawData.map((item) => ({
  id: item.id,
  // DetailPanel / 選択判定が name を参照する。グループキー(国×admin1)で一意。
  name: `${item.country}・${item.admin1}`,
  country: item.country,
  admin1: item.admin1,
  // 地図に点を打つための代表座標（GeoJSON順: [lng, lat]）
  lng: item.lng,
  lat: item.lat,
  coordSource: item.coord_source,
  varieties: cleanVarieties(item.varieties),
  sampleCount: item.sample_count,
  x: item.x,
  y: item.y,
  blendedColor: item.color, // membershipブレンド色（ドットの塗り）
  clusterName: item.dominant_cluster,
  probs: item.probs || {},
  scores: item.scores_mean, // { Aroma, Flavor, ... }
  deviation: item.deviation_mean, // { Aroma_dev, ... }
}));

// UMAP座標(x, y)上でtargetに近い豆を距離順に返す（自分自身は除外）。
export function nearestByTaste(target, limit = 5) {
  if (!target) return [];
  return coffeeData
    .filter((d) => d.id !== target.id)
    .map((d) => ({
      node: d,
      dist: Math.hypot(d.x - target.x, d.y - target.y),
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit)
    .map(({ node }) => node);
}

// 全ノードについて「味が近い上位3件」への弧を、無向ペアとして1度だけ算出する。
// A→B と B→A は同一の線分として重複を除く。地図の背景に類似ネットワークを敷くために使う。
export const tasteSimilarityPairs = (() => {
  const seen = new Set();
  const pairs = [];
  for (const node of coffeeData) {
    for (const neighbor of nearestByTaste(node, 3)) {
      const key =
        node.id < neighbor.id
          ? `${node.id}|${neighbor.id}`
          : `${neighbor.id}|${node.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ id: key, a: node, b: neighbor });
    }
  }
  return pairs;
})();
