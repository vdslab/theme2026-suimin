// 表示・検索には出さない
const UNKNOWN_VARIETIES = new Set(["Other", "Unknown"]);

// 品種が不明・その他なら null（表示・検索から外す）
export const cleanVariety = (variety) =>
  variety && !UNKNOWN_VARIETIES.has(variety) ? variety : null;
