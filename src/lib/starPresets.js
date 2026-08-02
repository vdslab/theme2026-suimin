// Star Coordinates の初心者向けプリセット。
// 現行データに独立した苦味・甘み軸がないため、苦味はコク、甘みは風味を
// 比較用の代理軸として使う。将来データ軸を追加した場合は axisKey を差し替える。
export const STAR_PRESET_CONFIG = {
  acidityHigh: {
    label: "酸味強め",
    axisKey: "acidity",
    axisLabel: "酸味",
    direction: "high",
  },
  acidityLow: {
    label: "酸味控えめ",
    axisKey: "acidity",
    axisLabel: "酸味",
    direction: "low",
  },
  bitternessHigh: {
    label: "苦味強め",
    axisKey: "body",
    axisLabel: "苦味（コク軸）",
    direction: "high",
  },
  bitternessLow: {
    label: "苦味控えめ",
    axisKey: "body",
    axisLabel: "苦味（コク軸）",
    direction: "low",
  },
  aromaHigh: {
    label: "香り高め",
    axisKey: "aroma",
    axisLabel: "香り",
    direction: "high",
  },
  sweetnessHigh: {
    label: "甘み強め",
    axisKey: "flavor",
    axisLabel: "甘み（風味軸）",
    direction: "high",
  },
};

export const STAR_PRESET_LAYOUT = {
  targetAngle: 0,
  targetLengthRatio: 1.5,
  otherLengthRatio: 0.75,
  animationMs: 600,
  highlightedRatio: 0.3,
};

export function createDefaultAxes(tasteAxes, baseLength) {
  return tasteAxes.map((axis, index) => ({
    ...axis,
    angle: -Math.PI / 2 + (index * 2 * Math.PI) / tasteAxes.length,
    length: baseLength,
    enabled: true,
  }));
}

// 対象軸を右に置き、残りの軸を右方向以外へ等間隔に配置する。
export function createPresetAxes(currentAxes, preset, baseLength) {
  const others = currentAxes.filter((axis) => axis.key !== preset.axisKey);
  const otherAngles = others.map(
    (_, index) => ((index + 1) * 2 * Math.PI) / currentAxes.length,
  );
  const angleByKey = new Map(
    others.map((axis, index) => [axis.key, otherAngles[index]]),
  );

  return currentAxes.map((axis) => ({
    ...axis,
    enabled: true,
    angle:
      axis.key === preset.axisKey
        ? STAR_PRESET_LAYOUT.targetAngle
        : angleByKey.get(axis.key),
    length:
      baseLength *
      (axis.key === preset.axisKey
        ? STAR_PRESET_LAYOUT.targetLengthRatio
        : STAR_PRESET_LAYOUT.otherLengthRatio),
  }));
}

function quantile(sortedValues, ratio) {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((sortedValues.length - 1) * ratio)),
  );
  return sortedValues[index];
}

// 上位/下位30%の境界値を返す。Star Coordinates と同じ偏差値を比較する。
export function getPresetHighlightRule(coffees, preset) {
  if (!preset) return null;
  const axis = preset.axisKey;
  const tasteAxis = coffees
    .flatMap((node) => {
      const entry = Object.entries(node.deviation || {}).find(([key]) =>
        key.toLowerCase().startsWith(axis),
      );
      return entry && Number.isFinite(entry[1]) ? [entry[1]] : [];
    })
    .sort((a, b) => a - b);
  const ratio = STAR_PRESET_LAYOUT.highlightedRatio;
  const threshold = quantile(
    tasteAxis,
    preset.direction === "high" ? 1 - ratio : ratio,
  );

  return {
    threshold,
    matches(node) {
      const entry = Object.entries(node.deviation || {}).find(([key]) =>
        key.toLowerCase().startsWith(axis),
      );
      const value = entry?.[1] ?? 0;
      return preset.direction === "high"
        ? value >= threshold
        : value <= threshold;
    },
  };
}
