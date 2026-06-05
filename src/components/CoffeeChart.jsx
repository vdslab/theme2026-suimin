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
  const [activeClusters, setActiveClusters] = useState([]); // Empty = show all
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Reset filters and viewport when node dataset changes
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

  // Fixed SVG viewport dimensions
  const width = 800;
  const height = 550;
  const padding = 40;

  // Map data coordinates to base SVG viewport coordinates (unzoomed)
  const getBaseCoords = (x, y) => {
    const normX = (x - bounds.minX) / bounds.xRange;
    const normY = (y - bounds.minY) / bounds.yRange;
    
    // Fit into width and height with padding
    const svgX = padding + normX * (width - 2 * padding);
    const svgY = height - (padding + normY * (height - 2 * padding)); // Invert Y for screen space
    return { x: svgX, y: svgY };
  };

  // Map data coordinates to current zoomed/panned SVG coordinates
  const getZoomCoords = (x, y) => {
    const base = getBaseCoords(x, y);
    return {
      x: base.x * scale + offsetX,
      y: base.y * scale + offsetY
    };
  };

  // Pan handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only left click drag
    setIsDragging(true);
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setOffsetX(e.clientX - dragStart.x);
      setOffsetY(e.clientY - dragStart.y);
    }

    // Update tooltip position if hovering
    if (hoveredNode && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      // Offset tooltip a bit to the top right of cursor
      setTooltipPos({
        x: e.clientX - rect.left + 15,
        y: e.clientY - rect.top - 15,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom handler (centered at cursor)
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = 1.15;
    let nextScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;
    
    // Limits
    nextScale = Math.max(0.6, Math.min(nextScale, 15));
    
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Keep coordinates under cursor stable
      const nextOffsetX = mouseX - (mouseX - offsetX) * (nextScale / scale);
      const nextOffsetY = mouseY - (mouseY - offsetY) * (nextScale / scale);

      setScale(nextScale);
      setOffsetX(nextOffsetX);
      setOffsetY(nextOffsetY);
    }
  };

  // Double click reset
  const handleDoubleClick = () => {
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
  };

  // Toggle cluster filter
  const handleLegendClick = (clusterName) => {
    setActiveClusters((prev) => {
      if (prev.includes(clusterName)) {
        // If it's already selected, remove it
        const next = prev.filter((c) => c !== clusterName);
        return next;
      } else {
        // Add to active filters
        return [...prev, clusterName];
      }
    });
  };

  const clearLegendFilters = () => {
    setActiveClusters([]);
  };

  // Determine visibility and opacity for nodes
  const hasSelection = selectedIds.length > 0;
  const hasRecommendations = recommendedIds.length > 0;
  const hasActiveFilters = activeClusters.length > 0;

  const renderedNodes = useMemo(() => {
    return nodes.map((node) => {
      const isSelected = selectedIds.includes(node.id);
      const isRecommended = recommendedIds.includes(node.id);
      
      // Check cluster filter
      const matchesFilter = !hasActiveFilters || activeClusters.includes(node.dominant_cluster);
      
      // Base coordinates
      const coords = getZoomCoords(node.x, node.y);

      // Determine opacity
      let opacity = 0.85;
      if (hasActiveFilters && !matchesFilter) {
        opacity = 0.05;
      } else if (hasSelection || hasRecommendations) {
        if (isSelected) opacity = 1.0;
        else if (isRecommended) opacity = 1.0;
        else opacity = 0.15; // fade out others
      }

      // Determine size
      let radius = 7.5;
      if (isSelected) radius = 11;
      else if (isRecommended) radius = 10;
      else if (hoveredNode?.id === node.id) radius = 10;

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

  return (
    <div className="flex flex-col gap-3 w-full h-full bg-base-100/50 backdrop-blur-md border border-base-200 p-4 rounded-3xl shadow-xl">
      <div className="flex justify-between items-center px-1">
        <div>
          <h3 className="text-md font-bold text-base-content/90 flex items-center gap-2">
            ☕ フレーバーマップ (2D UMAP)
          </h3>
          <p className="text-[10px] text-base-content/50">
            近い位置にある豆ほど風味が似ています。ドラッグで移動、スクロールで拡大、ダブルクリックでリセット。
          </p>
        </div>
        <div className="flex gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearLegendFilters}
              className="btn btn-ghost btn-xs text-[10px] py-0 h-6 min-h-0 text-primary"
            >
              フィルター解除
            </button>
          )}
          <button
            onClick={handleDoubleClick}
            className="btn btn-outline btn-xs text-[10px] py-0 h-6 min-h-0 opacity-70 hover:opacity-100"
          >
            表示位置リセット
          </button>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="relative w-full border border-base-200 rounded-2xl bg-base-300/10 overflow-hidden shadow-inner cursor-grab active:cursor-grabbing">
        <svg
          ref={svgRef}
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
          className="select-none"
        >
          {/* Subtle Grid Background */}
          <defs>
            <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.03)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
          </defs>
          <rect width={width} height={height} fill="url(#bgGlow)" />

          {/* Background clusters outlines or lines could go here */}

          {/* Render regular/non-highlighted nodes first */}
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
                className="transition-all duration-300 ease-out cursor-pointer stroke-white/40 hover:stroke-white hover:stroke-[2px]"
                onMouseEnter={(e) => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => onNodeClick(node)}
              />
            ))}

          {/* Render recommended nodes next (glow ring + circle) */}
          {renderedNodes
            .filter((n) => n.isRecommended)
            .map((node) => (
              <g key={node.id} className="cursor-pointer" onClick={() => onNodeClick(node)}>
                {/* Glowing ring animation */}
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.radius + 6}
                  fill="none"
                  stroke={node.color}
                  strokeWidth="2.5"
                  opacity={node.opacity * 0.75}
                  className="animate-pulse"
                />
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.radius}
                  fill={node.color}
                  opacity={node.opacity}
                  stroke="#fff"
                  strokeWidth="2.5"
                  className="transition-all duration-300 ease-out hover:stroke-[3.5px] shadow-lg"
                  onMouseEnter={(e) => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                />
              </g>
            ))}

          {/* Render selected nodes on top (gold star/marker or thick white ring) */}
          {renderedNodes
            .filter((n) => n.isSelected)
            .map((node) => (
              <g key={node.id} className="cursor-pointer" onClick={() => onNodeClick(node)}>
                {/* Double bold ring for selected items */}
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.radius + 5}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.5"
                  opacity={node.opacity}
                />
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.radius + 2}
                  fill="none"
                  stroke={node.color}
                  strokeWidth="2"
                  opacity={node.opacity}
                />
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.radius}
                  fill={node.color}
                  opacity={node.opacity}
                  stroke="#fff"
                  strokeWidth="2.5"
                  onMouseEnter={(e) => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                />
              </g>
            ))}

          {/* Interactive Floating Tooltip inside SVG */}
          {hoveredNode && (
            <foreignObject
              x={tooltipPos.x}
              y={tooltipPos.y}
              width="240"
              height="180"
              className="pointer-events-none overflow-visible z-50"
            >
              <div className="p-3 bg-base-100/95 backdrop-blur-md border border-base-200/80 rounded-2xl shadow-2xl text-[10px] text-base-content flex flex-col gap-1.5 w-[230px] font-sans transition-opacity duration-200">
                <div className="flex justify-between items-start gap-1">
                  <span className="font-bold text-xs leading-tight text-base-content/90">
                    {hoveredNode.label}
                  </span>
                  <span
                    className="badge text-[8px] px-1.5 py-0 h-4 leading-none font-bold border-none"
                    style={{
                      backgroundColor: hoveredNode.color,
                      color: "#fff",
                      textShadow: "0px 1px 2px rgba(0,0,0,0.2)",
                    }}
                  >
                    {hoveredNode.dominant_cluster.split(" ")[1] || "ノイズ"}
                  </span>
                </div>
                
                {hoveredNode.varieties && hoveredNode.varieties.length > 0 && (
                  <div className="text-[9px] text-base-content/60 leading-tight">
                    <span className="font-semibold">品種:</span> {hoveredNode.varieties.join(", ")}
                  </div>
                )}
                
                <div className="divider my-0 opacity-20"></div>
                
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px]">
                  <div>🌸 香り: <span className="font-bold">{hoveredNode.taste.Aroma.toFixed(2)}</span></div>
                  <div>🍋 酸味: <span className="font-bold">{hoveredNode.taste.Acidity.toFixed(2)}</span></div>
                  <div>☕ コク: <span className="font-bold">{hoveredNode.taste.Body.toFixed(2)}</span></div>
                  <div>🌿 風味: <span className="font-bold">{hoveredNode.taste.Flavor.toFixed(2)}</span></div>
                  <div>🍃 後味: <span className="font-bold">{hoveredNode.taste.Aftertaste.toFixed(2)}</span></div>
                  <div>⚖️ 均整: <span className="font-bold">{hoveredNode.taste.Balance.toFixed(2)}</span></div>
                </div>

                <div className="divider my-0 opacity-20"></div>

                <div className="text-[8px] opacity-75">
                  <span className="font-semibold text-primary">最大確率:</span>{" "}
                  {hoveredNode.dominant_cluster}: {hoveredNode.max_prob.toFixed(1)}%
                </div>
              </div>
            </foreignObject>
          )}
        </svg>
      </div>

      {/* Cluster Legends Panel */}
      <div className="flex flex-wrap gap-2 px-1 justify-center">
        {clusters.map((cluster) => {
          const isActive = activeClusters.includes(cluster.name);
          const isFilterActive = activeClusters.length > 0;
          return (
            <button
              key={cluster.name}
              onClick={() => handleLegendClick(cluster.name)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold border transition-all shadow-sm ${
                isActive
                  ? "bg-primary/10 border-primary text-primary"
                  : isFilterActive
                  ? "bg-base-200/40 border-base-200/50 opacity-40 text-base-content/40 hover:opacity-75"
                  : "bg-base-200/70 border-base-300/80 hover:bg-base-200 hover:border-base-400 text-base-content/80"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block border border-white/20"
                style={{ backgroundColor: cluster.color }}
              ></span>
              <span>
                {cluster.name}
                <span className="font-normal opacity-70">
                  {cluster.description.split("：")[1]}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CoffeeChart;
