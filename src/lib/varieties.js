// 表示・検索には出さない（クラスタリングには元々使っていない）。
const UNKNOWN_VARIETIES = new Set(["Other", "Unknown"]);

export const cleanVarieties = (varieties) =>
  (varieties || []).filter((v) => !UNKNOWN_VARIETIES.has(v));
