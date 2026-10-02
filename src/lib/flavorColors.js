const TOP_LEVEL_COLORS = {
  Fruity: "#cc312d",
  Floral: "#c72d68",
  Sweet: "#d85e3b",
  "Nutty/Cocoa": "#b67c57",
  Spices: "#a92f45",
  Roasted: "#bd5038",
  "Sour/Fermented": "#e8bb3c",
  "Green/Vegetative": "#367c3b",
  Other: "#4ca4b6",
};

const DETAIL_COLORS = {
  Berry: "#ce5557",
  "Dried Fruit": "#bd5548",
  "Other Fruit": "#e57252",
  "Citrus Fruit": "#efa941",
  "Black Tea": "#9d5c6c",
  "Brown Sugar": "#bd635c",
  Vanilla: "#ea9380",
  Cocoa: "#b47a52",
  Nutty: "#be9075",
  Cereal: "#d7ad65",
};

function mixWithWhite(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [value >> 16, (value >> 8) & 255, value & 255];
  const mixed = channels.map((channel) =>
    Math.round(channel + (255 - channel) * amount),
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function flavorColor(name, topLevelName = name, depth = 1) {
  const base =
    DETAIL_COLORS[name] ?? TOP_LEVEL_COLORS[topLevelName] ?? "#8b7465";
  return depth <= 1 ? base : mixWithWhite(base, Math.min(0.34, depth * 0.08));
}
