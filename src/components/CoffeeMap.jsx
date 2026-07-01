import { useMemo, useRef, useState } from "react";
import rawData from "../data/coffee_data.json";
import {
  clusterColor,
  clusterIndex,
  isNoise,
  shortName,
} from "../lib/clusters";
import { toJapaneseCountryName } from "../utils/countryName";

// coffee_data.json は「産地 × 精製方法」で集約したノード。表示用に整形する。
export const coffeeData = rawData.map((item) => {
  const countryJa = toJapaneseCountryName(item.country);

  return {
    id: item.id,
    // DetailPanel / 選択判定が name を参照する。グループキー(産地×精製方法)で一意。
    name: `${countryJa}・${item.method}`,
    country: item.country,
    countryJa,
    method: item.method,
    varieties: item.varieties || [],
    sampleCount: item.sample_count,
    x: item.x,
    y: item.y,
    blendedColor: item.color,
    clusterName: item.dominant_cluster,
    probs: item.probs || {},
    scores: item.scores_mean,
    deviation: item.deviation_mean,
  };
});
// データに存在するクラスタ一覧（凡例用）。C番号順、ノイズは末尾。
const legendClusters = (() => {
  const set = new Set(coffeeData.map((d) => d.clusterName));
  return Array.from(set).sort((a, b) => {
    if (isNoise(a)) return 1;
    if (isNoise(b)) return -1;
    return (clusterIndex(a) ?? 0) - (clusterIndex(b) ?? 0);
  });
})();

function CoffeeMap({
  selectedCoffee,
  onSelectCoffee,
  searchQuery,
  drankCoffees = {},
  onUpdateDrank,
  onRemoveDrank,
  recommendedCoffee,
}) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [activeCluster, setActiveCluster] = useState(null); // 凡例フィルター（clusterName）
  const [popupNodeId, setPopupNodeId] = useState(null);
  const [sliderValue, setSliderValue] = useState(3);
  const containerRef = useRef(null);

  const filteredCoffeeData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return coffeeData;

    return coffeeData.filter((coffee) => {
      const country = coffee.country?.toLowerCase() ?? "";
      const countryJa = coffee.countryJa?.toLowerCase() ?? "";
      const method = coffee.method?.toLowerCase() ?? "";
      const name = coffee.name?.toLowerCase() ?? "";
      const varieties = coffee.varieties?.join(" ").toLowerCase() ?? "";

      return (
        country.includes(query) ||
        countryJa.includes(query) ||
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

  const handleNodeClick = (e, node, isSelected) => {
    e.stopPropagation();
    onSelectCoffee(isSelected ? null : node);

    // Toggle popup
    if (popupNodeId === node.id) {
      setPopupNodeId(null);
    } else {
      setPopupNodeId(node.id);
      setSliderValue(drankCoffees[node.id] ?? 3);
    }
  };

  return (
    <div className="flex flex-col gap-3 relative">
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
              type="button"
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
            type="button"
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
        className="relative mx-auto w-full max-w-7xl aspect-[800/540] rounded-2xl border border-base-300 bg-white shadow-sm"
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          width="100%"
          height="100%"
          className="absolute inset-0 select-none"
          aria-label="コーヒー豆 味覚マップ"
          onClick={() => {
            onSelectCoffee(null);
            setPopupNodeId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onSelectCoffee(null);
              setPopupNodeId(null);
            }
          }}
        >
          <title>コーヒー豆 味覚マップ</title>
          {/* レコメンドアニメーションの線 */}
          {recommendedCoffee &&
            Object.entries(drankCoffees || {}).map(([id, score]) => {
              if (score === 3) return null; // 普通の場合は線を省略

              const drankNode = coffeeData.find((d) => d.id === Number(id));
              if (!drankNode) return null;

              const isLike = score > 3;
              const rX = xScale(recommendedCoffee.x);
              const rY = yScale(recommendedCoffee.y);
              const dX = xScale(drankNode.x);
              const dY = yScale(drankNode.y);

              // 引力(Like)なら おすすめ → 飲んだ豆
              // 斥力(Dislike)なら 飲んだ豆 → おすすめ
              const x1 = isLike ? rX : dX;
              const y1 = isLike ? rY : dY;
              const x2 = isLike ? dX : rX;
              const y2 = isLike ? dY : rY;

              const strokeWidth = isLike
                ? score === 5
                  ? 3
                  : 1.5
                : score === 1
                  ? 3
                  : 1.5;
              const strokeColor = isLike ? "#10b981" : "#ef4444"; // emerald-500 : red-500

              return (
                <line
                  key={`line-${id}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray="8 8"
                  opacity={0.6}
                  className="animate-dash-forward pointer-events-none"
                />
              );
            })}

          {/* ノード */}
          {filteredCoffeeData.map((node) => {
            const baseColor = clusterColor(node.clusterName);
            const isSelected = selectedCoffee?.id === node.id;
            const isHovered = hoveredNode?.id === node.id;
            const isRecommended = recommendedCoffee?.id === node.id;
            const hasDrank = drankCoffees[node.id] !== undefined;
            const filteredOut =
              activeCluster !== null && activeCluster !== node.clusterName;

            let opacity = 0.85;
            if (isNoise(node.clusterName)) opacity = 0.4;
            if (activeCluster !== null) opacity = filteredOut ? 0.1 : 0.95;

            const cx = xScale(node.x);
            const cy = yScale(node.y);
            const r = isSelected ? 11 : isHovered ? 9 : 6.5;

            return (
              // biome-ignore lint/a11y/useSemanticElements: SVG context — <button> cannot be nested inside <svg>
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={node.name}
                onClick={(e) => handleNodeClick(e, node, isSelected)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleNodeClick(e, node, isSelected);
                  }
                }}
                onMouseEnter={(e) => {
                  setHoveredNode(node);
                  handleMouseMove(e);
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                {/* レコメンド強調ハイライト */}
                {isRecommended && (
                  <>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r + 12}
                      fill="#fef08a"
                      opacity={0.6}
                      className="animate-pulse pointer-events-none"
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r + 6}
                      fill="none"
                      stroke="#eab308"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                      className="pointer-events-none"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from={`0 ${cx} ${cy}`}
                        to={`360 ${cx} ${cy}`}
                        dur="4s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </>
                )}

                {/* 選択・ホバー時のリング */}
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
                  stroke={hasDrank ? "#111827" : "#fff"}
                  strokeWidth={hasDrank ? 2 : 1}
                  opacity={opacity}
                />

                {/* 飲んだマーク（チェック） */}
                {hasDrank && (
                  <path
                    d={`M ${cx - 3} ${cy} L ${cx - 1} ${cy + 3} L ${cx + 4} ${cy - 2}`}
                    fill="none"
                    stroke="#fff"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="pointer-events-none"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* スライダーポップアップ */}
        {popupNodeId &&
          (() => {
            const pNode = coffeeData.find((n) => n.id === popupNodeId);
            if (!pNode) return null;
            const px = xScale(pNode.x);
            const py = yScale(pNode.y);

            return (
              <div
                role="dialog"
                aria-label="好み度を入力"
                className="absolute z-[60] -translate-x-1/2 -translate-y-[calc(100%+28px)] rounded-xl border border-base-300 bg-base-100 p-3 shadow-xl flex flex-col gap-2 min-w-[200px] animate-in fade-in slide-in-from-bottom-2"
                style={{
                  left: `${(px / width) * 100}%`,
                  top: `${(py / height) * 100}%`,
                }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-base-100 border-b border-r border-base-300 rotate-45"></div>

                <div className="flex justify-between items-center mb-1 relative z-10">
                  <span className="font-bold text-sm text-base-content">
                    好み度を入力
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-circle text-base-content/50 hover:text-base-content"
                    onClick={() => setPopupNodeId(null)}
                  >
                    ✕
                  </button>
                </div>

                <div className="flex flex-col gap-1 relative z-10">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={sliderValue}
                    onChange={(e) => setSliderValue(Number(e.target.value))}
                    className="range range-xs range-primary"
                    step="1"
                  />
                  <div className="w-full flex justify-between text-[10px] px-1 text-base-content/60 font-medium">
                    <span>苦手</span>
                    <span>普通</span>
                    <span>好み</span>
                  </div>
                </div>

                {drankCoffees[pNode.id] !== undefined ? (
                  <div className="flex gap-2 mt-2 relative z-10 w-full">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline btn-error flex-1 px-1"
                      onClick={() => {
                        onRemoveDrank(pNode.id);
                        setPopupNodeId(null);
                      }}
                    >
                      選択解除
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary flex-1 px-1"
                      onClick={() => {
                        onUpdateDrank(pNode.id, sliderValue);
                        setPopupNodeId(null);
                      }}
                    >
                      修正
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary mt-2 relative z-10 w-full"
                    onClick={() => {
                      onUpdateDrank(pNode.id, sliderValue);
                      setPopupNodeId(null);
                    }}
                  >
                    飲んだ！
                  </button>
                )}
              </div>
            );
          })()}

        {/* 軽量ホバーツールチップ（詳細は右パネル） */}
        {hoveredNode && !popupNodeId && (
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
            <span className="font-bold">
              {hoveredNode.countryJa || hoveredNode.country}
            </span>
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
        点にカーソルを合わせると概要、クリックで好みを入力および詳細を表示します。
      </p>
    </div>
  );
}

export default CoffeeMap;
