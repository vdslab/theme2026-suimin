// 元の識別子やパスは維持し、表示だけを日本語にする。
export const FLAVOR_JA = {
  Almond: "アーモンド",
  Apple: "りんご",
  Bergamot: "ベルガモット",
  Berry: "ベリー",
  "Black Tea": "紅茶",
  Blackberry: "ブラックベリー",
  Blueberry: "ブルーベリー",
  "Brown Sugar": "黒糖",
  Caramel: "キャラメル",
  Cardamom: "カルダモン",
  Cereal: "穀物",
  Chamomile: "カモミール",
  Cherry: "チェリー",
  Chocolate: "チョコレート",
  Cinnamon: "シナモン",
  "Citrus Fruit": "柑橘類",
  Clove: "クローブ",
  Cocoa: "ココア",
  "Cocoa Nibs": "カカオニブ",
  "Dark Chocolate": "ダークチョコレート",
  "Dried Fruit": "ドライフルーツ",
  "Earl Grey": "アールグレイ",
  Floral: "花の香り",
  Fruity: "果実の風味",
  "Graham Cracker": "グラハムクラッカー",
  Grape: "ぶどう",
  Grapefruit: "グレープフルーツ",
  Hazelnut: "ヘーゼルナッツ",
  Hibiscus: "ハイビスカス",
  Honey: "はちみつ",
  Jasmine: "ジャスミン",
  Lemon: "レモン",
  Lime: "ライム",
  Malt: "麦芽",
  Mango: "マンゴー",
  "Maple Syrup": "メープルシロップ",
  "Milk Chocolate": "ミルクチョコレート",
  Molasses: "糖蜜",
  Nutmeg: "ナツメグ",
  Nutty: "ナッツ",
  "Nutty/Cocoa": "ナッツ・ココア",
  Orange: "オレンジ",
  "Orange Blossom": "オレンジの花",
  "Other Fruit": "その他の果実",
  "Passion Fruit": "パッションフルーツ",
  Peach: "桃",
  Peanut: "ピーナッツ",
  Pear: "洋梨",
  Pecan: "ピーカンナッツ",
  Pineapple: "パイナップル",
  Prune: "プルーン",
  Raisin: "レーズン",
  Raspberry: "ラズベリー",
  Roasted: "焙煎の香り",
  Rose: "バラ",
  Spices: "スパイス",
  Strawberry: "いちご",
  Sweet: "甘い風味",
  Tangerine: "みかん",
  Tobacco: "たばこ",
  Toffee: "トフィー",
  "Tropical Fruit": "トロピカルフルーツ",
  Vanilla: "バニラ",
  Walnut: "くるみ",
};
export const flavorName = (name) => FLAVOR_JA[name] || name;
export const flavorPath = (path) => path.map(flavorName).join(" ＞ ");
const PROCESS_JA = {
  Anaerobic: "嫌気性発酵",
  Honey: "ハニー",
  Natural: "ナチュラル",
  Other: "その他",
  Washed: "ウォッシュド",
};
const ROAST_JA = {
  Dark: "深煎り",
  Light: "浅煎り",
  "Light-Medium": "浅煎り〜中煎り",
  Medium: "中煎り",
  "Medium-Dark": "中煎り〜深煎り",
  Unknown: "不明",
};
export const processName = (value) => PROCESS_JA[value] || value || "不明";
export const roastName = (value) => ROAST_JA[value] || value || "不明";

export function formatPrice(value, currency = "USD") {
  if (value === undefined || value === null || value === "" || isNaN(Number(value))) {
    return "価格不明";
  }
  const num = Number(value);
  const curr = (currency || "").toUpperCase();
  if (curr === "USD" || curr === "$") {
    return `$${num.toFixed(2)}`;
  }
  if (curr === "JPY" || curr === "円") {
    return `¥${Math.round(num).toLocaleString()}`;
  }
  if (curr === "EUR" || curr === "€") {
    return `€${num.toFixed(2)}`;
  }
  if (curr === "GBP" || curr === "£") {
    return `£${num.toFixed(2)}`;
  }
  return `${currency} ${num.toFixed(2)}`;
}

export function formatConfidence(confidence) {
  if (confidence === undefined || confidence === null || confidence === "" || isNaN(Number(confidence))) {
    return "不明";
  }
  const val = Number(confidence);
  const percent = Math.round(val * 100);
  return `${percent}% (${val.toFixed(2)})`;
}

