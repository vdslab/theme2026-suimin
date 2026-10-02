import { cluster, hierarchy } from "d3-hierarchy";
import { useMemo, useState } from "react";
import { buildCoffeeBranch } from "./CoffeeNodes";

const COLORS = [
  "#dc6b5d",
  "#b46fbd",
  "#de9f38",
  "#8a6f53",
  "#ca704d",
  "#7c6658",
  "#c89558",
  "#69a176",
  "#708aa7",
];
const polar = (angle, radius) => {
  const a = angle - Math.PI / 2;
  return [Math.cos(a) * radius, Math.sin(a) * radius];
};
const curve = (source, target) => {
  const [sx, sy] = polar(source.x, source.y);
  const [tx, ty] = polar(target.x, target.y);
  const mid = (source.y + target.y) / 2;
  const [s2x, s2y] = polar(source.x, mid);
  const [t2x, t2y] = polar(target.x, mid);
  return `M${sx},${sy} C${s2x},${s2y} ${t2x},${t2y} ${tx},${ty}`;
};

export default function FlavorHierarchy({
  focusNode,
  indexes,
  selectedCoffee,
  onSelectFlavor,
  onSelectCoffee,
}) {
  const [expandedCountry, setExpandedCountry] = useState(null);
  const [hoveredFlavor, setHoveredFlavor] = useState(null);
  const [hoveredCoffee, setHoveredCoffee] = useState(null);

  const treeData = useMemo(
    () => buildCoffeeBranch(focusNode, indexes, expandedCountry) ?? focusNode,
    [focusNode, indexes, expandedCountry],
  );
  const { nodes, links } = useMemo(() => {
    const root = hierarchy(treeData);
    const maxDepth = Math.max(root.height, 1);
    const r = maxDepth >= 4 ? 265 : maxDepth === 3 ? 245 : 205;
    cluster().size([Math.PI * 2, r])(root);
    // Put the focused item at the center, even when d3.cluster gives a leaf a radius.
    root.y = 0;
    return { nodes: root.descendants(), links: root.links() };
  }, [treeData]);

  const topColor = (node) => {
    let cursor = node;
    while (cursor.depth > 1) cursor = cursor.parent;
    return COLORS[
      (cursor.parent?.children.indexOf(cursor) ?? 0) % COLORS.length
    ];
  };
  const hoveredIds = hoveredFlavor
    ? indexes.flavorToCoffeeIds.get(hoveredFlavor.path)
    : null;
  const coffeePosition = hoveredCoffee
    ? nodes.find((node) => node.data.coffee?.id === hoveredCoffee.id)
    : null;
  const hoverNotes = hoveredCoffee
    ? (indexes.coffeeToFlavorPaths.get(hoveredCoffee.id) ?? []).map((path) => ({
        path,
        name: path.split("/").at(-1),
      }))
    : [];
  const expandedCount = expandedCountry
    ? nodes.find(
        (node) =>
          node.data.nodeType === "country" &&
          node.data.name === expandedCountry,
      )?.data.coffeeCount
    : 0;

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl border border-[#eadfce] bg-[#fffdf8]">
      <svg
        className="h-full w-full"
        viewBox="-360 -330 720 660"
        role="img"
        aria-label="味の階層を表す放射状ツリー"
      >
        <g className="transition-opacity">
          {links.map((link) => (
            <path
              key={`${link.source.data.id}-${link.target.data.id}`}
              d={curve(link.source, link.target)}
              fill="none"
              stroke={topColor(link.target)}
              strokeOpacity="0.28"
              strokeWidth={link.target.data.nodeType === "coffee" ? 0.7 : 1.2}
            />
          ))}
        </g>
        {nodes.map((node) => {
          const [x, y] = polar(node.x, node.y);
          const type = node.data.nodeType ?? "flavor";
          const isCoffee = type === "coffee";
          const dimCoffee =
            isCoffee && hoveredIds && !hoveredIds.has(node.data.coffee.id);
          const selected =
            isCoffee && selectedCoffee?.id === node.data.coffee.id;
          const count = node.data.coffeeCount ?? node.data.coffeeIds?.size;
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: SVG tree nodes cannot use HTML buttons.
            <g
              key={node.data.id}
              transform={`translate(${x},${y})`}
              opacity={dimCoffee ? 0.16 : 1}
              className="cursor-pointer transition-opacity duration-200"
              onMouseEnter={() => {
                if (type === "flavor") setHoveredFlavor(node.data);
                if (isCoffee) setHoveredCoffee(node.data.coffee);
              }}
              onMouseLeave={() => {
                setHoveredFlavor(null);
                setHoveredCoffee(null);
              }}
              onClick={() => {
                if (type === "flavor" && node.data.path !== focusNode.path) {
                  setExpandedCountry(null);
                  onSelectFlavor(node.data.path);
                } else if (type === "country")
                  setExpandedCountry(node.data.name);
                else if (isCoffee) onSelectCoffee(node.data.coffee);
              }}
            >
              <title>{`${node.data.name}${count != null ? ` — ${count} coffees` : ""}`}</title>
              <circle
                r={
                  isCoffee
                    ? selected
                      ? 6
                      : 3.4
                    : type === "country"
                      ? 7
                      : Math.min(11, 4 + Math.sqrt(count ?? 1))
                }
                fill={
                  isCoffee
                    ? "#6f4e37"
                    : type === "country"
                      ? "#f7f0e6"
                      : topColor(node)
                }
                stroke={
                  selected
                    ? "#f59e0b"
                    : type === "country"
                      ? topColor(node)
                      : "#fffdf8"
                }
                strokeWidth={selected ? 3 : 1.5}
              />
              {!isCoffee && (
                <text
                  x={node.x < Math.PI ? 10 : -10}
                  dy="0.32em"
                  textAnchor={node.x < Math.PI ? "start" : "end"}
                  transform={node.x >= Math.PI ? "rotate(180)" : undefined}
                  fontSize={node.depth === 0 ? 13 : 10}
                  fontWeight={node.depth <= 1 ? 700 : 500}
                  fill="#493c32"
                >
                  {node.data.name} {count != null ? count : ""}
                </text>
              )}
            </g>
          );
        })}
        {coffeePosition &&
          hoverNotes.map((note, index) => {
            const [sx, sy] = polar(coffeePosition.x, coffeePosition.y);
            const angle =
              (index / Math.max(hoverNotes.length, 1)) * Math.PI * 2;
            const ex = sx + Math.cos(angle) * 70;
            const ey = sy + Math.sin(angle) * 70;
            return (
              <g key={note.path} className="pointer-events-none">
                <path
                  d={`M${sx},${sy} Q${(sx + ex) / 2 + 10},${(sy + ey) / 2 + 10} ${ex},${ey}`}
                  fill="none"
                  stroke="#c06b42"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <circle cx={ex} cy={ey} r="3" fill="#c06b42" />
                <text
                  x={ex + (ex >= sx ? 6 : -6)}
                  y={ey + 3}
                  textAnchor={ex >= sx ? "start" : "end"}
                  fontSize="9"
                  fontWeight="700"
                  fill="#7b442e"
                >
                  {note.name}
                </text>
              </g>
            );
          })}
        <circle r="3" fill="#6f4e37" />
      </svg>
      {focusNode.children.length === 0 && !expandedCountry && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[#f4eadc]/95 px-4 py-2 text-xs text-[#6c5544] shadow-sm">
          国をクリックすると、その国の豆を展開します
        </div>
      )}
      {expandedCountry && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[#f4eadc]/95 px-4 py-2 text-xs text-[#6c5544] shadow-sm">
          豆に触れると tasting note、クリックすると詳細を表示
          {expandedCount > 80 &&
            `（負荷を抑えるため ${expandedCount} 件中 80 件）`}
        </div>
      )}
    </div>
  );
}
