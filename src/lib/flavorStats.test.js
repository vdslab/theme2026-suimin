import assert from "node:assert/strict";
import test from "node:test";
import { buildFlavorIndex } from "./flavorData.js";
import { buildMatrix, matrixOrders, vsupColor } from "./flavorMatrix.js";
import {
  adviceFor,
  beanAttributes,
  flavorCharacter,
  normalizeRoast,
  shareBy,
  shareByOriginRoast,
  wilson,
} from "./flavorStats.js";
import { cutTree, reorder } from "./reorder.js";

test("roast levels fold into light / medium / dark", () => {
  assert.equal(normalizeRoast("Light-Medium"), "light");
  assert.equal(normalizeRoast("Medium"), "medium");
  assert.equal(normalizeRoast("Medium-Dark"), "dark");
  assert.equal(normalizeRoast(""), null);
  assert.equal(normalizeRoast(undefined), null);
});

test("wilson interval contains the estimate and stays in [0, 1]", () => {
  const [lo, hi] = wilson(3, 70);
  assert.ok(lo < 3 / 70 && 3 / 70 < hi);
  assert.deepEqual(wilson(0, 0), [0, 0]);
  assert.equal(wilson(0, 10)[0], 0);
});

const bean = (id, origin, roast, paths) => ({
  id,
  origin_country: origin,
  roast_level: roast,
  paths,
});
const choc = ["Nutty/Cocoa", "Cocoa", "Chocolate"];
const berry = ["Fruity", "Berry", "Blueberry"];

function sample() {
  const beans = [];
  for (let i = 0; i < 60; i++)
    beans.push(bean(`b${i}`, "Brazil", i < 30 ? "Dark" : "", [choc]));
  for (let i = 0; i < 60; i++)
    beans.push(
      bean(`e${i}`, "Ethiopia", i < 30 ? "Light" : "", [i < 40 ? berry : choc]),
    );
  beans.push(bean("x", "Peru", "Dark", [choc])); // under 50 beans: dropped
  return buildFlavorIndex({ beans, totalRows: 0, totalProducts: 0 });
}

test("shares count beans per origin and per roast, against the overall rate", () => {
  const data = sample();
  const attrs = beanAttributes(data.beans);
  assert.deepEqual(attrs.origins, ["Brazil", "Ethiopia"]);
  const node = data.nodes.get(JSON.stringify(berry));
  const origin = shareBy(data, attrs, node, "origin");
  assert.equal(origin.total, 120);
  assert.equal(origin.base, 40 / 120);
  const [brazil, ethiopia] = origin.rows;
  assert.equal(brazil.p, 0);
  assert.equal(ethiopia.k, 40);
  assert.equal(ethiopia.signal, "hi");
  assert.equal(brazil.signal, "lo");
  const roast = shareBy(data, attrs, node, "roast");
  assert.equal(roast.total, 61);
  assert.equal(roast.rows.find((r) => r.level === "light").k, 30);
  const cross = shareByOriginRoast(data, attrs, node);
  assert.equal(cross.rows[1].cells[0].t, 30);
});

test("advice names the strongest clear level for the flavor's character", () => {
  const data = sample();
  const attrs = beanAttributes(data.beans);
  const node = data.nodes.get(JSON.stringify(berry));
  const o = shareBy(data, attrs, node, "origin");
  const r = shareBy(data, attrs, node, "roast");
  const advice = adviceFor("origin", "ブルーベリー", o, r, (l) => l);
  assert.equal(advice.pick.level, "Ethiopia");
  assert.match(advice.text, /まずEthiopia（10袋中6\.7袋）/);
  assert.equal(adviceFor("weak", "りんご", o, r, (l) => l).pick, null);
});

test("character data covers the analysed flavors", () => {
  assert.equal(flavorCharacter(JSON.stringify(choc)).kind, "roast");
  assert.equal(flavorCharacter(JSON.stringify(["Nope"])), null);
});

test("optimal leaf order puts similar rows next to each other", () => {
  const v = [
    [1, 0, 0, 1],
    [0, 1, 1, 0],
    [0.9, 0.1, 0, 1],
    [0, 1, 0.9, 0.1],
    [1, 0.1, 0.1, 0.8],
  ];
  const { order, tree } = reorder(v);
  assert.equal(order.length, 5);
  assert.deepEqual([...order].sort(), [0, 1, 2, 3, 4]);
  const pos = (i) => order.indexOf(i);
  // the two groups {0,2,4} and {1,3} are contiguous
  const a = [0, 2, 4].map(pos).sort((x, y) => x - y);
  assert.equal(a[2] - a[0], 2);
  const groups = cutTree(tree, 2);
  assert.equal(groups.get(0), groups.get(2));
  assert.notEqual(groups.get(0), groups.get(1));
});

test("matrix cells and orders", () => {
  const data = sample();
  const attrs = beanAttributes(data.beans);
  const rows = [choc, berry].map((p) => data.nodes.get(JSON.stringify(p)));
  const m = buildMatrix(data, attrs, rows);
  assert.equal(m.cells[1][0].k, 0);
  assert.equal(m.cells[1][0].v, -2);
  const orders = matrixOrders(m);
  assert.deepEqual(orders.wheel.rows, [0, 1]);
  assert.match(vsupColor(1, 0), /^#[0-9a-f]{6}$/);
  assert.equal(vsupColor(1, 3), vsupColor(-1, 3));
});
