import rawData from "../data/coffee_data.json";
import { cleanVarieties } from "./varieties";

// coffee_data.json は「産地 × 精製方法」で集約したノード。表示用に整形する。
export const coffeeData = rawData.map((item) => ({
  id: item.id,
  // DetailPanel / 選択判定が name を参照する。グループキー(産地×精製方法)で一意。
  name: `${item.region}・${item.country}・${item.method}`,
  country: item.country,
  region: item.region,
  method: item.method,
  varieties: cleanVarieties(item.varieties),
  sampleCount: item.sample_count,
  x: item.x,
  y: item.y,
  lat: item.lat,
  lng: item.lng,
  admin1_code: item.admin1_code,
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
