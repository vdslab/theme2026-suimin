import { useState, useMemo, useRef } from "react";
import rawData from "../data/coffee_data.json";
import {
  clusterColor,
  shortName,
  isNoise,
  clusterIndex,
} from "../lib/clusters";

// coffee_data.json は「産地 × 精製方法」で集約したノード。表示用に整形する。
const coffeeData = rawData.map((item) => ({
  id: item.id,
  // DetailPanel / 選択判定が name を参照する。グループキー(産地×精製方法)で一意。
  name: `${item.country}・${item.method}`,
  country: item.country,
  method: item.method,
  varieties: item.varieties || [],
  sampleCount: item.sample_count,
  x: item.x,
  y: item.y,
  blendedColor: item.color, // membershipブレンド色（ドットの塗り）
  clusterName: item.dominant_cluster,
  probs: item.probs || {},
  scores: item.scores_mean, // { Aroma, Flavor, ... }
  deviation: item.deviation_mean, // { Aroma_dev, ... }
}));

// データに存在するクラスタ一覧（凡例用）。C番号順、ノイズは末尾。
const legendClusters = (() => {
  const set = new Set(coffeeData.map((d) => d.clusterName));
  return Array.from(set).sort((a, b) => {
    if (isNoise(a)) return 1;
    if (isNoise(b)) return -1;
    return (clusterIndex(a) ?? 0) - (clusterIndex(b) ?? 0);
  });
})();

function CoffeeMap({ selectedCoffee, onSelectCoffee, searchQuery }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [activeCluster, setActiveCluster] = useState(null); // 凡例フィルター（clusterName）
  const containerRef = useRef(null);

  const filteredCoffeeData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return coffeeData;

    return coffeeData.filter((coffee) => {
      const country = coffee.country?.toLowerCase() ?? "";
      const method = coffee.method?.toLowerCase() ?? "";
      const name = coffee.name?.toLowerCase() ?? "";
      const varieties = coffee.varieties?.join(" ").toLowerCase() ?? "";

      return (
        country.includes(query) ||
        method.includes(query) ||
        name.includes(query) ||
        varieties.includes(query)
      );
    });
  }, [searchQuery]);

  // SVG 仮想座標系
  const width = 800;
  const height = 540;
  const padding = 50;

  const bounds = useMemo(() => {
    const xs = coffeeData.map((d) => d.x);
    const ys = coffeeData.map((d) => d.y);
    const xMin = Math.min(...xs),
      xMax = Math.max(...xs);
    const yMin = Math.min(...ys),
      yMax = Math.max(...ys);
    const xPad = (xMax - xMin) * 0.05;
    const yPad = (yMax - yMin) * 0.05;
    return {
      xMin: xMin - xPad,
      xMax: xMax + xPad,
      yMin: yMin - yPad,
      yMax: yMax + yPad,
    };
  }, []);

  const xScale = (x) =>
    padding +
    ((x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * (width - padding * 2);
  // Y軸は反転（上が大きい値）
  const yScale = (y) =>
    height -
    padding -
    ((y - bounds.yMin) / (bounds.yMax - bounds.yMin)) * (height - padding * 2);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const toggleCluster = (name) =>
    setActiveCluster((prev) => (prev === name ? null : name));

  return (
    <div className="flex flex-col gap-3">
      {/* 凡例（クリックで絞り込み） */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-base-content/70 mr-1">
          凡例:
        </span>
        {legendClusters.map((name) => {
          const color = clusterColor(name);
          const selected = activeCluster === name;
          const dimmed = activeCluster !== null && !selected;
          return (
            <button
              key={name}
              onClick={() => toggleCluster(name)}
              className={`badge gap-1.5 cursor-pointer border transition ${
                dimmed ? "opacity-30" : "hover:scale-105"
              }`}
              style={{
                backgroundColor: selected ? color : "transparent",
                borderColor: color,
                color: selected ? "#fff" : color,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: selected ? "#fff" : color }}
              />
              {shortName(name)}
            </button>
          );
        })}
        {activeCluster && (
          <button
            onClick={() => setActiveCluster(null)}
            className="btn btn-ghost btn-xs"
          >
            絞り込み解除
          </button>
        )}
      </div>

      {/* マップ本体 */}
      <div
        ref={containerRef}
        className="relative mx-auto w-full max-w-7xl aspect-[800/540] rounded-2xl border border-base-300 bg-white shadow-sm overflow-hidden"
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          width="100%"
          height="100%"
          className="absolute inset-0 select-none"
          onClick={() => onSelectCoffee(null)}
        >
          {/* ノード */}
          {filteredCoffeeData.map((node) => {
            const baseColor = clusterColor(node.clusterName);
            const isSelected = selectedCoffee?.id === node.id;
            const isHovered = hoveredNode?.id === node.id;
            const filteredOut =
              activeCluster !== null && activeCluster !== node.clusterName;

            let opacity = 0.85;
            if (isNoise(node.clusterName)) opacity = 0.4;
            if (activeCluster !== null) opacity = filteredOut ? 0.1 : 0.95;
            else if (selectedCoffee) opacity = isSelected ? 1 : 0.25;

            const cx = xScale(node.x);
            const cy = yScale(node.y);
            const r = isSelected ? 11 : isHovered ? 9 : 6.5;

            return (
              <g
                key={node.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCoffee(isSelected ? null : node);
                }}
                onMouseEnter={(e) => {
                  setHoveredNode(node);
                  handleMouseMove(e);
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                {(isSelected || isHovered) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r + 3.5}
                    fill="none"
                    stroke={isSelected ? "#1f2937" : baseColor}
                    strokeWidth={isSelected ? 2 : 1.5}
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={node.blendedColor || baseColor}
                  stroke="#fff"
                  strokeWidth={1}
                  opacity={opacity}
                />
              </g>
            );
          })}
        </svg>

        {/* 軽量ホバーツールチップ（詳細は右パネル） */}
        {hoveredNode && (
          <div
            className="pointer-events-none absolute z-50 rounded-lg border border-base-300 bg-base-100 px-3 py-2 shadow-lg text-xs whitespace-nowrap"
            style={{
              left: hoverPos.x + 12,
              top: hoverPos.y + 12,
              transform:
                hoverPos.x > (containerRef.current?.clientWidth ?? width) / 2
                  ? "translateX(-100%) translateX(-24px)"
                  : "none",
            }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
              style={{ backgroundColor: clusterColor(hoveredNode.clusterName) }}
            />
            <span className="font-bold">{hoveredNode.country}</span>
            <span className="text-base-content/60">
              {" "}
              / {hoveredNode.method}
            </span>
            <div className="text-base-content/60 mt-0.5">
              {shortName(hoveredNode.clusterName)}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-base-content/50">
        点にカーソルを合わせると概要、クリックで右に詳細が表示されます。同じ色＝味の傾向が近いグループです。
      </p>
    </div>
  );
}

export default CoffeeMap;
