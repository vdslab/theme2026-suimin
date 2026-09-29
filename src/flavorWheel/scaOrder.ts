// SCA Coffee Taster's Flavor Wheel の並び順（時計回り）と大分類の色。
// データに無い名前は各階層の末尾にアルファベット順で置く。

const ORDER: string[] = [
  // Level 1
  "Floral",
  "Fruity",
  "Sour/Fermented",
  "Green/Vegetative",
  "Other",
  "Roasted",
  "Spices",
  "Nutty/Cocoa",
  "Sweet",
  // Level 2
  "Black Tea",
  "Berry",
  "Dried Fruit",
  "Other Fruit",
  "Citrus Fruit",
  "Pipe Tobacco",
  "Tobacco",
  "Burnt",
  "Cereal",
  "Pungent",
  "Pepper",
  "Brown Spice",
  "Nutty",
  "Cocoa",
  "Brown Sugar",
  "Honey",
  "Vanilla",
  "Vanillin",
  "Overall Sweet",
  "Sweet Aromatics",
  // Level 3
  "Chamomile",
  "Rose",
  "Jasmine",
  "Hibiscus",
  "Orange Blossom",
  "Blackberry",
  "Raspberry",
  "Blueberry",
  "Strawberry",
  "Raisin",
  "Prune",
  "Coconut",
  "Cherry",
  "Pomegranate",
  "Pineapple",
  "Tropical Fruit",
  "Mango",
  "Passion Fruit",
  "Grape",
  "Apple",
  "Peach",
  "Pear",
  "Grapefruit",
  "Orange",
  "Tangerine",
  "Bergamot",
  "Lemon",
  "Lime",
  "Grain",
  "Malt",
  "Graham Cracker",
  "Anise",
  "Nutmeg",
  "Cinnamon",
  "Clove",
  "Earl Grey",
  "Peanut",
  "Hazelnut",
  "Almond",
  "Pecan",
  "Chocolate",
  "Milk Chocolate",
  "Dark Chocolate",
  "Cocoa Nibs",
  "Molasses",
  "Maple Syrup",
  "Caramel",
  "Brown Sugar",
];

const RANK = new Map(ORDER.map((name, i) => [name, i]));

export function compareScaOrder(a: string, b: string): number {
  const ra = RANK.get(a) ?? Number.POSITIVE_INFINITY;
  const rb = RANK.get(b) ?? Number.POSITIVE_INFINITY;
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b);
}

/** Flavor Wheel の配色に寄せた大分類色 */
const CATEGORY_COLOR: Record<string, string> = {
  Floral: "#d9468f",
  Fruity: "#e03a3e",
  "Sour/Fermented": "#d6b52a",
  "Green/Vegetative": "#2f9a4a",
  Other: "#3a8fb7",
  Roasted: "#c6613a",
  Spices: "#a3243b",
  "Nutty/Cocoa": "#8a5a3c",
  Sweet: "#e8872c",
};

export function categoryColor(level1: string): string {
  return CATEGORY_COLOR[level1] ?? "#777";
}
