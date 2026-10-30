import test from "node:test";
import assert from "node:assert/strict";
import { csvFormat } from "d3-dsv";
import { hierarchy, partition } from "d3-hierarchy";
import {
  buildFlavorData,
  buildFlavorNetwork,
  parseFlavorPaths,
  pathId,
  MAX_BEANS,
} from "./flavorData.js";

test("tag paths are trimmed and deduplicated", () => {
  assert.deepEqual(
    parseFlavorPaths(
      " Fruity > Berry > Strawberry ; Fruity>Berry>Strawberry;;",
    ),
    [["Fruity", "Berry", "Strawberry"]],
  );
});
const makeCsv = (rows) =>
  csvFormat(
    rows.map((row, i) => ({
      product_id: `${i}`,
      source_roaster: "Test",
      title: `Bean ${i}`,
      tasting_notes_confidence: "0.8",
      ...row,
    })),
  );
test("sunburst angles count unique leaf paths independently of bean counts", () => {
  const data = buildFlavorData(
    makeCsv([
      {
        tasting_notes_sca_nodes:
          "Fruity > Berry > Strawberry; Fruity > Berry > Strawberry; Fruity > Berry > Raspberry; Fruity > Berry > Blueberry; Fruity > Citrus Fruit > Lemon; Fruity > Citrus Fruit > Orange; Sweet > Honey; Sweet > Caramel; Floral",
      },
      { tasting_notes_sca_nodes: "Fruity > Berry > Strawberry; Sweet > Honey" },
      { tasting_notes_sca_nodes: "Fruity > Berry > Strawberry; Fruity > Berry" },
    ]),
  );
  const root = hierarchy(data.root)
    .sum((n) => n.weight)
    .sort((a, b) => b.value - a.value);
  partition().size([2 * Math.PI, 235])(root);
  const nodes = new Map(root.descendants().map((n) => [n.data.id, n]));
  const get = (...path) => nodes.get(pathId(path));
  assert.equal(root.value, 8);
  assert.equal(get("Fruity").value, 5);
  assert.equal(get("Fruity", "Berry").value, 3);
  assert.equal(get("Fruity", "Citrus Fruit").value, 2);
  assert.equal(get("Sweet").value, 2);
  for (const leaf of root.leaves()) {
    assert.equal(leaf.value, 1);
    assert.ok(Math.abs(leaf.x1 - leaf.x0 - (2 * Math.PI) / 8) < 1e-12);
  }
  for (const node of root.descendants()) {
    assert.ok(
      Math.abs(node.x1 - node.x0 - (2 * Math.PI * node.value) / 8) < 1e-12,
    );
  }
  assert.equal(get("Fruity", "Berry", "Strawberry").data.beanIds.size, 3);
  assert.equal(get("Fruity", "Berry", "Raspberry").data.beanIds.size, 1);
  assert.equal(get("Fruity", "Berry").data.beanIds.size, 3);
  assert.equal(get("Sweet").data.beanIds.size, 2);
  assert.equal(data.initialId, pathId(["Fruity", "Berry", "Strawberry"]));
  for (const node of root.descendants()) {
    const network = buildFlavorNetwork(data, node.data.id);
    assert.equal(network.matchedCount, node.data.beanIds.size);
    assert.equal(network.selected, node.data);
    assert.equal(
      network.links.filter((l) => l.target === "selected").length,
      node.data.beanIds.size,
    );
  }
});
test("intermediate selection includes descendants, duplicate products merge, single-tag beans stay connected", () => {
  const data = buildFlavorData(
    makeCsv([
      {
        product_id: "1",
        tasting_notes_sca_nodes: "Fruity > Berry > Strawberry",
      },
      {
        product_id: "1",
        tasting_notes_sca_nodes:
          "Fruity > Berry > Strawberry; Sweet > Honey > Honey",
      },
      {
        product_id: "2",
        tasting_notes_sca_nodes: "Fruity > Berry > Blueberry",
      },
      { product_id: "3", tasting_notes_sca_nodes: "" },
    ]),
  );
  const network = buildFlavorNetwork(data, pathId(["Fruity", "Berry"]));
  assert.equal(network.matchedCount, 2);
  assert.equal(network.cooccurrenceCount, 1);
  assert.equal(network.beans.length, 2);
  assert.equal(network.links.filter((l) => l.target === "selected").length, 2);
  assert.equal(network.nodes.find((n) => n.type === "flavor").count, 1);
  const single = buildFlavorNetwork(
    data,
    pathId(["Fruity", "Berry", "Blueberry"]),
  );
  assert.equal(single.nodes.length, 2);
  assert.equal(single.links.length, 1);
});
test("limits apply after population counts, confidence chooses displayed beans", () => {
  const rows = Array.from({ length: 35 }, (_, i) => ({
    tasting_notes_sca_nodes:
      "Sweet > Honey > Honey; Fruity > Berry > Strawberry",
    tasting_notes_confidence: String(i / 35),
  }));
  const network = buildFlavorNetwork(
    buildFlavorData(makeCsv(rows)),
    pathId(["Sweet"]),
  );
  assert.equal(network.matchedCount, 35);
  assert.equal(network.beans.length, MAX_BEANS);
  assert.equal(network.beans[0].product_id, "34");
  assert.equal(network.nodes.find((n) => n.type === "flavor").count, 35);
});
