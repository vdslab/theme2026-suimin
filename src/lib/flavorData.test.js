import test from "node:test";
import assert from "node:assert/strict";
import { csvFormat } from "d3-dsv";
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
