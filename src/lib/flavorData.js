import { csvParse } from "d3-dsv";
import { getFlavorColor } from "./flavorColorUtils.js";

export const MAX_BEANS = 40;
export const MAX_FLAVORS = 10;
export const pathId = (parts) => JSON.stringify(parts);
export const parseFlavorPaths = (value = "") => [
  ...new Map(
    value
      .split(";")
      .map((tag) =>
        tag
          .split(">")
          .map((p) => p.trim())
          .filter(Boolean),
      )
      .filter((p) => p.length)
      .map((p) => [pathId(p), p]),
  ).values(),
];

export function buildFlavorData(csv) {
  const rows = csvParse(csv.replace(/^\uFEFF/, ""));
  const products = new Map();
  rows.forEach((row, index) => {
    const id = JSON.stringify([
      row.source_roaster,
      row.product_id || `row-${index}`,
    ]);
    const paths = parseFlavorPaths(row.tasting_notes_sca_nodes);
    const existing = products.get(id);
    if (existing) {
      existing.paths = [
        ...new Map(
          [...existing.paths, ...paths].map((p) => [pathId(p), p]),
        ).values(),
      ];
      existing.confidence = Math.max(
        existing.confidence,
        Number(row.tasting_notes_confidence) || 0,
      );
    } else
      products.set(id, {
        ...row,
        id,
        paths,
        confidence: Number(row.tasting_notes_confidence) || 0,
      });
  });
  const beans = [...products.values()].filter((b) => b.paths.length);
  const root = {
    id: pathId([]),
    name: "すべての味",
    path: [],
    beanIds: new Set(),
    children: [],
  };
  const nodes = new Map([[root.id, root]]);
  for (const bean of beans) {
    root.beanIds.add(bean.id);
    for (const path of bean.paths) {
      let parent = root;
      path.forEach((name, index) => {
        const parts = path.slice(0, index + 1);
        const id = pathId(parts);
        let node = nodes.get(id);
        if (!node) {
          node = {
            id,
            name,
            path: parts,
            beanIds: new Set(),
            children: [],
            directIds: new Set(),
          };
          nodes.set(id, node);
          parent.children.push(node);
        }
        node.beanIds.add(bean.id);
        if (index === path.length - 1) node.directIds.add(bean.id);
        parent = node;
      });
    }
  }
  const color = getFlavorColor;
  // D3 sums one per leaf tag; displayed unique bean counts stay independent.
  for (const node of nodes.values()) node.weight = node.children.length ? 0 : 1;
  const initial = [...nodes.values()]
    .filter((n) => !n.children.length)
    .sort((a, b) => b.beanIds.size - a.beanIds.size)[0];
  return {
    root,
    nodes,
    beans,
    color,
    totalRows: rows.length,
    totalProducts: products.size,
    initialId: initial?.id,
  };
}

export const isFlavorPrefix = (a, b) =>
  a.length <= b.length && a.every((v, i) => b[i] === v);
export function toggleFlavorSelection(data, ids, id) {
  if (ids.includes(id)) return ids.filter((v) => v !== id);
  const node = data.nodes.get(id);
  if (!node?.path.length) return ids;
  const rest = ids.filter((v) => {
    const p = data.nodes.get(v).path;
    return !isFlavorPrefix(p, node.path) && !isFlavorPrefix(node.path, p);
  });
  return rest.length < 3 ? [...rest, id] : ids;
}

export function buildFlavorNetwork(data, selectedIds, allThree = false) {
  const selectedFlavors = [];
  for (const id of Array.isArray(selectedIds) ? selectedIds : [selectedIds]) {
    const n = data.nodes.get(id);
    if (
      n &&
      !selectedFlavors.some(
        (v) => isFlavorPrefix(v.path, n.path) || isFlavorPrefix(n.path, v.path),
      )
    )
      selectedFlavors.push(n);
    if (selectedFlavors.length === 3) break;
  }
  const threshold =
    selectedFlavors.length === 3 ? (allThree ? 3 : 2) : selectedFlavors.length;
  const matchedBeans = selectedFlavors.length
    ? data.beans
        .map((bean) => ({
          ...bean,
          selectedCount: selectedFlavors.length,
          matchCount: selectedFlavors.filter((n) => n.beanIds.has(bean.id))
            .length,
        }))
        .filter((b) => b.matchCount >= threshold)
        .sort(
          (a, b) =>
            b.matchCount - a.matchCount ||
            b.confidence - a.confidence ||
            a.id.localeCompare(b.id),
        )
    : [];
  const beans = matchedBeans.slice(0, MAX_BEANS);
  const counts = new Map();
  for (const bean of beans) {
    const seen = new Set(
      bean.paths
        .filter(
          (p) =>
            !selectedFlavors.some(
              (n) => isFlavorPrefix(n.path, p) || isFlavorPrefix(p, n.path),
            ),
        )
        .map(pathId),
    );
    for (const id of seen) counts.set(id, (counts.get(id) || 0) + 1);
  }
  const flavors = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_FLAVORS);
  const nodes = [
    ...selectedFlavors.map((flavor, i) => ({
      id: i === 0 ? "selected" : `selected:${flavor.id}`,
      type: "center",
      flavor,
      count: matchedBeans.filter((b) => flavor.beanIds.has(b.id)).length,
    })),
    ...flavors.map(([id, count]) => ({
      id,
      type: "flavor",
      flavor: data.nodes.get(id),
      count,
    })),
    ...beans.map((bean) => ({ id: `bean:${bean.id}`, type: "bean", bean })),
  ];
  const links = beans.flatMap((bean) =>
    nodes
      .filter((n) => n.type !== "bean" && n.flavor.beanIds.has(bean.id))
      .map((n) => ({
        source: `bean:${bean.id}`,
        target: n.id,
        selected: n.type === "center",
      })),
  );
  return {
    selected: selectedFlavors[0],
    selectedFlavors,
    matchedBeans,
    matchedCount: matchedBeans.length,
    cooccurrenceCount: counts.size,
    beans,
    nodes,
    links,
  };
}
