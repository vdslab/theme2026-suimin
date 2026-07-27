import rawData from "../data/coffee_data.json";
import { cleanVariety } from "./varieties";

// coffee_data.json は「コーヒー豆1件 = 1ノード」。地域での集約はしていない。
export const coffeeData = rawData.map((item) => ({
  id: item.id,
  // DetailPanel / 検索が参照する表示名。同じ地域に複数の豆があるためidまで含めて一意にする。
  name: `${item.country}・${item.admin1}・${item.variety} #${item.id}`,
  country: item.country,
  admin1: item.admin1,
  // 地図に点を打つための座標（GeoJSON順: [lng, lat]）。
  // 同一地域の豆は重ならないよう precompute 側で決定的にずらしてある。
  lng: item.lng,
  lat: item.lat,
  coordSource: item.coord_source,
  variety: cleanVariety(item.variety),
  processingMethod: item.processing_method,
  altitude: item.altitude_m,
  totalCupPoints: item.total_cup_points,
  x: item.x,
  y: item.y,
  blendedColor: item.color, // membershipブレンド色
  clusterName: item.dominant_cluster,
  probs: item.probs || {},
  scores: item.scores, // { Aroma, Flavor, ... }
  deviation: item.deviation, // { Aroma_dev, ... }
  // 味覚特徴量(標準化済み偏差6軸)空間での近傍。precompute のk-NN結果（近い順）。
  neighborIds: item.neighbors || [],
}));

const nodeById = new Map(coffeeData.map((node) => [node.id, node]));

// 味覚特徴量が近い豆を近い順に返す（自分自身は含まれない）。
// 距離計算は precompute の k-NN 結果をそのまま使うため、エッジと同じ基準になる。
export function nearestByTaste(target, limit = 5) {
  if (!target) return [];
  return (target.neighborIds || [])
    .slice(0, limit)
    .map((id) => nodeById.get(id))
    .filter(Boolean);
}

// 地図の背景に敷く「味の近さ」ネットワーク用のエッジ数。
const EDGE_K = 3;

// 各豆から味が近い上位EDGE_K件へのエッジを、無向ペアとして1度だけ作る。
// A→B と B→A は同一の線分とみなして重複を除く。
export const tasteSimilarityPairs = (() => {
  const seen = new Set();
  const pairs = [];
  for (const node of coffeeData) {
    for (const neighbor of nearestByTaste(node, EDGE_K)) {
      const [lo, hi] =
        node.id < neighbor.id
          ? [node.id, neighbor.id]
          : [neighbor.id, node.id];
      const key = `${lo}|${hi}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ id: key, a: node, b: neighbor });
    }
  }
  return pairs;
})();
