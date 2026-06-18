import { useState, useMemo, useRef } from "react";
import rawData from "../data/coffee_data.json";

// precompute_data.py と同じカラーパレット（クラスタ index 順）
const HEX_PALETTE = [
  "#EF553B", "#00CC96", "#AB63FA", "#FFA15A",
  "#19D3F3", "#FF6692", "#B6E880",
];
const NOISE_COLOR = "#9ca3af";

// "... (C3)" からクラスタ番号を取り出す
function clusterIndex(name) {
  const m = name && name.match(/\(C(\d+)\)/);
  return m ? parseInt(m[1], 10) : null;
}
function isNoise(name) {
  return !name || name.includes("ノイズ");
}
// クラスタの基準色（凡例・バッジ・枠線用）
function clusterColor(name) {
  if (isNoise(name)) return NOISE_COLOR;
  const i = clusterIndex(name);
  return i === null ? NOISE_COLOR : HEX_PALETTE[i % HEX_PALETTE.length];
}
// 凡例表示用に "(C3)" を取り除いた短い名前
function shortName(name) {
  if (isNoise(name)) return "ノイズ (独自路線)";
  return (name || "").replace(/\s*\(C\d+\)\s*$/, "");
}

// coffee_data.json は「産地 × 精製方法」で集約したノード。
// 表示・選択・ツールチップで使う形にマッピングする。
const coffeeData = rawData.map((item) => ({
  id: item.id,
  // DetailPanel / 選択判定が name を参照する。グループキー(産地×精製方法)で一意。
  name: `${item.country}・${item.method}`,
  country: item.country,
  method: item.method,
  varieties: item.varieties || [],
  sampleCount: item.sample_count,
  // 描画座標
  x: item.x,
  y: item.y,
  // クラスタ表示用
  blendedColor: item.color, // membershipブレンド色（ドットの塗り）
  clusterName: item.dominant_cluster,
  probs: item.probs || {},
  // ツールチップ用: 6軸の平均スコア
  aroma: item.scores_mean.Aroma,
  flavor: item.scores_mean.Flavor,
  aftertaste: item.scores_mean.Aftertaste,
  acidity: item.scores_mean.Acidity,
  body: item.scores_mean.Body,
  balance: item.scores_mean.Balance,
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

function CoffeeMap({ selectedCoffee, onSelectCoffee }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [activeCluster, setActiveCluster] = useState(null); // 凡例フィルター用（clusterName文字列）
  const containerRef = useRef(null);

  // 描画サイズ設定 (SVGの仮想座標系)
  const width = 800;
  const height = 540;
  const padding = 50;

  // データのUMAP座標の最小・最大値
  const bounds = useMemo(() => {
    let xMin = Infinity, xMax = -Infinity;
    let yMin = Infinity, yMax = -Infinity;

    coffeeData.forEach((d) => {
      if (d.x < xMin) xMin = d.x;
      if (d.x > xMax) xMax = d.x;
      if (d.y < yMin) yMin = d.y;
      if (d.y > yMax) yMax = d.y;
    });

    // 少し余白を持たせる
    const xRange = xMax - xMin;
    const yRange = yMax - yMin;
    return {
      xMin: xMin - xRange * 0.05,
      xMax: xMax + xRange * 0.05,
      yMin: yMin - yRange * 0.05,
      yMax: yMax + yRange * 0.05,
    };
  }, []);

  // 座標変換関数
  const xScale = (x) => {
    const ratio = (x - bounds.xMin) / (bounds.xMax - bounds.xMin);
    return padding + ratio * (width - padding * 2);
  };

  const yScale = (y) => {
    const ratio = (y - bounds.yMin) / (bounds.yMax - bounds.yMin);
    // Y軸は反転 (上が0)
    return height - padding - ratio * (height - padding * 2);
  };

  // マウスの動きに合わせてツールチップ位置を更新
  const handleMouseMove = (e) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setHoverPos({
        x: e.clientX - rect.left + 15,
        y: e.clientY - rect.top + 15,
      });
    }
  };

  // 凡例クリック時のフィルター切り替え
  const handleClusterClick = (clusterName) => {
    setActiveCluster((prev) => (prev === clusterName ? null : clusterName));
  };

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col h-[640px] rounded-2xl border border-base-300 bg-base-200 p-4 shadow-xl overflow-hidden"
    >
      {/* 凡例 & タイトル */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        <div className="text-sm font-semibold text-base-content/80">
          凡例（クリックでハイライト選択）:
        </div>
        <div className="flex flex-wrap gap-2">
          {legendClusters.map((clusterName) => {
            const color = clusterColor(clusterName);
            const isSelected = activeCluster === clusterName;
            const isDimmed = activeCluster !== null && !isSelected;
            return (
              <button
                key={clusterName}
                onClick={() => handleClusterClick(clusterName)}
                className={`badge badge-md cursor-pointer border transition-all duration-300 py-3 px-4 ${
                  isSelected
                    ? "scale-105 shadow-md font-bold text-white"
                    : isDimmed
                      ? "opacity-30"
                      : "hover:scale-105"
                }`}
                style={{
                  backgroundColor: isSelected ? color : "transparent",
                  borderColor: color,
                  color: isSelected ? "#ffffff" : color,
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full mr-2"
                  style={{ backgroundColor: isSelected ? "#ffffff" : color }}
                />
                {shortName(clusterName)}
              </button>
            );
          })}
        </div>
      </div>

      {/* メインのグラフ領域 */}
      <div className="flex-1 w-full bg-white rounded-xl relative overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="100%"
          className="select-none"
        >
          {/* 背景グリッド線 */}
          {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
            const x = padding + r * (width - padding * 2);
            const y = padding + r * (height - padding * 2);
            return (
              <g key={i}>
                {/* 縦グリッド */}
                <line
                  x1={x}
                  y1={padding}
                  x2={x}
                  y2={height - padding}
                  stroke="currentColor"
                  className="text-base-content/5"
                  strokeDasharray="4 4"
                />
                {/* 横グリッド */}
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="currentColor"
                  className="text-base-content/5"
                  strokeDasharray="4 4"
                />
              </g>
            );
          })}

          {/* プロット点の描画 */}
          {coffeeData.map((node) => {
            const baseColor = clusterColor(node.clusterName);
            const nodeIsNoise = isNoise(node.clusterName);
            const isSelected = selectedCoffee && selectedCoffee.name === node.name;
            const isClusterFiltered =
              activeCluster !== null && activeCluster !== node.clusterName;

            // 透明度の決定
            let opacity = 0.8;
            if (nodeIsNoise) opacity = 0.35;
            if (activeCluster !== null) {
              opacity = isClusterFiltered ? 0.12 : 0.95;
            } else if (selectedCoffee) {
              opacity = isSelected ? 1.0 : 0.2;
            }

            const cx = xScale(node.x);
            const cy = yScale(node.y);
            const r = isSelected ? 11 : hoveredNode?.id === node.id ? 9 : 6.5;

            return (
              <g
                key={node.id}
                onClick={() =>
                  onSelectCoffee(
                    selectedCoffee && selectedCoffee.id === node.id ? null : node
                  )
                }
                onMouseEnter={(e) => {
                  setHoveredNode(node);
                  handleMouseMove(e);
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer transition-all duration-300"
              >
                {/* 外枠（ホバー/選択時のハイライト用） */}
                {(isSelected || hoveredNode?.id === node.id) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r + 3.5}
                    fill="none"
                    stroke={isSelected ? "#ffffff" : baseColor}
                    strokeWidth={isSelected ? 2 : 1.5}
                    opacity={isSelected ? 1.0 : 0.6}
                  />
                )}
                {/* メインのドット（membershipブレンド色） */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={node.blendedColor || baseColor}
                  stroke={isSelected ? baseColor : "#ffffff"}
                  strokeWidth={isSelected ? 1.5 : 1}
                  opacity={opacity}
                  className="transition-all duration-300"
                />
              </g>
            );
          })}
        </svg>

        {/* ツールチップ（絶対配置） */}
        {hoveredNode && (
          <div
            className="absolute z-50 pointer-events-none w-72 rounded-xl border border-base-300 bg-base-100 p-4 shadow-2xl transition-all duration-100 overflow-y-auto max-h-[460px]"
            style={{
              left: `${hoverPos.x}px`,
              top: `${hoverPos.y}px`,
              // コンテナの端でツールチップがはみ出さないようにトランスフォーム
              transform:
                hoveredNode.x > (bounds.xMin + bounds.xMax) / 2
                  ? "translateX(-110%)"
                  : "none",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="badge badge-sm font-semibold border text-white py-2 px-2"
                style={{
                  backgroundColor: clusterColor(hoveredNode.clusterName),
                  borderColor: clusterColor(hoveredNode.clusterName),
                }}
              >
                {shortName(hoveredNode.clusterName)}
              </span>
            </div>

            <h3 className="text-base font-bold text-base-content leading-tight">
              {hoveredNode.country}
            </h3>
            <p className="text-xs text-base-content/60">
              製法: {hoveredNode.method}
            </p>
            <p className="text-xs text-base-content/60 mb-2">
              サンプル数: {hoveredNode.sampleCount} 件
            </p>

            {/* 品種一覧 */}
            {hoveredNode.varieties.length > 0 && (
              <div className="border-t border-base-300/40 pt-2 pb-2">
                <div className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider mb-1">
                  品種
                </div>
                <div className="flex flex-wrap gap-1">
                  {hoveredNode.varieties.map((v) => (
                    <span
                      key={v}
                      className="badge badge-ghost badge-xs font-normal"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* クラスタ所属確率 */}
            <div className="space-y-1.5 border-t border-base-300/40 pt-2 pb-2">
              <div className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider mb-1">
                クラスタ所属確率
              </div>
              {Object.entries(hoveredNode.probs)
                .filter(([, prob]) => prob >= 0.01)
                .sort(([, a], [, b]) => b - a)
                .map(([cName, prob]) => {
                  const displayName =
                    cName === "noise" ? "ノイズ (独自路線)" : shortName(cName);
                  const cColor =
                    cName === "noise" ? NOISE_COLOR : clusterColor(cName);
                  return (
                    <div key={cName} className="text-xs">
                      <div className="flex justify-between text-base-content/85 mb-0.5">
                        <span className="truncate max-w-[190px]">
                          {displayName}
                        </span>
                        <span className="font-semibold">
                          {(prob * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-base-300/40 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${prob * 100}%`,
                            backgroundColor: cColor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* 味パラメータ（グループ平均スコア） */}
            <div className="space-y-1.5 border-t border-base-300/40 pt-2">
              <div className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider mb-1">
                味覚評価 (グループ平均スコア)
              </div>
              {[
                { label: "香り (Aroma)", value: hoveredNode.aroma },
                { label: "風味 (Flavor)", value: hoveredNode.flavor },
                { label: "後味 (Aftertaste)", value: hoveredNode.aftertaste },
                { label: "酸味 (Acidity)", value: hoveredNode.acidity },
                { label: "コク (Body)", value: hoveredNode.body },
                { label: "調和 (Balance)", value: hoveredNode.balance },
              ].map((param) => (
                <div key={param.label} className="text-xs">
                  <div className="flex justify-between text-base-content/80 mb-0.5">
                    <span>{param.label}</span>
                    <span className="font-semibold">
                      {param.value.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-base-300/40 rounded-full h-1 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300 bg-base-content/30"
                      style={{
                        // 6.5〜8.5 を 0%〜100% としてスケーリング
                        width: `${Math.min(100, Math.max(0, ((param.value - 6.5) / 2.0) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CoffeeMap;
