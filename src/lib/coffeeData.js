import rawData from "../data/coffee_data.json";

// coffee_data.json は「産地 × 精製方法」で集約したノード。表示用に整形する。
export const coffeeData = rawData.map((item) => ({
  id: item.id,
  // DetailPanel / 選択判定が name を参照する。グループキー(産地×精製方法)で一意。
  name: `${item.country}・${item.method}`,
  country: item.country,
  method: item.method,
  varieties: item.varieties || [],
  sampleCount: item.sample_count,
  x: item.x,
  y: item.y,
  blendedColor: item.color, // membershipブレンド色（ドットの塗り）
  clusterName: item.dominant_cluster,
  probs: item.probs || {},
  scores: item.scores_mean, // { Aroma, Flavor, ... }
  deviation: item.deviation_mean, // { Aroma_dev, ... }
}));
