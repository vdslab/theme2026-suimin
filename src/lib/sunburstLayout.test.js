import test from "node:test";
import assert from "node:assert/strict";
import {
  sunburstHierarchy,
  sunburstNodeForId,
  sunburstLabel,
  sunburstRadius,
} from "./sunburstLayout.js";
import { buildFlavorData, buildFlavorNetwork, pathId } from "./flavorData.js";
import { csvFormat } from "d3-dsv";
import { partition } from "d3-hierarchy";

test("duplicate terminal tags stop at level two without changing source data or weights", () => {
  const data = buildFlavorData(
    csvFormat([
      {
        product_id: "1",
        tasting_notes_sca_nodes:
          "Sweet > Vanilla > Vanilla; Sweet > Honey > Honey; Roasted > Tobacco > Tobacco; Fruity > Berry > Strawberry; Sweet > Caramel",
      },
      { product_id: "2", tasting_notes_sca_nodes: "Sweet > Honey > Honey" },
    ]),
  );
  const root = sunburstHierarchy(data.root);
  partition().size([Math.PI * 2, 240])(root);
  assert.equal(root.value, 5);
  for (const path of [
    ["Sweet", "Vanilla"],
    ["Sweet", "Honey"],
    ["Roasted", "Tobacco"],
  ]) {
    const originalId = pathId([...path, path.at(-1)]);
    const displayed = sunburstNodeForId(root, originalId);
    assert.equal(displayed.data.id, pathId(path));
    assert.equal(displayed.depth, 2);
    assert.equal(displayed.children, undefined);
    assert.equal(displayed.value, 1);
    assert.equal(displayed.y1, 180);
    assert.ok(
      Math.abs(displayed.x1 - displayed.x0 - (Math.PI * 2) / 5) < 1e-12,
    );
    assert.equal(
      root.descendants().some((n) => n.data.id === originalId),
      false,
    );
    assert.equal(displayed.data.children.length, 1);
    assert.ok(data.nodes.has(originalId));
    assert.equal(
      buildFlavorNetwork(data, originalId).matchedCount,
      buildFlavorNetwork(data, displayed.data.id).matchedCount,
    );
  }
  assert.equal(
    sunburstNodeForId(root, pathId(["Fruity", "Berry", "Strawberry"])).depth,
    3,
  );
  assert.equal(sunburstNodeForId(root, pathId(["Sweet", "Caramel"])).depth, 2);
});

test("same-name children are retained when there are other genuine child tags", () => {
  const data = buildFlavorData(
    csvFormat([
      {
        product_id: "1",
        tasting_notes_sca_nodes:
          "Sweet > Brown Sugar > Brown Sugar; Sweet > Brown Sugar > Molasses; Floral > Floral > Jasmine",
      },
    ]),
  );
  const root = sunburstHierarchy(data.root);
  assert.equal(root.value, 3);
  assert.equal(
    sunburstNodeForId(root, pathId(["Sweet", "Brown Sugar", "Brown Sugar"]))
      .depth,
    3,
  );
  assert.equal(
    sunburstNodeForId(root, pathId(["Floral", "Floral", "Jasmine"])).depth,
    3,
  );
});

test("the entire circle fits both viewport dimensions including its margin", () => {
  for (const [width, height] of [
    [900, 500],
    [320, 600],
    [1200, 300],
    [0, 0],
  ]) {
    const radius = sunburstRadius(width, height);
    assert.ok(radius >= 0);
    assert.ok(radius * 2 <= Math.min(width, height));
    if (width && height) assert.equal(radius * 2 + 24, Math.min(width, height));
  }
});

test("labels that cannot fit remain hidden without spilling into adjacent arcs", () => {
  const node = { y0: 150, y1: 220, x0: 0, x1: 0.4 };
  assert.equal(sunburstLabel(node, "???").visible, true);
  assert.equal(sunburstLabel({ ...node, x1: 0.01 }, "?").visible, false);
  assert.equal(sunburstLabel({ ...node, y1: 155 }, "???").visible, false);
  assert.equal(sunburstLabel(node, "").visible, false);
});

test("Nutty/Cocoa label fits its real-data angular share on desktop and mobile", () => {
  for (const width of [320, 400, 500, 800]) {
    const radius = sunburstRadius(width, 500);
    const node = {
      y0: radius / 4,
      y1: radius / 2,
      x0: 2.5871939500151235,
      x1: 3.695991357164462,
    };
    const label = sunburstLabel(node, "???????");
    assert.equal(label.visible, true, "viewport width: " + width);
    assert.equal(label.lines.join(""), "???????");
    assert.ok(label.fontSize >= 10);
  }
});

test("left-side labels flip and all depths use the ring midpoint", () => {
  for (const [y0, y1] of [
    [50, 100],
    [100, 150],
    [150, 200],
  ]) {
    const right = sunburstLabel({ y0, y1, x0: 0, x1: Math.PI }, "味");
    const left = sunburstLabel({ y0, y1, x0: Math.PI, x1: 2 * Math.PI }, "味");
    assert.equal(
      right.transform,
      `rotate(0) translate(${(y0 + y1) / 2},0) rotate(0)`,
    );
    assert.equal(
      left.transform,
      `rotate(180) translate(${(y0 + y1) / 2},0) rotate(180)`,
    );
  }
});
