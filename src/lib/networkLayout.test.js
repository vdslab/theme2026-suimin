import test from "node:test";
import assert from "node:assert/strict";
import { forceSimulation, forceLink } from "d3-force";
import { networkLayout, resizeNetworkNodes } from "./networkLayout.js";

test("network geometry follows container dimensions without a fixed viewBox", () => {
  for (const [width, height] of [
    [320, 340],
    [720, 540],
    [1400, 780],
  ]) {
    const layout = networkLayout(width, height);
    assert.equal(layout.cx, width / 2);
    assert.equal(layout.cy, height / 2);
    assert.ok(layout.unit >= 0.55 && layout.unit <= 1.6);
  }
  assert.ok(networkLayout(1200, 780).unit > networkLayout(400, 340).unit);
});

test("resize preserves simulation nodes, selected details, links and drag pins", () => {
  const nodes = [
    { id: "center", x: 350, y: 270, fx: 350, fy: 270 },
    { id: "bean", x: 500, y: 400, fx: 500, fy: 400, bean: { title: "Coffee" } },
  ];
  const links = [{ source: "center", target: "bean" }];
  const simulation = forceSimulation(nodes)
    .stop()
    .force(
      "link",
      forceLink(links).id((node) => node.id),
    );
  const inspected = nodes[1];
  const before = networkLayout(700, 540);
  const after = networkLayout(1050, 810);
  resizeNetworkNodes(nodes, before, after);
  assert.equal(nodes[1], inspected);
  assert.equal(links[0].source, nodes[0]);
  assert.equal(links[0].target, inspected);
  assert.equal(nodes[0].fx, after.cx);
  assert.equal(nodes[0].fy, after.cy);
  assert.equal(inspected.fx, 750);
  assert.equal(inspected.fy, 600);
  assert.equal(inspected.bean.title, "Coffee");
  resizeNetworkNodes(nodes, after, before);
  assert.equal(inspected.x, 500);
  assert.equal(inspected.y, 400);
  simulation.stop();
});
