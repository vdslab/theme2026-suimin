import { flavorName } from "./flavorJapanese.js";

// Editorial line breaks stay fixed across viewport sizes. Full names and paths
// elsewhere in the UI continue to use the original Japanese translations.
const labelLines = {
  Blackberry: ["ブラック", "ベリー"],
  Blueberry: ["ブルー", "ベリー"],
  "Cocoa Nibs": ["カカオ", "ニブ"],
  "Dark Chocolate": ["ダーク", "チョコレート"],
  "Dried Fruit": ["ドライ", "フルーツ"],
  "Earl Grey": ["アール", "グレイ"],
  "Graham Cracker": ["グラハム", "クラッカー"],
  Grapefruit: ["グレープ", "フルーツ"],
  Hazelnut: ["ヘーゼル", "ナッツ"],
  "Maple Syrup": ["メープル", "シロップ"],
  "Milk Chocolate": ["ミルク", "チョコレート"],
  "Nutty/Cocoa": ["ナッツ・", "ココア"],
  "Orange Blossom": ["オレンジ", "の花"],
  "Other Fruit": ["その他の", "果実"],
  "Passion Fruit": ["パッション", "フルーツ"],
  Pecan: ["ピーカン", "ナッツ"],
  "Tropical Fruit": ["トロピカル", "フルーツ"],
};

export function sunburstLabelLines(name) {
  return labelLines[name] || [flavorName(name)];
}
