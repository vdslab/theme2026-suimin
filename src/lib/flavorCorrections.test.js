import assert from "node:assert/strict";
import test from "node:test";
import { keepTag } from "./flavorCorrections.js";
import { aggregateFlavorRows } from "./flavorData.js";

// Expected values are keep_tag() from scripts/flavor_analysis.py (#120) on
// the same inputs, so both sides drop the same tags.
const CASES = [
  ["Honey", "Washed. Notes of honey and lemon.", true],
  ["Honey", "Red Honey process lot from Costa Rica.", false],
  ["Honey", "Process: Double Anaerobic Honey. Notes of plum.", false],
  ["Honey", "dried as a honey, sweet", false],
  ["Honey", "A honey process coffee with honey sweetness", true],
  ["Honey", "Notes of plum and grape.", false],
  [
    "Cherry",
    "Farmers deliver cherries to the station; we handpick ripe cherry.",
    false,
  ],
  ["Cherry", "Notes of cherry and chocolate.", false],
  [
    "Cherry",
    "coffee cherry is dried in cherry. Tastes like black cherry jam.",
    true,
  ],
  ["Cherry", "Workers handpick fully ripe cherry at the farm.", true],
  ["Cherry", "Natural process with slow cherry maturation.", false],
  ["Cherry", "Notes of plum.", true],
  ["Cherry", "dried in the cherry notes of berry", false],
  ["Orange", "orange blossom and jasmine", false],
  ["Orange", "orange blossom, blood orange", true],
  ["Orange", "Notes of oranges.", true],
  ["Apple", "apple blossom, custard apple", false],
  ["Apple", "green apple and apple blossom", true],
  ["Rose", "as the popularity of ice skating rose", false],
  ["Rose", "Bourbon Rose variety, rose to prominence", false],
  ["Rose", "rose, jasmine", true],
  ["Rose", "Santa Rose estate", false],
  ["Peach", "stone fruit", true],
];

test("correction rules match flavor_analysis.py", () => {
  for (const [descriptor, raw, expected] of CASES)
    assert.equal(keepTag(descriptor, raw), expected, `${descriptor}: ${raw}`);
});

test("rules are reusable across calls (global regexes reset)", () => {
  for (let i = 0; i < 3; i++) {
    assert.equal(keepTag("Orange", "orange blossom and jasmine"), false);
    assert.equal(keepTag("Orange", "Notes of oranges."), true);
  }
});

test("aggregation drops corrected tags and counts them", () => {
  const rows = [
    {
      source_roaster: "R",
      product_id: "1",
      tasting_notes_raw: "A red honey lot with orange blossom.",
      tasting_notes_sca_nodes:
        "Sweet>Honey>Honey; Fruity>Citrus Fruit>Orange; Floral>Floral>Orange Blossom",
    },
  ];
  const { beans, dropped } = aggregateFlavorRows(rows, keepTag);
  assert.deepEqual(beans[0].paths, [["Floral", "Floral", "Orange Blossom"]]);
  assert.deepEqual(dropped, { Honey: 1, Orange: 1 });
  assert.equal(aggregateFlavorRows(rows).beans[0].paths.length, 3);
});
