// クラスタの色・名前まわりの共通ヘルパー。
// precompute_data.py と同じカラーパレット（クラスタ index 順）。
export const HEX_PALETTE = [
  "#EF553B",
  "#00CC96",
  "#AB63FA",
  "#FFA15A",
  "#19D3F3",
  "#FF6692",
  "#B6E880",
];
export const NOISE_COLOR = "#9ca3af";

// "... (C3)" からクラスタ番号を取り出す
export function clusterIndex(name) {
  const m = name?.match(/\(C(\d+)\)/);
  return m ? parseInt(m[1], 10) : null;
}

// どのクラスタにも属さない豆の名前。precompute_data.py が付ける値と揃える。
export const NOISE_NAME = "独自の味わい";

export function isNoise(name) {
  return !name || name === NOISE_NAME || name.includes("ノイズ");
}

// クラスタの基準色（凡例・バッジ・枠線用）
export function clusterColor(name) {
  if (isNoise(name)) return NOISE_COLOR;
  const i = clusterIndex(name);
  return i === null ? NOISE_COLOR : HEX_PALETTE[i % HEX_PALETTE.length];
}

// 表示用に "(C3)" を取り除いた短い名前
export function shortName(name) {
  if (isNoise(name)) return NOISE_NAME;
  return (name || "").replace(/\s*\(C\d+\)\s*$/, "");
}

// 味覚6軸のラベル
export const TASTE_AXES = [
  { key: "aroma", label: "香り", en: "Aroma" },
  { key: "flavor", label: "風味", en: "Flavor" },
  { key: "aftertaste", label: "後味", en: "Aftertaste" },
  { key: "acidity", label: "酸味", en: "Acidity" },
  { key: "body", label: "コク", en: "Body" },
  { key: "balance", label: "バランス", en: "Balance" },
];

// 各クラスタの味覚偏差平均（豆内平均からの偏差のクラスタ平均）を算出
export function computeClusterTasteDeviations(coffeeData) {
  const result = {};
  const counts = {};

  coffeeData.forEach((node) => {
    const cName = node.clusterName;
    if (!cName || !node.scores) return;

    const scores = TASTE_AXES.map((a) => node.scores[a.en] ?? 0);
    const itemMean =
      scores.reduce((sum, v) => sum + v, 0) / (scores.length || 1);

    if (!result[cName]) {
      result[cName] = {
        Aroma: 0,
        Flavor: 0,
        Aftertaste: 0,
        Acidity: 0,
        Body: 0,
        Balance: 0,
      };
      counts[cName] = 0;
    }

    TASTE_AXES.forEach((a) => {
      const dev = (node.scores[a.en] ?? 0) - itemMean;
      result[cName][a.en] += dev;
    });
    counts[cName] += 1;
  });

  Object.keys(result).forEach((cName) => {
    const count = counts[cName] || 1;
    TASTE_AXES.forEach((a) => {
      result[cName][a.en] = result[cName][a.en] / count;
    });
  });

  return result;
}
