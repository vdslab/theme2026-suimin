import config from "../data/flavorColors.json" with { type: "json" };

export const flavorColorTheme = config.ui;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function hash(value) {
  let result = 2166136261;
  for (const char of value)
    result = Math.imul(result ^ char.codePointAt(0), 16777619);
  return result >>> 0;
}

function toHsl(hex) {
  const [r, g, b] = hex
    .slice(1)
    .match(/.{2}/g)
    .map((part) => parseInt(part, 16) / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2,
    delta = max - min;
  if (!delta) return [0, 0, l];
  const h =
    max === r
      ? ((g - b) / delta + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / delta + 2) / 6
        : ((r - g) / delta + 4) / 6;
  return [h, delta / (1 - Math.abs(2 * l - 1)), l];
}

function toHex([h, s, l]) {
  const a = s * Math.min(l, 1 - l);
  return `#${[0, 8, 4]
    .map((n) => {
      const k = (n + h * 12) % 12;
      const channel = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(channel * 255)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

/** Paths, rather than sibling indexes, keep colors stable when data is reordered. */
export function getFlavorColor(path = []) {
  const base = config.level1[path[0]] || config.ui.fallback;
  if (path.length <= 1 || !config.level1[path[0]]) return base;
  // Derive from the immediate parent so every depth stays in its color family.
  const [h, s, l] = toHsl(getFlavorColor(path.slice(0, -1)));
  const settings = config.derived;
  const lightnessVariation =
    hash(`light:${JSON.stringify(path)}`) / 0xffffffff - 0.5;
  const saturationVariation =
    hash(`sat:${JSON.stringify(path)}`) / 0xffffffff - 0.5;
  return toHex([
    h,
    clamp(
      s +
        settings.saturationPerLevel +
        saturationVariation * settings.siblingSaturationSpread,
      settings.minSaturation,
      settings.maxSaturation,
    ),
    clamp(
      l +
        settings.lightnessPerLevel +
        lightnessVariation * settings.siblingLightnessSpread,
      settings.minLightness,
      settings.maxLightness,
    ),
  ]);
}

function contrastText(fill) {
  const luminance = fill
    .slice(1)
    .match(/.{2}/g)
    .map((part) => {
      const channel = parseInt(part, 16) / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const luminanceOf = (hex) =>
    hex
      .slice(1)
      .match(/.{2}/g)
      .map((part) => {
        const value = parseInt(part, 16) / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const darkContrast =
    (luminance + 0.05) / (luminanceOf(config.ui.darkText) + 0.05);
  const lightContrast =
    (luminanceOf(config.ui.lightText) + 0.05) / (luminance + 0.05);
  return darkContrast >= lightContrast
    ? config.ui.darkText
    : config.ui.lightText;
}

/** Shared rendering colors for pointer hover, keyboard focus and selection. */
export function getFlavorAppearance(
  path,
  { hovered = false, selected = false } = {},
) {
  const base = getFlavorColor(path);
  let fill = base;
  if (hovered || selected) {
    const [h, s, l] = toHsl(base);
    fill = toHex([
      h,
      s,
      clamp(
        l +
          (hovered
            ? config.interaction.hoverLightness
            : config.interaction.selectedLightness),
      ),
    ]);
  }
  return {
    fill,
    label: contrastText(fill),
    stroke: selected || hovered ? config.ui.emphasis : config.ui.divider,
    strokeWidth: selected
      ? config.interaction.selectedStrokeWidth
      : hovered
        ? config.interaction.hoverStrokeWidth
        : config.interaction.strokeWidth,
  };
}
