import React, { useState, useRef, useEffect, useMemo } from "react";

const CoffeeChart = ({
  nodes,
  clusters,
  selectedIds,
  recommendedIds,
  onNodeClick,
  hoveredNode,
  setHoveredNode,
}) => {
  const svgRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [activeClusters, setActiveClusters] = useState([]);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Reset viewport when data changes
  useEffect(() => {
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
    setActiveClusters([]);
  }, [nodes]);

  // Compute dataset bounds
  const bounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1, xRange: 1, yRange: 1 };
    const xCoords = nodes.map((n) => n.x);
    const yCoords = nodes.map((n) => n.y);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);
    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;
    return { minX, maxX, minY, maxY, xRange, yRange };
  }, [nodes]);

  // Viewport dimensions
  const width = 800;
  const height = 550;
  const padding = 50;

  // Base coordinates mapping (unzoomed)
  const getBaseCoords = (x, y) => {
    const normX = (x - bounds.minX) / bounds.xRange;
    const normY = (y - bounds.minY) / bounds.yRange;
    
    const svgX = padding + normX * (width - 2 * padding);
    const svgY = height - (padding + normY * (height - 2 * padding)); // Invert Y
    return { x: svgX, y: svgY };
  };

  // Zoomed coordinates mapping
  const getZoomCoords = (x, y) => {
    const base = getBaseCoords(x, y);
    return {
      x: base.x * scale + offsetX,
      y: base.y * scale + offsetY
    };
  };

  // Drag handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setOffsetX(e.clientX - dragStart.x);
      setOffsetY(e.clientY - dragStart.y);
    }

    if (hoveredNode && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left + 15,
        y: e.clientY - rect.top - 15,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom centered at cursor
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = 1.15;
    let nextScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;
    nextScale = Math.max(0.5, Math.min(nextScale, 15));
    
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const nextOffsetX = mouseX - (mouseX - offsetX) * (nextScale / scale);
      const nextOffsetY = mouseY - (mouseY - offsetY) * (nextScale / scale);

      setScale(nextScale);
      setOffsetX(nextOffsetX);
      setOffsetY(nextOffsetY);
    }
  };

  const handleHomeClick = () => {
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev * 1.2, 15));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev / 1.2, 0.5));
  };

  // Compute cluster background clouds
  const clusterClouds = useMemo(() => {
    const clouds = [];
    clusters.forEach((cluster) => {
      if (cluster.name === "ノイズ (独自路線)") return;

      const clusterNodes = nodes.filter((n) => n.dominant_cluster === cluster.name);
      if (clusterNodes.length < 2) return;

      // Center
      const sumX = clusterNodes.reduce((acc, n) => acc + n.x, 0);
      const sumY = clusterNodes.reduce((acc, n) => acc + n.y, 0);
      const centerX = sumX / clusterNodes.length;
      const centerY = sumY / clusterNodes.length;

      // Base Radius as maximum distance from center
      const maxDist = Math.max(
        ...clusterNodes.map((n) => Math.sqrt((n.x - centerX) ** 2 + (n.y - centerY) ** 2))
      );
      const baseRadius = maxDist || 1.0;

      // Project center to SVG zoomed coordinates
      const screenCenter = getZoomCoords(centerX, centerY);

      // Project right edge to calculate screen radius in pixels
      const screenRight = getZoomCoords(centerX + baseRadius, centerY);
      const screenRadius = Math.abs(screenRight.x - screenCenter.x) * 1.3 + 30; // 30px buffer

      clouds.push({
        name: cluster.name,
        cx: screenCenter.x,
        cy: screenCenter.y,
        r: screenRadius,
        color: cluster.color,
      });
    });
    return clouds;
  }, [nodes, clusters, scale, offsetX, offsetY]);

  const hasSelection = selectedIds.length > 0;
  const hasRecommendations = recommendedIds.length > 0;
  const hasActiveFilters = activeClusters.length > 0;

  const renderedNodes = useMemo(() => {
    return nodes.map((node) => {
      const isSelected = selectedIds.includes(node.id);
      const isRecommended = recommendedIds.includes(node.id);
      const matchesFilter = !hasActiveFilters || activeClusters.includes(node.dominant_cluster);
      
      const coords = getZoomCoords(node.x, node.y);

      let opacity = 0.85;
      if (hasActiveFilters && !matchesFilter) {
        opacity = 0.03;
      } else if (hasSelection || hasRecommendations) {
        if (isSelected) opacity = 1.0;
        else if (isRecommended) opacity = 1.0;
        else opacity = 0.15;
      }

      let radius = 6.5;
      if (isSelected) radius = 10;
      else if (isRecommended) radius = 9;
      else if (hoveredNode?.id === node.id) radius = 9;

      return {
        ...node,
        cx: coords.x,
        cy: coords.y,
        radius,
        opacity,
        isSelected,
        isRecommended,
        matchesFilter
      };
    });
  }, [nodes, scale, offsetX, offsetY, selectedIds, recommendedIds, activeClusters, hoveredNode]);

  // Toggle legend filter
  const handleLegendClick = (clusterName) => {
    setActiveClusters((prev) =>
      prev.includes(clusterName)
        ? prev.filter((c) => c !== clusterName)
        : [...prev, clusterName]
    );
  };

  // Helper to draw a star
  const drawStar = (cx, cy, r, color) => {
    // 5-pointed star coordinates
    return (
      <g>
        {/* White outline circle for contrast */}
        <circle cx={cx} cy={cy} r={r + 3} fill="#2C2520" stroke="#FFF" strokeWidth="1" />
        {/* Star path */}
        <path
          d={`M ${cx} ${cy - r} L ${cx + r * 0.22} ${cy - r * 0.3} L ${cx + r * 0.9} ${cy - r * 0.3} L ${cx + r * 0.35} ${cy + r * 0.1} L ${cx + r * 0.55} ${cy + r * 0.8} L ${cx} ${cy + r * 0.38} L ${cx - r * 0.55} ${cy + r * 0.8} L ${cx - r * 0.35} ${cy + r * 0.1} L ${cx - r * 0.9} ${cy - r * 0.3} L ${cx - r * 0.22} ${cy - r * 0.3} Z`}
          fill="#FFF"
          stroke="#FFF"
          strokeWidth="0.5"
          className="animate-star origin-center"
        />
      </g>
    );
  };

  return (
    <div className="relative w-full h-[550px] border border-brand-border rounded-3xl bg-white shadow-sm overflow-hidden flex flex-col select-none">
      
      {/* SVG Canvas with Grid background */}
      <div className="absolute inset-0 map-grid bg-white cursor-grab active:cursor-grabbing">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* SVG Blur Filter for Cluster Clouds */}
          <defs>
            <filter id="blur-filter" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="38" />
            </filter>
          </defs>

          {/* 1. Translucent cluster background blobs */}
          {clusterClouds.map((cloud) => (
            <circle
              key={cloud.name}
              cx={cloud.cx}
              cy={cloud.cy}
              r={cloud.r}
              fill={cloud.color}
              opacity="0.13"
              filter="url(#blur-filter)"
            />
          ))}

          {/* 2. Regular nodes (not selected or recommended) */}
          {renderedNodes
            .filter((n) => !n.isSelected && !n.isRecommended)
            .map((node) => (
              <circle
                key={node.id}
                cx={node.cx}
                cy={node.cy}
                r={node.radius}
                fill={node.color}
                opacity={node.opacity}
                className="transition-all duration-300 ease-out cursor-pointer stroke-white/60 hover:stroke-white hover:stroke-[2px] shadow-sm"
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => onNodeClick(node)}
              />
            ))}

          {/* 3. Recommended nodes (pulsing colored outer ring) */}
          {renderedNodes
            .filter((n) => n.isRecommended)
            .map((node) => (
              <g key={node.id} className="cursor-pointer" onClick={() => onNodeClick(node)}>
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.radius + 6}
                  fill="none"
                  stroke={node.color}
                  strokeWidth="2"
                  opacity={node.opacity * 0.6}
                  className="animate-pulse"
                />
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.radius}
                  fill={node.color}
                  opacity={node.opacity}
                  stroke="#FFF"
                  strokeWidth="2"
                  className="transition-all duration-300 ease-out hover:stroke-[3px]"
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                />
              </g>
            ))}

          {/* 4. Selected nodes (Star marker) */}
          {renderedNodes
            .filter((n) => n.isSelected)
            .map((node) => (
              <g
                key={node.id}
                className="cursor-pointer"
                onClick={() => onNodeClick(node)}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {drawStar(node.cx, node.cy, node.radius, node.color)}
              </g>
            ))}

          {/* Floating Tooltip inside SVG */}
          {hoveredNode && (
            <foreignObject
              x={tooltipPos.x}
              y={tooltipPos.y}
              width="220"
              height="160"
              className="pointer-events-none overflow-visible z-50"
            >
              <div className="p-3.5 bg-brand-text/95 backdrop-blur-md rounded-2xl shadow-xl text-[10px] text-white flex flex-col gap-1 w-[200px] font-sans">
                <div className="font-bold text-xs leading-tight">
                  {hoveredNode.label.split(" - ")[0]}
                </div>
                {hoveredNode.label.split(" - ")[1] && (
                  <div className="text-[9px] opacity-75 leading-tight mt-0.5">
                    品種: {hoveredNode.label.split(" - ")[1]}
                  </div>
                )}
                <div className="text-[9px] opacity-60 leading-none mt-0.5">
                  精製方法: {hoveredNode.method}
                </div>
                
                {hoveredNode.isSelected && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[9px] font-semibold text-[#D4A373]">
                    <span>★</span> あなたが飲んだ豆
                  </div>
                )}
              </div>
            </foreignObject>
          )}
        </svg>
      </div>

      {/* Floating Overlay 1: Cluster Legend (Top Left) */}
      <div className="absolute top-4 left-4 z-10 p-4 rounded-2xl bg-white/90 backdrop-blur-md border border-brand-border/60 shadow-sm max-w-[210px] text-left">
        <h4 className="text-[10px] font-bold text-brand-text/60 tracking-wider uppercase mb-2">
          クラスター（味わいの傾向）
        </h4>
        <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
          {clusters.map((cluster) => {
            const isActive = activeClusters.includes(cluster.name);
            const displayClusterName = cluster.name.split(" ")[1] || "その他";
            return (
              <button
                key={cluster.name}
                onClick={() => handleLegendClick(cluster.name)}
                className={`flex items-center gap-2 text-[11px] font-medium transition-all ${
                  isActive 
                    ? "opacity-30 line-through text-brand-text/40" 
                    : "text-brand-text/80 hover:text-brand-primary"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block shrink-0 border border-white/20"
                  style={{ backgroundColor: cluster.color }}
                ></span>
                <span className="truncate">{displayClusterName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Overlay 2: Instructions (Bottom Left) */}
      <div className="absolute bottom-4 left-4 z-10 p-3 rounded-2xl bg-white/80 backdrop-blur-md border border-brand-border/40 shadow-sm text-left max-w-[250px]">
        <h5 className="text-[10px] font-bold text-brand-text/80 mb-0.5">マップの見方</h5>
        <p className="text-[9px] text-brand-text/50 leading-relaxed">
          近い位置にある豆は、味わいの特徴が似ていることを表します
        </p>
      </div>

      {/* Floating Overlay 3: Controls Panel (Right Middle) */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1.5 p-1 rounded-2xl bg-white/90 backdrop-blur-md border border-brand-border/60 shadow-sm">
        <button
          onClick={handleHomeClick}
          className="btn btn-ghost btn-circle btn-xs h-7 w-7 min-h-0 text-brand-text/60 hover:text-brand-primary"
          title="初期位置"
        >
          🏠
        </button>
        <button
          onClick={handleHomeClick}
          className="btn btn-ghost btn-circle btn-xs h-7 w-7 min-h-0 text-brand-text/60 hover:text-brand-primary text-[10px] font-bold"
          title="全表示"
        >
          ⤢
        </button>
        <div className="w-4 h-[1px] bg-brand-border/60 mx-auto"></div>
        <button
          onClick={handleZoomIn}
          className="btn btn-ghost btn-circle btn-xs h-7 w-7 min-h-0 text-brand-text/60 hover:text-brand-primary font-bold text-sm"
          title="拡大"
        >
          ＋
        </button>
        <button
          onClick={handleZoomOut}
          className="btn btn-ghost btn-circle btn-xs h-7 w-7 min-h-0 text-brand-text/60 hover:text-brand-primary font-bold text-sm"
          title="縮小"
        >
          －
        </button>
        <div className="w-4 h-[1px] bg-brand-border/60 mx-auto"></div>
        <button
          onClick={handleHomeClick}
          className="btn btn-ghost btn-circle btn-xs h-7 w-7 min-h-0 text-brand-text/60 hover:text-brand-primary text-xs"
          title="リセット"
        >
          🎯
        </button>
      </div>
    </div>
  );
};

export default CoffeeChart;
