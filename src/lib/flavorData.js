import { csvParse } from "d3-dsv";
import { getFlavorColor } from "./flavorColorUtils.js";

export const MAX_BEANS = 100;
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

export function buildFlavorNetwork(data, selectedId) {
  const selected = data.nodes.get(selectedId);
  if (!selected) return null;
  const matched = data.beans.filter((b) => selected.beanIds.has(b.id));
  const counts = new Map();
  for (const bean of matched)
    for (const path of bean.paths) {
      // Descendant tags belong to the selected family, rather than co-occurring flavors.
      if (selected.path.every((part, i) => path[i] === part)) continue;
      const id = pathId(path);
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  const flavors = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_FLAVORS);
  const beans = [...matched]
    .sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id))
    .slice(0, MAX_BEANS);
  const nodes = [
    { id: "selected", type: "center", flavor: selected, count: matched.length },
    ...flavors.map(([id, count]) => ({
      id,
      type: "flavor",
      flavor: data.nodes.get(id),
      count,
    })),
    ...beans.map((bean) => ({ id: `bean:${bean.id}`, type: "bean", bean })),
  ];
  const allowed = new Set(flavors.map(([id]) => id));
  const links = beans.flatMap((bean) => [
    { source: `bean:${bean.id}`, target: "selected" },
    ...bean.paths
      .filter((p) => allowed.has(pathId(p)))
      .map((p) => ({ source: `bean:${bean.id}`, target: pathId(p) })),
  ]);
  return {
    selected,
    matchedCount: matched.length,
    cooccurrenceCount: counts.size,
    beans,
    nodes,
    links,
  };
}
