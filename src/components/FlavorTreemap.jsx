import { hierarchy, treemap } from "d3-hierarchy";
import { useEffect, useMemo, useState } from "react";
import { buildVisibleFlavorTree } from "../lib/buildVisibleFlavorTree";
import { flavorColor } from "../lib/flavorColors";
import { translateFlavor } from "../lib/flavorNames";

export default function FlavorTreemap({
  root,
  activeNode,
  expandedPaths,
  indexes,
  selectedCoffee,
  onSelectFlavor,
  onSelectCoffee,
}) {
  const [expandedCountry, setExpandedCountry] = useState(null);
  const [hoveredFlavor, setHoveredFlavor] = useState(null);
  const [hoveredCoffee, setHoveredCoffee] = useState(null);
  const [zoomPath, setZoomPath] = useState("");

  useEffect(() => {
    if (!activeNode.path) setZoomPath("");
  }, [activeNode.path]);

  const treeData = useMemo(
    () =>
      buildVisibleFlavorTree({
        root,
        activeNode,
        expandedPaths,
        indexes,
        expandedCountry,
      }),
    [root, activeNode, expandedPaths, indexes, expandedCountry],
  );

  const { nodes, zoomName } = useMemo(() => {
    const findPath = (node, path) => {
      if (node.path === path) return node;
      for (const child of node.children ?? []) {
        const found = findPath(child, path);
        if (found) return found;
      }
      return null;
    };
    const layoutData = zoomPath
      ? (findPath(treeData, zoomPath) ?? treeData)
      : treeData;
    const layoutRoot = hierarchy(layoutData)
      .sum((node) => {
        if (node.children?.length) return 0;
        return node.nodeType === "coffee" ? 1 : node.coffeeCount || 1;
      })
      .sort((a, b) => b.value - a.value);
    treemap()
      .size([1000, 620])
      .paddingOuter(5)
      .paddingInner(3)
      .paddingTop((node) => (node.depth > 0 && node.children ? 23 : 0))
      .round(true)(layoutRoot);
    return {
      nodes: layoutRoot.descendants().filter((node) => node.depth > 0),
      zoomName: zoomPath ? layoutData.name : "",
    };
  }, [treeData, zoomPath]);
  const hoveredIds = hoveredFlavor
    ? indexes.flavorToCoffeeIds.get(hoveredFlavor.path)
    : null;

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl border border-[#eadfce] bg-[#fffdf8]">
      <svg
        className="h-full w-full"
        viewBox="0 0 1000 620"
        role="img"
        aria-label="味の階層を表すツリーマップ"
      >
        <g key={zoomPath || "all"} className="treemap-zoom-enter">
          {nodes.map((node) => {
            const type = node.data.nodeType ?? "flavor";
            const isCoffee = type === "coffee";
            const width = node.x1 - node.x0;
            const height = node.y1 - node.y0;
            const count = node.data.coffeeCount ?? node.data.coffeeIds?.size;
            let topNode = node;
            while (topNode.parent && topNode.parent.depth > 0) {
              topNode = topNode.parent;
            }
            const topName = zoomName || topNode.data.name;
            const color = flavorColor(
              node.data.name,
              topName,
              node.data.depth ?? node.depth,
            );
            const inActivePath =
              type === "flavor" &&
              (node.data.path === activeNode.path ||
                activeNode.path.startsWith(`${node.data.path}/`));
            const dimCoffee =
              isCoffee && hoveredIds && !hoveredIds.has(node.data.coffee.id);
            const selected =
              isCoffee && selectedCoffee?.id === node.data.coffee.id;
            const label =
              type === "flavor"
                ? translateFlavor(node.data.name)
                : node.data.name;

            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: Interactive SVG groups cannot use HTML buttons.
              <g
                key={node.data.id}
                transform={`translate(${node.x0},${node.y0})`}
                opacity={dimCoffee ? 0.15 : 1}
                className="cursor-pointer transition-all duration-300"
                onMouseEnter={() => {
                  if (type === "flavor") setHoveredFlavor(node.data);
                  if (isCoffee) setHoveredCoffee(node.data.coffee);
                }}
                onMouseLeave={() => {
                  setHoveredFlavor(null);
                  setHoveredCoffee(null);
                }}
                onClick={() => {
                  if (type === "flavor") {
                    setExpandedCountry(null);
                    if (node.data.depth === 1) setZoomPath(node.data.path);
                    onSelectFlavor(node.data.path);
                  } else if (type === "country") {
                    setExpandedCountry(node.data.name);
                  } else if (isCoffee) onSelectCoffee(node.data.coffee);
                }}
              >
                <title>{`${label}${count != null ? ` — ${count} coffees` : ""}`}</title>
                <rect
                  width={Math.max(0, width)}
                  height={Math.max(0, height)}
                  rx={Math.min(8, width / 8, height / 8)}
                  fill={isCoffee ? "#6f4e37" : color}
                  fillOpacity={
                    isCoffee ? 0.85 : Math.max(0.18, 0.88 - node.depth * 0.15)
                  }
                  stroke={
                    selected ? "#f59e0b" : inActivePath ? "#493c32" : "#fffaf3"
                  }
                  strokeWidth={selected || inActivePath ? 4 : 1.5}
                />
                {width > 48 && height > 20 && (
                  <text
                    x="8"
                    y={node.children ? 16 : 15}
                    fontSize={node.depth <= 1 ? 13 : 11}
                    fontWeight={inActivePath || node.children ? 700 : 500}
                    fill={isCoffee ? "white" : "#3e3128"}
                    className="pointer-events-none"
                  >
                    {label.length > Math.max(5, Math.floor(width / 8))
                      ? `${label.slice(0, Math.max(4, Math.floor(width / 8) - 1))}…`
                      : label}
                    {count != null && width > 80 ? ` ${count}` : ""}
                  </text>
                )}
              </g>
            );
          })}
        </g>
        {hoveredCoffee && (
          <g className="pointer-events-none">
            <rect
              x="650"
              y="525"
              width="330"
              height="75"
              rx="12"
              fill="#fffaf3"
              stroke="#c06b42"
            />
            <text x="665" y="548" fontSize="12" fontWeight="700" fill="#493c32">
              {hoveredCoffee.title}
            </text>
            {(indexes.coffeeToFlavorPaths.get(hoveredCoffee.id) ?? [])
              .slice(0, 3)
              .map((path, index) => (
                <text
                  key={path}
                  x="665"
                  y={567 + index * 14}
                  fontSize="10"
                  fill="#7b442e"
                >
                  → {path.split("/").map(translateFlavor).join(" › ")}
                </text>
              ))}
          </g>
        )}
      </svg>
      {zoomName && (
        <div
          className="pointer-events-none absolute left-4 top-4 rounded-xl bg-white/90 px-4 py-2 text-lg font-bold shadow-sm"
          style={{ color: flavorColor(zoomName) }}
        >
          {translateFlavor(zoomName)}
        </div>
      )}
      <div className="absolute bottom-3 left-3 rounded-full bg-[#fffaf3]/95 px-3 py-1.5 text-xs text-[#6c5544] shadow-sm">
        面積は該当する豆の件数です。クリックすると内側の階層を展開します。
      </div>
    </div>
  );
}
