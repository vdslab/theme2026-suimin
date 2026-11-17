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

test("anchor order maximizes the closed Jaccard tour using only displayed links", async () => {
  const { computeAnchorOrder } = await import("./networkLayout.js");
  const anchors = ["a", "b", "c", "d"].map((id) => ({
    id,
    flavor: { id, beanIds: new Set(["outside-graph"]) },
  }));
  const members = {
    a: ["1", "2"],
    b: ["3", "4"],
    c: ["1", "2", "3"],
    d: ["3", "4", "5"],
  };
  const links = Object.entries(members).flatMap(([target, ids]) =>
    ids.map((source) => ({ source, target })),
  );
  const score = (order) =>
    order.reduce((total, node, i) => {
      const left = new Set(members[node.id]);
      const right = new Set(members[order[(i + 1) % order.length].id]);
      const intersection = [...left].filter((id) => right.has(id)).length;
      return total + intersection / new Set([...left, ...right]).size;
    }, 0);
  const permutations = (values) =>
    values.length
      ? values.flatMap((v) =>
          permutations(values.filter((n) => n !== v)).map((rest) => [
            v,
            ...rest,
          ]),
        )
      : [[]];
  const order = computeAnchorOrder(anchors, links);
  assert.ok(
    Math.abs(score(order) - Math.max(...permutations(anchors).map(score))) <
      1e-12,
  );
  assert.deepEqual(computeAnchorOrder([...anchors].reverse(), links), order);
  assert.deepEqual(computeAnchorOrder([], []), []);
  assert.deepEqual(computeAnchorOrder(anchors, []), anchors);
});

test("anchors lie on the ellipse and bean positions average only connected anchors", async () => {
  const {
    computeAnchorPositions,
    computeBeanInitialPosition,
    constrainBeanPosition,
  } = await import("./networkLayout.js");
  const anchors = ["a", "b", "c", "d"].map((id) => ({ id }));
  for (const [width, height] of [
    [320, 340],
    [700, 540],
    [1400, 780],
  ]) {
    const positions = computeAnchorPositions(anchors, width, height);
    assert.equal(positions.get("a").y, 55);
    const p = computeBeanInitialPosition({ id: "bean" }, positions, [
      { source: "bean", target: "a" },
      { source: { id: "bean" }, target: { id: "b" } },
      { source: "other", target: "c" },
    ]);
    assert.equal(p.x, (positions.get("a").x + positions.get("b").x) / 2);
    assert.equal(p.y, (positions.get("a").y + positions.get("b").y) / 2);
    const node = { x: width * 2, y: height * 2 };
    constrainBeanPosition(node, networkLayout(width, height));
    assert.ok(node.x < width && node.y < height);
  }
  assert.equal(
    computeBeanInitialPosition({ id: "missing" }, new Map(), []),
    null,
  );
});
