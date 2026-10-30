import test from "node:test";
import assert from "node:assert/strict";
import { csvFormat } from "d3-dsv";
import config from "../data/flavorColors.json" with { type: "json" };
import { getFlavorColor, getFlavorAppearance } from "./flavorColorUtils.js";
import { buildFlavorData } from "./flavorData.js";

test("first levels use fixed JSON colors and second levels inherit their hue", () => {
  for (const [name, color] of Object.entries(config.level1)) {
    assert.equal(getFlavorColor([name]), color);
  }
  for (const name of Object.keys(config.level1)) {
    const child = getFlavorColor([name, "Category"]);
    const difference = Math.abs(hue(child) - hue(config.level1[name]));
    assert.ok(Math.min(difference, 360 - difference) < 2);
  }
  assert.notEqual(
    getFlavorColor(["Floral"]),
    getFlavorColor(["Floral", "Floral"]),
  );
  assert.notEqual(
    getFlavorColor(["Spices"]),
    getFlavorColor(["Spices", "Spices"]),
  );
});

const hue = (hex) => {
  const [r, g, b] = hex
    .slice(1)
    .match(/.{2}/g)
    .map((part) => parseInt(part, 16) / 255);
  const max = Math.max(r, g, b),
    delta = max - Math.min(r, g, b);
  return (
    ((max === r
      ? (g - b) / delta
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4) *
      60 +
      360) %
    360
  );
};

test("siblings share one color and depth changes preserve the parent hue", () => {
  const parent = ["Fruity", "Berry"];
  const siblings = ["Strawberry", "Blueberry", "Raspberry"].map((name) =>
    getFlavorColor([...parent, name]),
  );
  assert.equal(new Set(siblings).size, 1);
  assert.equal(
    getFlavorColor(["Fruity", "Other Fruit", "Mango"]),
    getFlavorColor(["Fruity", "Other Fruit", "Pineapple"]),
  );
  assert.equal(
    getFlavorColor(["Fruity", "Berry"]),
    getFlavorColor(["Fruity", "Other Fruit"]),
  );
  assert.notEqual(
    siblings[0],
    getFlavorColor([...parent, "Strawberry", "Detail"]),
  );
  assert.notEqual(
    siblings[0],
    getFlavorColor(["Sweet", "Brown Sugar", "Molasses"]),
  );
  for (const color of [
    ...siblings,
    getFlavorColor([...parent, "Strawberry", "Detail"]),
  ]) {
    assert.match(color, /^#[0-9a-f]{6}$/i);
    assert.notEqual(color.toUpperCase(), getFlavorColor(parent));
    const difference = Math.abs(hue(color) - hue(getFlavorColor(parent)));
    assert.ok(Math.min(difference, 360 - difference) < 2);
  }
});

test("reordering rows and tags or adding siblings does not recolor existing paths", () => {
  const rows = [
    {
      product_id: "1",
      tasting_notes_sca_nodes:
        "Fruity > Berry > Strawberry; Sweet > Honey > Honey",
    },
    { product_id: "2", tasting_notes_sca_nodes: "Fruity > Berry > Blueberry" },
  ];
  const before = buildFlavorData(csvFormat(rows));
  const after = buildFlavorData(
    csvFormat([
      {
        product_id: "3",
        tasting_notes_sca_nodes: "Fruity > Berry > Raspberry",
      },
      ...rows.toReversed().map((row) => ({
        ...row,
        tasting_notes_sca_nodes: row.tasting_notes_sca_nodes
          .split(";")
          .reverse()
          .join(";"),
      })),
    ]),
  );
  for (const node of before.nodes.values())
    assert.equal(before.color(node.path), after.color(node.path));
});

test("hover and selection share emphasis while retaining selection stroke priority", () => {
  const path = ["Fruity", "Berry", "Strawberry"];
  const normal = getFlavorAppearance(path);
  const hover = getFlavorAppearance(path, { hovered: true });
  const selected = getFlavorAppearance(path, { selected: true });
  const both = getFlavorAppearance(path, { hovered: true, selected: true });
  assert.notEqual(normal.fill, hover.fill);
  assert.notEqual(normal.fill, selected.fill);
  assert.equal(hover.stroke, config.ui.emphasis);
  assert.equal(both.strokeWidth, config.interaction.selectedStrokeWidth);
  assert.equal(getFlavorAppearance(path, { outer: true }).label, normal.label);
  assert.ok([config.ui.darkText, config.ui.lightText].includes(normal.label));
  assert.equal(getFlavorColor(["Unknown", "Unknown"]), config.ui.fallback);
});
