import { useState, useMemo, useRef } from "react";
import rawData from "../data/coffee_clusters.json";

// DetailPanel.jsx が selectedCoffee.name を参照するため、Label を name にマッピング
const coffeeData = rawData.map((item, index) => ({
  id: index,
  ...item,
  name: item.Label,
  country: item["Country.of.Origin"],
  method: item["Processing.Method"],
  aroma: item["Aroma"],
  flavor: item["Flavor"],
  aftertaste: item["Aftertaste"],
  acidity: item["Acidity"],
  body: item["Body"],
  balance: item["Balance"],
}));

// クラスタごとの配色と日本語名
const CLUSTERS = {
  aroma: {
    color: "#ec4899", // Pink
    name: "🌸 香り特化型",
    desc: "Aromaが特に際立っているコーヒー",
    badge: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800"
  },
  body: {
    color: "#b45309", // Amber
    name: "☕ ボディ・コク重視",
    desc: "しっかりとしたコクと口当たりが特徴",
    badge: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-850"
  },
  flavor: {
    color: "#d97706", // Orange/Yellow
    name: "🍋 風味・酸味際立ち",
    desc: "明るい酸味とフルーティな風味が特徴",
    badge: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-850"
  },
  mild: {
    color: "#10b981", // Emerald
    name: "⚖️ マイルド・調和型",
    desc: "全体のバランスが良くマイルドな味わい",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
  },
  noise: {
    color: "#9ca3af", // Gray
    name: "⚪ ノイズ (独自路線)",
    desc: "独自の風味プロファイルを持つ個性的な銘柄",
    badge: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
  }
};

function getClusterKey(clusterName) {
  if (clusterName.includes("香り")) return "aroma";
  if (clusterName.includes("ボディ") || clusterName.includes("コク")) return "body";
  if (clusterName.includes("風味") || clusterName.includes("酸味")) return "flavor";
  if (clusterName.includes("マイルド") || clusterName.includes("調和")) return "mild";
  return "noise";
}

function CoffeeMap({ selectedCoffee, onSelectCoffee }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [activeCluster, setActiveCluster] = useState(null); // 凡例フィルター用
  const containerRef = useRef(null);

  // 描画サイズ設定 (SVGの仮想座標系)
  const width = 800;
  const height = 540;
  const padding = 50;

  // データのUMAP座標の最小・最大値
  const bounds = useMemo(() => {
    let xMin = Infinity, xMax = -Infinity;
    let yMin = Infinity, yMax = -Infinity;
    
    coffeeData.forEach(d => {
      if (d.UMAP_X < xMin) xMin = d.UMAP_X;
      if (d.UMAP_X > xMax) xMax = d.UMAP_X;
      if (d.UMAP_Y < yMin) yMin = d.UMAP_Y;
      if (d.UMAP_Y > yMax) yMax = d.UMAP_Y;
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
        y: e.clientY - rect.top + 15
      });
    }
  };

  // 凡例クリック時のフィルター切り替え
  const handleClusterClick = (clusterKey) => {
    setActiveCluster(prev => prev === clusterKey ? null : clusterKey);
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
          {Object.entries(CLUSTERS).map(([key, cluster]) => {
            const isSelected = activeCluster === key;
            const isDimmed = activeCluster !== null && !isSelected;
            return (
              <button
                key={key}
                onClick={() => handleClusterClick(key)}
                className={`badge badge-md cursor-pointer border transition-all duration-300 py-3 px-4 ${
                  isSelected 
                    ? "scale-105 shadow-md font-bold text-white" 
                    : isDimmed 
                      ? "opacity-30" 
                      : "hover:scale-105"
                }`}
                style={{
                  backgroundColor: isSelected ? cluster.color : "transparent",
                  borderColor: cluster.color,
                  color: isSelected ? "#ffffff" : cluster.color
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: isSelected ? "#ffffff" : cluster.color }} />
                {cluster.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* メインのグラフ領域 */}
      <div className="flex-1 w-full bg-base-300/30 rounded-xl relative overflow-hidden">
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
            const clusterKey = getClusterKey(node.Cluster_Name);
            const isSelected = selectedCoffee && selectedCoffee.name === node.name;
            const isClusterFiltered = activeCluster !== null && activeCluster !== clusterKey;
            
            // 透明度の決定
            let opacity = 0.8;
            if (clusterKey === "noise") opacity = 0.35;
            if (activeCluster !== null) {
              opacity = isClusterFiltered ? 0.12 : 0.95;
            } else if (selectedCoffee) {
              opacity = isSelected ? 1.0 : 0.2;
            }

            const colorInfo = CLUSTERS[clusterKey];
            const cx = xScale(node.UMAP_X);
            const cy = yScale(node.UMAP_Y);
            const r = isSelected ? 11 : hoveredNode?.id === node.id ? 9 : 6.5;

            return (
              <g 
                key={node.id}
                onClick={() => onSelectCoffee(node)}
                onMouseEnter={(e) => {
                  setHoveredNode(node);
                  handleMouseMove(e);
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer transition-all duration-300"
              >
                {/* 選択中のパルス外輪 */}
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r + 8}
                    fill="none"
                    stroke={colorInfo.color}
                    strokeWidth={2}
                    className="animate-ping opacity-60"
                  />
                )}
                {/* 外枠（ホバー/選択時のハイライト用） */}
                {(isSelected || hoveredNode?.id === node.id) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r + 3.5}
                    fill="none"
                    stroke={isSelected ? "#ffffff" : colorInfo.color}
                    strokeWidth={isSelected ? 2 : 1.5}
                    opacity={isSelected ? 1.0 : 0.6}
                  />
                )}
                {/* メインのドット */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={colorInfo.color}
                  stroke={isSelected ? colorInfo.color : "#ffffff"}
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
            className="absolute z-50 pointer-events-none w-72 rounded-xl border border-base-300 bg-base-100 p-4 shadow-2xl transition-all duration-100"
            style={{
              left: `${hoverPos.x}px`,
              top: `${hoverPos.y}px`,
              // コンテナの端でツールチップがはみ出さないようにトランスフォーム
              transform: hoveredNode.UMAP_X > (bounds.xMin + bounds.xMax) / 2 ? 'translateX(-110%)' : 'none'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`badge badge-sm font-semibold border ${CLUSTERS[getClusterKey(hoveredNode.Cluster_Name)].badge}`}>
                {CLUSTERS[getClusterKey(hoveredNode.Cluster_Name)].name}
              </span>
            </div>
            
            <h3 className="text-base font-bold text-base-content leading-tight">
              {hoveredNode.country}
            </h3>
            <p className="text-xs text-base-content/60 mb-3">
              製法: {hoveredNode.method}
            </p>

            {/* 味パラメータのプログレスバー表示 */}
            <div className="space-y-1.5 border-t border-base-300/40 pt-2.5">
              {[
                { label: "香り (Aroma)", value: hoveredNode.aroma },
                { label: "風味 (Flavor)", value: hoveredNode.flavor },
                { label: "後味 (Aftertaste)", value: hoveredNode.aftertaste },
                { label: "酸味 (Acidity)", value: hoveredNode.acidity },
                { label: "コク (Body)", value: hoveredNode.body },
                { label: "調和 (Balance)", value: hoveredNode.balance },
              ].map((param) => (
                <div key={param.label} className="text-xs">
                  <div className="flex justify-between text-base-content/85 mb-0.5">
                    <span>{param.label}</span>
                    <span className="font-semibold">{param.value.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-base-300/40 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(0, ((param.value - 6.5) / 2.0) * 100))}%`, // 6.5〜8.5 を 0%〜100% としてスケーリング
                        backgroundColor: CLUSTERS[getClusterKey(hoveredNode.Cluster_Name)].color
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

