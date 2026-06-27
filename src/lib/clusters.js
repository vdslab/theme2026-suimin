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

export function isNoise(name) {
  return !name || name.includes("ノイズ");
}

// クラスタの基準色（凡例・バッジ・枠線用）
export function clusterColor(name) {
  if (isNoise(name)) return NOISE_COLOR;
  const i = clusterIndex(name);
  return i === null ? NOISE_COLOR : HEX_PALETTE[i % HEX_PALETTE.length];
}

// 表示用に "(C3)" を取り除いた短い名前
export function shortName(name) {
  if (isNoise(name)) return "ノイズ (独自路線)";
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
