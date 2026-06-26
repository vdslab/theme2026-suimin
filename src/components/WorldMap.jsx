import { useState, useMemo, useRef } from "react";
import * as d3geo from "d3-geo";
import * as topojson from "topojson-client";
import { coffeeData } from "./CoffeeMap";
import { clusterColor, shortName, isNoise, clusterIndex } from "../lib/clusters";
import worldTopoJson from "../data/world-110m.json";

// Country centroids [longitude, latitude]
const countryCentroids = {
  "Brazil": [-51.9253, -14.2350],
  "China": [104.1954, 35.8617],
  "Colombia": [-74.2973, 4.5709],
  "Costa Rica": [-83.7534, 9.7489],
  "El Salvador": [-88.8965, 13.7942],
  "Ethiopia": [39.7823, 9.1450],
  "Guatemala": [-90.2308, 15.7835],
  "Haiti": [-72.2852, 18.9712],
  "Honduras": [-86.2419, 15.2000],
  "India": [78.9629, 20.5937],
  "Indonesia": [113.9213, -0.7893],
  "Kenya": [37.9062, -0.0236],
  "Laos": [102.4955, 19.8563],
  "Malawi": [34.3015, -13.2543],
  "Mexico": [-102.5528, 23.6345],
  "Myanmar": [95.9560, 21.9162],
  "Nicaragua": [-85.2072, 12.8654],
  "Peru": [-75.0152, -9.1900],
  "Philippines": [121.7740, 12.8797],
  "Taiwan": [120.9605, 23.6978],
  "Tanzania, United Republic Of": [34.8888, -6.3690],
  "Thailand": [100.9925, 15.8700],
  "Uganda": [32.2903, 1.3733],
  "United States": [-95.7129, 37.0902],
  "United States (Hawaii)": [-155.5828, 19.8968],
  "United States (Puerto Rico)": [-66.5901, 18.2208],
  "Vietnam": [108.2772, 14.0583]
};

// 凡例用クラスタリスト
const legendClusters = (() => {
  const set = new Set(coffeeData.map((d) => d.clusterName));
  return Array.from(set).sort((a, b) => {
    if (isNoise(a)) return 1;
    if (isNoise(b)) return -1;
    return (clusterIndex(a) ?? 0) - (clusterIndex(b) ?? 0);
  });
})();

// シード付き乱数
const pseudoRandom = (seed) => {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

export default function WorldMap({ selectedCoffee, onSelectCoffee, searchQuery, drankCoffees = {}, onUpdateDrank, onRemoveDrank, recommendedCoffee }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [activeCluster, setActiveCluster] = useState(null);
  const [popupNodeId, setPopupNodeId] = useState(null);
  const [sliderValue, setSliderValue] = useState(3);
  const containerRef = useRef(null);

  const width = 800;
  const height = 540;

  // 世界地図データ
  const geoFeatures = useMemo(() => {
    return topojson.feature(worldTopoJson, worldTopoJson.objects.countries).features;
  }, []);

  // Projection
  const projection = useMemo(() => {
    return d3geo.geoMercator()
      .scale(130)
      .translate([width / 2, height / 1.5]); // ちょっと上にシフト
  }, [width, height]);

  const pathGenerator = useMemo(() => {
    return d3geo.geoPath().projection(projection);
  }, [projection]);

  // コーヒーノードのジッター付き座標計算
  const nodePositions = useMemo(() => {
    const posMap = {};
    coffeeData.forEach(d => {
      const centroid = countryCentroids[d.country] || [0, 0];
      // ジッター: 最大4度のオフセット
      const radius = pseudoRandom(d.id * 13) * 4;
      const angle = pseudoRandom(d.id * 17) * Math.PI * 2;
      const lng = centroid[0] + Math.cos(angle) * radius;
      const lat = centroid[1] + Math.sin(angle) * radius;
      
      const [x, y] = projection([lng, lat]);
      posMap[d.id] = { x, y };
    });
    return posMap;
  }, [projection]);

  const filteredCoffeeData = useMemo(() => {
    const query = (searchQuery || "").trim().toLowerCase();
    if (!query) return coffeeData;
    return coffeeData.filter((coffee) => {
      const country = coffee.country?.toLowerCase() ?? "";
      const method = coffee.method?.toLowerCase() ?? "";
      const name = coffee.name?.toLowerCase() ?? "";
      const varieties = coffee.varieties?.join(" ").toLowerCase() ?? "";
      return country.includes(query) || method.includes(query) || name.includes(query) || varieties.includes(query);
    });
  }, [searchQuery]);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const toggleCluster = (name) => setActiveCluster((prev) => (prev === name ? null : name));

  const handleNodeClick = (e, node, isSelected) => {
    e.stopPropagation();
    onSelectCoffee(isSelected ? null : node);
    if (popupNodeId === node.id) {
      setPopupNodeId(null);
    } else {
      setPopupNodeId(node.id);
      setSliderValue(drankCoffees[node.id] ?? 3);
    }
  };

  return (
    <div className="flex flex-col gap-3 relative">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-base-content/70 mr-1">凡例:</span>
        {legendClusters.map((name) => {
          const color = clusterColor(name);
          const selected = activeCluster === name;
          const dimmed = activeCluster !== null && !selected;
          return (
            <button
              key={name}
              onClick={() => toggleCluster(name)}
              className={`badge gap-1.5 cursor-pointer border transition ${dimmed ? "opacity-30" : "hover:scale-105"}`}
              style={{ backgroundColor: selected ? color : "transparent", borderColor: color, color: selected ? "#fff" : color }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selected ? "#fff" : color }} />
              {shortName(name)}
            </button>
          );
        })}
        {activeCluster && <button onClick={() => setActiveCluster(null)} className="btn btn-ghost btn-xs">絞り込み解除</button>}
      </div>

      <div ref={containerRef} className="relative mx-auto w-full max-w-7xl aspect-[800/540] rounded-2xl border border-base-300 bg-[#e0f2fe] shadow-sm">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" width="100%" height="100%" className="absolute inset-0 select-none" onClick={() => { onSelectCoffee(null); setPopupNodeId(null); }}>
          
          {/* ベースマップ描画 */}
          <g className="countries">
            {geoFeatures.map((geo, i) => (
              <path key={`geo-${i}`} d={pathGenerator(geo)} fill="#cbd5e1" stroke="#f8fafc" strokeWidth={0.5} className="pointer-events-none" />
            ))}
          </g>

          {/* レコメンドアニメーション線 */}
          {recommendedCoffee && Object.entries(drankCoffees || {}).map(([id, score]) => {
            if (score === 3) return null;
            const drankNode = coffeeData.find((d) => d.id === Number(id));
            if (!drankNode) return null;
            
            const isLike = score > 3;
            const rPos = nodePositions[recommendedCoffee.id];
            const dPos = nodePositions[drankNode.id];
            if (!rPos || !dPos) return null;

            const x1 = isLike ? rPos.x : dPos.x;
            const y1 = isLike ? rPos.y : dPos.y;
            const x2 = isLike ? dPos.x : rPos.x;
            const y2 = isLike ? dPos.y : rPos.y;

            const strokeWidth = isLike ? (score === 5 ? 3 : 1.5) : (score === 1 ? 3 : 1.5);
            const strokeColor = isLike ? "#10b981" : "#ef4444";

            return (
              <line key={`line-${id}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray="8 8" opacity={0.6} className="animate-dash-forward pointer-events-none" />
            );
          })}

          {/* ノード描画 */}
          {filteredCoffeeData.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;
            const { x: cx, y: cy } = pos;

            const baseColor = clusterColor(node.clusterName);
            const isSelected = selectedCoffee?.id === node.id;
            const isHovered = hoveredNode?.id === node.id;
            const isRecommended = recommendedCoffee?.id === node.id;
            const hasDrank = drankCoffees[node.id] !== undefined;
            const filteredOut = activeCluster !== null && activeCluster !== node.clusterName;

            let opacity = 0.85;
            if (isNoise(node.clusterName)) opacity = 0.4;
            if (activeCluster !== null) opacity = filteredOut ? 0.1 : 0.95;

            const r = isSelected ? 11 : isHovered ? 9 : 5; // Scatter plot default is 6.5, making world map ones slightly smaller

            return (
              <g key={node.id} onClick={(e) => handleNodeClick(e, node, isSelected)} onMouseEnter={(e) => { setHoveredNode(node); handleMouseMove(e); }} onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredNode(null)} className="cursor-pointer">
                {isRecommended && (
                  <>
                    <circle cx={cx} cy={cy} r={r + 12} fill="#fef08a" opacity={0.6} className="animate-pulse pointer-events-none" />
                    <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke="#eab308" strokeWidth={2} strokeDasharray="4 2" className="pointer-events-none">
                      <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="4s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}
                
                {(isSelected || isHovered) && (
                  <circle cx={cx} cy={cy} r={r + 3.5} fill="none" stroke={isSelected ? "#1f2937" : baseColor} strokeWidth={isSelected ? 2 : 1.5} />
                )}
                
                <circle cx={cx} cy={cy} r={r} fill={node.blendedColor || baseColor} stroke={hasDrank ? "#111827" : "#fff"} strokeWidth={hasDrank ? 2 : 1} opacity={opacity} />
                
                {hasDrank && (
                  <path d={`M ${cx - 3} ${cy} L ${cx - 1} ${cy + 3} L ${cx + 4} ${cy - 2}`} fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none" />
                )}
              </g>
            );
          })}
        </svg>

        {popupNodeId && (() => {
          const pNode = coffeeData.find(n => n.id === popupNodeId);
          if (!pNode) return null;
          const pos = nodePositions[pNode.id];
          if (!pos) return null;
          
          return (
            <div className="absolute z-[60] -translate-x-1/2 -translate-y-[calc(100%+28px)] rounded-xl border border-base-300 bg-base-100 p-3 shadow-xl flex flex-col gap-2 min-w-[200px] animate-in fade-in slide-in-from-bottom-2" style={{ left: `${(pos.x / width) * 100}%`, top: `${(pos.y / height) * 100}%` }} onClick={(e) => e.stopPropagation()}>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-base-100 border-b border-r border-base-300 rotate-45"></div>
              <div className="flex justify-between items-center mb-1 relative z-10">
                <span className="font-bold text-sm text-base-content">好み度を入力</span>
                <button className="btn btn-ghost btn-xs btn-circle text-base-content/50 hover:text-base-content" onClick={() => setPopupNodeId(null)}>✕</button>
              </div>
              <div className="flex flex-col gap-1 relative z-10">
                <input type="range" min="1" max="5" value={sliderValue} onChange={e => setSliderValue(Number(e.target.value))} className="range range-xs range-primary" step="1" />
                <div className="w-full flex justify-between text-[10px] px-1 text-base-content/60 font-medium"><span>苦手</span><span>普通</span><span>好み</span></div>
              </div>
              
              {drankCoffees[pNode.id] !== undefined ? (
                <div className="flex gap-2 mt-2 relative z-10 w-full">
                  <button className="btn btn-sm btn-outline btn-error flex-1 px-1" onClick={() => { onRemoveDrank(pNode.id); setPopupNodeId(null); }}>選択解除</button>
                  <button className="btn btn-sm btn-primary flex-1 px-1" onClick={() => { onUpdateDrank(pNode.id, sliderValue); setPopupNodeId(null); }}>修正</button>
                </div>
              ) : (
                <button className="btn btn-sm btn-primary mt-2 relative z-10 w-full" onClick={() => { onUpdateDrank(pNode.id, sliderValue); setPopupNodeId(null); }}>飲んだ！</button>
              )}
            </div>
          );
        })()}

        {hoveredNode && !popupNodeId && (
          <div className="pointer-events-none absolute z-50 rounded-lg border border-base-300 bg-base-100 px-3 py-2 shadow-lg text-xs whitespace-nowrap" style={{ left: hoverPos.x + 12, top: hoverPos.y + 12, transform: hoverPos.x > (containerRef.current?.clientWidth ?? width) / 2 ? "translateX(-100%) translateX(-24px)" : "none" }}>
            <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ backgroundColor: clusterColor(hoveredNode.clusterName) }} />
            <span className="font-bold">{hoveredNode.country}</span>
            <span className="text-base-content/60"> / {hoveredNode.method}</span>
            <div className="text-base-content/60 mt-0.5">{shortName(hoveredNode.clusterName)}</div>
          </div>
        )}
      </div>
      <p className="text-xs text-base-content/50">点にカーソルを合わせると概要、クリックで好みを入力および詳細を表示します。</p>
    </div>
  );
}
