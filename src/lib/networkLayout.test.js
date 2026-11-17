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

const anchorsFor = (count) => [
  ...Array.from({ length: count }, (_, i) => ({ id: "s" + i, type: "center" })),
  ...Array.from({ length: 5 }, (_, i) => ({ id: "r" + i, type: "flavor" })),
];

test("selected anchors stay fixed in selection order and form an equilateral triangle", async () => {
  const { computeSelectedPositions } = await import("./networkLayout.js");
  const one = computeSelectedPositions(anchorsFor(1).slice(0, 1), 700, 540);
  assert.deepEqual(one.get("s0"), { x: 350, y: 270 });
  const two = [
    ...computeSelectedPositions(anchorsFor(2).slice(0, 2), 700, 540).values(),
  ];
  assert.ok(two[0].x < 350 && two[1].x > 350);
  assert.equal(two[0].y, two[1].y);
  const three = [
    ...computeSelectedPositions(anchorsFor(3).slice(0, 3), 700, 540).values(),
  ];
  assert.ok(three[0].y < three[1].y && three[1].x < 350 && three[2].x > 350);
  const distances = three.map((p, i) =>
    Math.hypot(p.x - three[(i + 1) % 3].x, p.y - three[(i + 1) % 3].y),
  );
  assert.ok(Math.max(...distances) - Math.min(...distances) < 1e-9);
});

test("related anchors stay outside the selected region without overlap, even with concentrated or zero weights", async () => {
  const { computeAnchorPositions, anchorGeometry, computeSelectedPositions } =
    await import("./networkLayout.js");
  for (const [width, height] of [
    [240, 300],
    [320, 340],
    [700, 540],
    [1400, 780],
    [1000, 200],
    [200, 1000],
  ]) {
    for (let count = 1; count <= 3; count++) {
      const anchors = anchorsFor(count);
      const concentrated = anchors.map((n) => ({
        source: "bean",
        target: n.id,
      }));
      for (const links of [[], concentrated]) {
        const positions = computeAnchorPositions(anchors, width, height, links);
        assert.deepEqual(
          computeAnchorPositions(anchors, width, height, links),
          positions,
        );
        assert.deepEqual(
          computeAnchorPositions(
            [...anchors.slice(0, count), ...anchors.slice(count).reverse()],
            width,
            height,
            links,
          ),
          positions,
        );
        const selected = computeSelectedPositions(
          anchors.slice(0, count),
          width,
          height,
        );
        for (const [id, p] of selected) assert.deepEqual(positions.get(id), p);
        const { cx, cy, rx, ry, scale, selectedRadius } = anchorGeometry(
          width,
          height,
        );
        for (const node of anchors.slice(count)) {
          const p = positions.get(node.id);
          assert.ok(
            Math.abs(((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 - 1) <
              1e-9,
          );
          assert.ok(Math.hypot(p.x - cx, p.y - cy) > selectedRadius);
          assert.ok(p.x >= 32 * scale && p.x <= width - 32 * scale);
          assert.ok(p.y >= 32 * scale && p.y <= height - 32 * scale);
          for (const other of anchors.filter((n) => n.id !== node.id)) {
            const q = positions.get(other.id);
            assert.ok(
              Math.hypot(p.x - q.x, p.y - q.y) >=
                (other.type === "center" ? 72 : 70) * scale - 1e-8,
            );
          }
        }
      }
    }
  }
});

test("Jaccard direction uses displayed links rather than population counts and favors the stronger selection", async () => {
  const { computeAnchorPositions } = await import("./networkLayout.js");
  const anchors = anchorsFor(2)
    .slice(0, 2)
    .concat({
      id: "r",
      type: "flavor",
      flavor: { id: "r", beanIds: new Set(["outside"]) },
    });
  const links = [
    { source: "b1", target: "s0" },
    { source: "b2", target: "s0" },
    { source: "b2", target: "s1" },
    { source: "b3", target: "s1" },
    { source: "b4", target: "s1" },
    { source: "b1", target: "r" },
    { source: "b2", target: "r" },
  ];
  const p = computeAnchorPositions(anchors, 700, 540, links).get("r");
  assert.ok(p.x < 350);
  assert.ok(Math.abs(p.y - 270) < 1e-9);
  const objectLinks = links.map((l) => ({
    source: { id: l.source },
    target: { id: l.target },
  }));
  assert.deepEqual(
    computeAnchorPositions(anchors, 700, 540, objectLinks).get("r"),
    p,
  );
});

test("bean targets use selected anchors only regardless of related coordinates", async () => {
  const {
    computeBeanInitialPosition,
    computeBeanTargetPosition,
    constrainBeanPosition,
  } = await import("./networkLayout.js");
  const positions = new Map([
    ["s", { x: 100, y: 100 }],
    ["r", { x: 500, y: 300 }],
  ]);
  const links = [
    { source: "bean", target: "s" },
    { source: "bean", target: "r" },
    { source: "other", target: "r" },
  ];
  const bean = { id: "bean" };
  assert.deepEqual(computeBeanInitialPosition(bean, positions, links), {
    x: 300,
    y: 200,
  });
  assert.deepEqual(
    computeBeanTargetPosition(
      bean,
      positions,
      links,
      new Map([["s", positions.get("s")]]),
    ),
    { x: 100, y: 100 },
  );
  assert.equal(
    computeBeanInitialPosition({ id: "missing" }, positions, links),
    null,
  );
  const outside = { x: 10000, y: 10000 };
  constrainBeanPosition(outside, networkLayout(320, 340));
  assert.ok(outside.x < 320 && outside.y < 340);
});

test("triangle height aims for 55 percent and shrinks to fit narrow screens", async () => {
  const { computeSelectedPositions } = await import("./networkLayout.js");
  for (const [width, height] of [
    [700, 540],
    [1400, 780],
  ]) {
    const p = [
      ...computeSelectedPositions(
        anchorsFor(3).slice(0, 3),
        width,
        height,
      ).values(),
    ];
    assert.ok(Math.abs((p[1].y - p[0].y) / height - 0.55) < 1e-9);
  }
  for (const [width, height] of [
    [320, 340],
    [200, 1000],
  ]) {
    const p = [
      ...computeSelectedPositions(
        anchorsFor(3).slice(0, 3),
        width,
        height,
      ).values(),
    ];
    assert.ok((p[1].y - p[0].y) / height <= 0.55);
    assert.ok(
      p.every((n) => n.x > 0 && n.x < width && n.y > 0 && n.y < height),
    );
  }
});

test("one, two and three selected matches produce vertices, edge midpoints and centroid", async () => {
  const { computeSelectedPositions, computeBeanTargetPosition } = await import(
    "./networkLayout.js"
  );
  const selected = computeSelectedPositions(
    anchorsFor(3).slice(0, 3),
    700,
    540,
  );
  const all = new Map([...selected, ["r", { x: 9999, y: -9999 }]]);
  for (const ids of [
    ["s0"],
    ["s0", "s1"],
    ["s0", "s2"],
    ["s1", "s2"],
    ["s0", "s1", "s2"],
  ]) {
    const links = [...ids, "r"].map((target) => ({ source: "bean", target }));
    const expected = {
      x: ids.reduce((s, id) => s + selected.get(id).x, 0) / ids.length,
      y: ids.reduce((s, id) => s + selected.get(id).y, 0) / ids.length,
    };
    assert.deepEqual(
      computeBeanTargetPosition({ id: "bean" }, all, links, selected),
      expected,
    );
    assert.deepEqual(
      computeBeanTargetPosition({ id: "bean" }, new Map(), links, selected),
      expected,
    );
  }
});

test("actual simulation keeps combination clusters near their own targets and separates dense center beans", async () => {
  const {
    computeAnchorPositions,
    computeBeanTargetPosition,
    createBeanSimulation,
    constrainBeanPosition,
    anchorGeometry,
  } = await import("./networkLayout.js");
  for (const [width, height] of [
    [320, 340],
    [700, 540],
    [1400, 780],
  ]) {
    for (const dense of [false, true]) {
      const anchors = anchorsFor(3);
      const combinations = dense
        ? [["s0", "s1", "s2"]]
        : [
            ["s0", "s1", "s2"],
            ["s0", "s1"],
            ["s0", "s2"],
            ["s1", "s2"],
          ];
      const beans = Array.from({ length: 40 }, (_, i) => ({
        id: "b" + i,
        type: "bean",
        combination: combinations[i % combinations.length],
      }));
      const links = beans.flatMap((b) =>
        [...b.combination, "r0", "r1", "r2", "r3", "r4"].map((target) => ({
          source: b.id,
          target,
        })),
      );
      const positions = computeAnchorPositions(anchors, width, height, links);
      const selected = new Map(
        anchors
          .filter((n) => n.type === "center")
          .map((n) => [n.id, positions.get(n.id)]),
      );
      for (const n of anchors) {
        const p = positions.get(n.id);
        n.x = n.fx = p.x;
        n.y = n.fy = p.y;
      }
      for (const b of beans) {
        const p = computeBeanTargetPosition(b, positions, links, selected);
        b.x = b.targetX = p.x;
        b.y = b.targetY = p.y;
      }
      const sim = createBeanSimulation(
        [...anchors, ...beans],
        networkLayout(width, height),
      ).stop();
      for (let i = 0; i < 180; i++) {
        sim.tick();
        for (const b of beans)
          constrainBeanPosition(b, networkLayout(width, height));
      }
      for (const combo of combinations) {
        const group = beans.filter((b) => b.combination === combo);
        const mean = {
          x: group.reduce((s, b) => s + b.x, 0) / group.length,
          y: group.reduce((s, b) => s + b.y, 0) / group.length,
        };
        assert.ok(
          Math.hypot(mean.x - group[0].targetX, mean.y - group[0].targetY) < 18,
        );
      }
      const scale = anchorGeometry(width, height).scale;
      const minimum = Math.min(
        ...beans.flatMap((b, i) =>
          beans.slice(i + 1).map((c) => Math.hypot(b.x - c.x, b.y - c.y)),
        ),
      );
      assert.ok(
        minimum > 18 * scale,
        "beans should not overlap excessively: " + minimum,
      );
      for (const n of anchors)
        assert.deepEqual({ x: n.x, y: n.y }, positions.get(n.id));
    }
  }
});
