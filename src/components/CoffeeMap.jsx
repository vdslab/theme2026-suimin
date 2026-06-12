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

// googlecolab_testcode.py のカラーパレット順に合わせた基準色をマッピング
const HEX_PALETTE = ['#EF553B', '#00CC96', '#AB63FA', '#FFA15A', '#19D3F3', '#FF6692', '#B6E880'];

function getClusterColor(clusterName) {
  if (!clusterName || clusterName.includes("ノイズ")) {
    return "lightgrey";
  }
  // "🌸 香り特化型 (C0)" などの文字列からクラスタ番号(例: 0)を抽出
  const match = clusterName.match(/\(C(\d+)\)/);
  if (match) {
    const idx = parseInt(match[1], 10);
    return HEX_PALETTE[idx % HEX_PALETTE.length];
  }
  
  // フォールバック
  if (clusterName.includes("香り")) return "#EF553B";
  if (clusterName.includes("ボディ") || clusterName.includes("コク")) return "#00CC96";
  if (clusterName.includes("風味") || clusterName.includes("酸味")) return "#AB63FA";
  if (clusterName.includes("マイルド") || clusterName.includes("調和")) return "#FFA15A";
  return "lightgrey";
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

  // ユニークなクラスタリスト（凡例用、googlecolab_testcode.pyと同様にソート）
  const uniqueClustersInData = useMemo(() => {
    const set = new Set();
    coffeeData.forEach(d => set.add(d.Cluster_Name));
    return Array.from(set).sort((a, b) => {
      if (a.includes("ノイズ")) return 1;
      if (b.includes("ノイズ")) return -1;
      return a.localeCompare(b);
    });
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative flex flex-col h-[640px] rounded-2xl border border-base-300 bg-base-200 p-4 shadow-xl"
    >
      {/* 凡例 & タイトル */}
      <div className="flex flex-col gap-2 mb-3">
        <div className="text-sm font-semibold text-base-content/80">
          凡例（クリックでハイライト選択）:
        </div>
        <div className="flex flex-wrap gap-2">
          {uniqueClustersInData.map((cName) => {
            const isSelected = activeCluster === cName;
            const isDimmed = activeCluster !== null && !isSelected;
            const cColor = getClusterColor(cName);
            
            return (
              <button
                key={cName}
                onClick={() => handleClusterClick(cName)}
                className={`badge badge-md cursor-pointer border transition-all duration-300 py-3 px-3 ${
                  isSelected 
                    ? "scale-105 shadow-md font-bold text-white" 
                    : isDimmed 
                      ? "opacity-30" 
                      : "hover:scale-105"
                }`}
                style={{
                  backgroundColor: isSelected ? cColor : "transparent",
                  borderColor: cColor,
                  color: isSelected ? "#ffffff" : cColor
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: isSelected ? "#ffffff" : cColor }} />
                {cName}
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
            const isSelected = selectedCoffee && selectedCoffee.name === node.name;
            const isClusterFiltered = activeCluster !== null && activeCluster !== node.Cluster_Name;
            
            // 透明度の決定
            let opacity = 0.85;
            if (node.Cluster_Name.includes("ノイズ")) opacity = 0.45;
            if (activeCluster !== null) {
              opacity = isClusterFiltered ? 0.12 : 0.95;
            } else if (selectedCoffee) {
              opacity = isSelected ? 1.0 : 0.2;
            }

            const baseColor = getClusterColor(node.Cluster_Name);
            const cx = xScale(node.UMAP_X);
            const cy = yScale(node.UMAP_Y);
            const r = isSelected ? 11 : hoveredNode?.id === node.id ? 9 : 6.5;

            return (
              <g 
                key={node.id}
                onClick={() => {
                  if (selectedCoffee && selectedCoffee.id === node.id) {
                    onSelectCoffee(null);
                  } else {
                    onSelectCoffee(node);
                  }
                }}
                onMouseEnter={(e) => {
                  setHoveredNode(node);
                  handleMouseMove(e);
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer transition-all duration-300"
              >
                {/* 外枠（ホバー/選択時のハイライト用） - アニメーション(ping)は削除 */}
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
                {/* メインのドット (ブレンドカラー表示) */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={node.Blended_Color || baseColor}
                  stroke={isSelected ? baseColor : "#ffffff"}
                  strokeWidth={isSelected ? 1.5 : 1}
                  opacity={opacity}
                  className="transition-all duration-300"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* ツールチップ（絶対配置） */}
      {hoveredNode && (
        <div 
          className="absolute z-50 pointer-events-none w-72 rounded-xl border border-base-300 bg-base-100 p-4 shadow-2xl transition-all duration-100 overflow-y-auto max-h-[460px]"
          style={{
            left: `${hoverPos.x}px`,
            top: `${hoverPos.y}px`,
            // コンテナの端でツールチップがはみ出さないようにトランスフォーム
            transform: hoveredNode.UMAP_X > (bounds.xMin + bounds.xMax) / 2 ? 'translateX(-110%)' : 'none'
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span 
              className="badge badge-sm font-semibold border text-white py-2 px-2"
              style={{ 
                backgroundColor: getClusterColor(hoveredNode.Cluster_Name),
                borderColor: getClusterColor(hoveredNode.Cluster_Name)
              }}
            >
              主要: {hoveredNode.Cluster_Name.split(" ")[0]}
            </span>
          </div>
          
          <h3 className="text-base font-bold text-base-content leading-tight">
            {hoveredNode.country}
          </h3>
          <p className="text-xs text-base-content/60 mb-2">
            製法: {hoveredNode.method}
          </p>

          {/* クラスタ所属確率のパーセント表示 */}
          <div className="space-y-1.5 border-t border-base-300/40 pt-2 pb-2">
            <div className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider mb-1">
              クラスタ所属確率
            </div>
            {Object.entries(hoveredNode.Probs || {}).map(([cName, prob]) => {
              if (prob < 0.01) return null; // 1%未満は表示しない
              const isNoise = cName === 'noise';
              const displayName = isNoise ? 'ノイズ (独自路線)' : cName;
              const cColor = getClusterColor(cName);
              
              return (
                <div key={cName} className="text-xs">
                  <div className="flex justify-between text-base-content/85 mb-0.5">
                    <span className="truncate max-w-[190px]">{displayName}</span>
                    <span className="font-semibold">{(prob * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-base-300/40 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${prob * 100}%`,
                        backgroundColor: cColor
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 味パラメータ表示 */}
          <div className="space-y-1.5 border-t border-base-300/40 pt-2">
            <div className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider mb-1">
              味覚評価 (平均スコア)
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
                  <span className="font-semibold">{param.value.toFixed(2)}</span>
                </div>
                <div className="w-full bg-base-300/40 rounded-full h-1 overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-300 bg-base-content/30"
                    style={{
                      width: `${Math.min(100, Math.max(0, ((param.value - 6.5) / 2.0) * 100))}%`, // 6.5〜8.5 を 0%〜100% としてスケーリング
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CoffeeMap;


