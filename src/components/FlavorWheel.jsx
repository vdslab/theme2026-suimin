import * as d3Hierarchy from "d3-hierarchy";
import * as d3Shape from "d3-shape";
import { ChevronRight, RotateCcw, Sparkles } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

export default function FlavorWheel({
  flavorTree,
  beans = [],
  selectedFlavor,
  onSelectFlavor,
  onSelectCoffee,
  languageMode = "both", // "both" | "ja" | "en"
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 680, height: 680 });
  const [currentFocus, setCurrentFocus] = useState(null); // Node object
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredBeanId, setHoveredBeanId] = useState(null);
  const [hoveredDot, setHoveredDot] = useState(null);

  // Resize observer for responsive SVG sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      const { width, height } = containerRef.current.getBoundingClientRect();
      const size = Math.max(340, Math.min(width, height, 760));
      setDimensions({ width: size, height: size });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute D3 hierarchy partition
  const root = useMemo(() => {
    if (!flavorTree) return null;
    const hierarchy = d3Hierarchy
      .hierarchy(flavorTree)
      .sum((d) => (d.children ? 0 : d.value || 1))
      .sort((a, b) => (b.value || 1) - (a.value || 1));

    const radius = Math.min(dimensions.width, dimensions.height) / 2 - 12;
    const partition = d3Hierarchy.partition().size([2 * Math.PI, radius]);
    return partition(hierarchy);
  }, [flavorTree, dimensions]);

  // Set initial focus to root
  useEffect(() => {
    if (root && !currentFocus) {
      setCurrentFocus(root);
    }
  }, [root, currentFocus]);

  // Sync with selectedFlavor prop if triggered externally
  useEffect(() => {
    if (!root) return;
    if (!selectedFlavor) {
      if (currentFocus !== root) setCurrentFocus(root);
      return;
    }
    // Find matching node in hierarchy
    let found = null;
    root.each((d) => {
      if (d.data.path === selectedFlavor.path) {
        found = d;
      }
    });
    if (found && found !== currentFocus) {
      setCurrentFocus(found);
    }
  }, [selectedFlavor, root, currentFocus]);

  // Handle slice click (zoom in / select)
  const handleSliceClick = (node, e) => {
    if (e) e.stopPropagation();
    if (!node) return;

    setCurrentFocus(node);
    if (node.depth === 0) {
      onSelectFlavor(null);
    } else {
      onSelectFlavor(node.data);
    }
  };

  // Handle center circle click (zoom out / reset)
  const handleCenterClick = (e) => {
    if (e) e.stopPropagation();
    if (!currentFocus || currentFocus.depth === 0) {
      onSelectFlavor(null);
      return;
    }
    const parent = currentFocus.parent || root;
    setCurrentFocus(parent);
    if (parent.depth === 0) {
      onSelectFlavor(null);
    } else {
      onSelectFlavor(parent.data);
    }
  };

  // Radii calculation
  const maxAvailableRadius =
    Math.min(dimensions.width, dimensions.height) / 2 - 12;
  // Wheel takes ~58% of radius, leaving 24px clear gap for connection lines, plus outer dots and labels
  const sunburstOuterRadius = maxAvailableRadius * 0.58;
  const innerRadiusBase = sunburstOuterRadius * 0.22;
  const dotBaseRadius = sunburstOuterRadius + 24;

  // Transform angle according to current focus
  const toAngle = React.useCallback(
    (x) => {
      if (!currentFocus) return x;
      return Math.max(
        0,
        Math.min(
          2 * Math.PI,
          ((x - currentFocus.x0) / (currentFocus.x1 - currentFocus.x0)) *
            2 *
            Math.PI,
        ),
      );
    },
    [currentFocus],
  );

  // D3 arc generator for sunburst slices
  const arcGenerator = d3Shape
    .arc()
    .startAngle((d) => toAngle(d.x0))
    .endAngle((d) => toAngle(d.x1))
    .innerRadius((d) => {
      if (!currentFocus) return Math.max(0, d.y0);
      const focusDepth = currentFocus.depth;
      const depthDiff = d.depth - focusDepth;
      if (depthDiff <= 0) return 0;
      const visibleLevels = Math.max(1, 3 - focusDepth);
      const step = (sunburstOuterRadius - innerRadiusBase) / visibleLevels;
      return innerRadiusBase + (depthDiff - 1) * step;
    })
    .outerRadius((d) => {
      if (!currentFocus) return Math.max(0, d.y1);
      const focusDepth = currentFocus.depth;
      const depthDiff = d.depth - focusDepth;
      if (depthDiff < 0) return 0;
      const visibleLevels = Math.max(1, 3 - focusDepth);
      const step = (sunburstOuterRadius - innerRadiusBase) / visibleLevels;
      return innerRadiusBase + depthDiff * step - 2;
    })
    .padAngle(0.006)
    .cornerRadius(3);

  // Nodes to display (descendants of current focus or direct tree)
  const visibleNodes = useMemo(() => {
    if (!root || !currentFocus) return [];
    return root.descendants().filter((d) => {
      if (d.depth === 0) return false;
      let curr = d;
      let isDescendant = false;
      while (curr) {
        if (curr === currentFocus) {
          isDescendant = true;
          break;
        }
        curr = curr.parent;
      }
      if (!isDescendant) return false;

      const angle = (d.x1 - d.x0) / (currentFocus.x1 - currentFocus.x0);
      return angle > 0.002;
    });
  }, [root, currentFocus]);

  // Compute active tag paths for the hovered bean
  // (used to dim non-belonging sunburst slices when a dot is hovered)
  const activeTagPaths = useMemo(() => {
    if (!hoveredBeanId) return new Set();
    const bean = beans.find((b) => b.id === hoveredBeanId);
    if (!bean) return new Set();

    const paths = new Set();
    for (const note of bean.tastingNotes) {
      if (note.category) paths.add(note.category);
      if (note.subcategory) paths.add(`${note.category} > ${note.subcategory}`);
      if (note.fullPath) paths.add(note.fullPath);
    }
    return paths;
  }, [hoveredBeanId, beans]);

  // Compute outer circumference dots for coffee beans
  // Each coffee bean has multiple tasting notes, so a bean produces a dot for EACH tag it possesses!
  const outerDots = useMemo(() => {
    if (!root || !currentFocus || !beans.length) return [];

    // Map leaf paths to node in root
    const leafNodesMap = new Map();
    root.each((d) => {
      if (!d.children || d.depth === 3) {
        leafNodesMap.set(d.data.path, d);
      }
    });

    // Group dots by leaf node path
    const groupedDots = new Map();

    for (const bean of beans) {
      for (const note of bean.tastingNotes) {
        const path = note.fullPath;
        const leafNode = leafNodesMap.get(path);
        if (!leafNode) continue;

        // Check if this leaf node is under currentFocus
        let curr = leafNode;
        let isUnderFocus = false;
        while (curr) {
          if (curr === currentFocus) {
            isUnderFocus = true;
            break;
          }
          curr = curr.parent;
        }
        if (!isUnderFocus) continue;

        if (!groupedDots.has(path)) {
          groupedDots.set(path, {
            node: leafNode,
            dots: [],
          });
        }

        groupedDots.get(path).dots.push({
          dotId: `${bean.id}-${path}`,
          beanId: bean.id,
          bean,
          note,
          path,
          color: leafNode.data.color,
        });
      }
    }

    // Now calculate angle and radius for each dot within each leaf node's visible angle range
    const calculatedDots = [];
    const isZoomed = currentFocus.depth > 0;

    groupedDots.forEach(({ node, dots }) => {
      const startA = toAngle(node.x0);
      const endA = toAngle(node.x1);
      const spread = endA - startA;
      if (spread < 0.001) return;

      // Sort dots deterministically by bean title
      dots.sort((a, b) => a.bean.title.localeCompare(b.bean.title));

      const count = dots.length;
      const pad = Math.min(spread * 0.08, 0.015);
      const available = spread - 2 * pad;
      const angleStep = count > 1 ? available / count : 0;

      // Stagger radius into multiple concentric tracks if high density
      const isDense = !isZoomed && count > 5 && available / count < 0.022;

      dots.forEach((dot, idx) => {
        const dotAngle =
          count === 1
            ? (startA + endA) / 2
            : startA + pad + (idx + 0.5) * angleStep;

        const trackOffset = isDense ? (idx % 2) * 8 : 0;
        const rDot = dotBaseRadius + trackOffset;

        // Coordinates
        const midA = dotAngle - Math.PI / 2;
        const cx = Math.cos(midA) * rDot;
        const cy = Math.sin(midA) * rDot;

        // Radial label coordinates
        const rLabel = rDot + 7;
        const lx = Math.cos(midA) * rLabel;
        const ly = Math.sin(midA) * rLabel;

        const degAngle = (midA * 180) / Math.PI;
        const isLeft = Math.cos(midA) < 0;
        const rotateDeg = isLeft ? degAngle + 180 : degAngle;
        const textAnchor = isLeft ? "end" : "start";

        const canShowInFull =
          available / count >= 0.035 ||
          idx % Math.ceil(0.04 / Math.max(available / count, 0.005)) === 0;

        calculatedDots.push({
          ...dot,
          cx,
          cy,
          lx,
          ly,
          rotateDeg,
          textAnchor,
          dotAngle,
          rDot,
          isDense,
          canShowInFull,
        });
      });
    });

    return calculatedDots;
  }, [root, currentFocus, beans, dotBaseRadius, toAngle]);

  // Compute radial connectors from each dot of the hovered bean to its belonging sunburst slice
  const hoveredDotConnectors = useMemo(() => {
    if (!hoveredBeanId) return [];
    const matchedDots = outerDots.filter((d) => d.beanId === hoveredBeanId);
    const sliceBoundaryRadius = sunburstOuterRadius - 2;

    return matchedDots.map((d) => {
      const midA = d.dotAngle - Math.PI / 2;
      const sx = Math.cos(midA) * sliceBoundaryRadius;
      const sy = Math.sin(midA) * sliceBoundaryRadius;
      return {
        id: `conn-${d.dotId}`,
        x1: sx,
        y1: sy,
        x2: d.cx,
        y2: d.cy,
        color: d.color || "var(--color-primary, #6f4e37)",
      };
    });
  }, [hoveredBeanId, outerDots, sunburstOuterRadius]);

  // Compute breadcrumb path nodes
  const breadcrumbs = useMemo(() => {
    if (!currentFocus) return [];
    const crumbs = [];
    let curr = currentFocus;
    while (curr) {
      crumbs.unshift(curr);
      curr = curr.parent;
    }
    return crumbs;
  }, [currentFocus]);

  // Helper to format node name according to languageMode
  const formatName = (nodeData, isShort = false) => {
    if (!nodeData) return "";
    const en = nodeData.name;
    const ja = nodeData.nameJa || en;
    if (languageMode === "ja") return ja;
    if (languageMode === "en") return en;
    return isShort ? ja : `${en} / ${ja}`;
  };

  const centerNode = currentFocus || root;
  const isAtRoot = !currentFocus || currentFocus.depth === 0;
  const isZoomed = !isAtRoot;

  return (
    <div className="flex flex-col h-full w-full select-none bg-base-100/60 rounded-3xl p-4 shadow-sm border border-base-300/60 backdrop-blur-md">
      {/* Breadcrumb Navigation & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-base-200">
        <div className="flex items-center flex-wrap gap-1 text-xs sm:text-sm">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            const isRoot = idx === 0;
            return (
              <React.Fragment key={crumb.data.path || "root"}>
                <button
                  type="button"
                  onClick={() => handleSliceClick(crumb)}
                  className={`px-2.5 py-1 rounded-full font-medium transition-all flex items-center gap-1 ${
                    isLast
                      ? "bg-primary text-primary-content shadow-sm"
                      : "bg-base-200/80 hover:bg-base-300 text-base-content/80"
                  }`}
                  style={
                    !isLast && crumb.data.color
                      ? { borderLeft: `3px solid ${crumb.data.color}` }
                      : undefined
                  }
                >
                  {isRoot ? "全体 (All)" : formatName(crumb.data, true)}
                  {crumb.data.beanCount !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                        isLast
                          ? "bg-white/20 text-white"
                          : "bg-base-300/80 text-base-content/70"
                      }`}
                    >
                      {crumb.data.beanCount}
                    </span>
                  )}
                </button>
                {!isLast && (
                  <ChevronRight
                    size={14}
                    className="text-base-content/40 shrink-0"
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Quick Reset & Hint */}
        <div className="flex items-center gap-2">
          {!isAtRoot && (
            <button
              type="button"
              onClick={handleCenterClick}
              className="btn btn-xs btn-outline btn-primary gap-1 rounded-full shadow-xs"
              title="親階層へ戻る"
            >
              <RotateCcw size={12} />
              <span>1つ戻る</span>
            </button>
          )}
        </div>
      </div>

      {/* Main SVG Wheel Container */}
      <div
        ref={containerRef}
        className="relative flex-1 flex items-center justify-center min-h-[360px] my-1 overflow-hidden"
      >
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`${-dimensions.width / 2} ${-dimensions.height / 2} ${
            dimensions.width
          } ${dimensions.height}`}
          className="transition-all duration-300"
          role="img"
          aria-label="SCAA Specialty Coffee Flavor Wheel"
        >
          <title>Specialty Coffee Flavor Wheel with Data Dots</title>

          {/* Wheel Slices */}
          <g className="sunburst-slices">
            {visibleNodes.map((node) => {
              const dPath = arcGenerator(node);
              if (!dPath) return null;

              const isBelongingSlice =
                hoveredBeanId !== null
                  ? activeTagPaths.has(node.data.path)
                  : true;
              const isDimmed = hoveredBeanId !== null && !isBelongingSlice;

              const angleSpread =
                ((node.x1 - node.x0) /
                  (currentFocus ? currentFocus.x1 - currentFocus.x0 : 1)) *
                2 *
                Math.PI;

              const isHovered = hoveredNode === node;
              const isSelected =
                selectedFlavor && selectedFlavor.path === node.data.path;

              // Calculate middle point for text label
              const focusDepth = currentFocus ? currentFocus.depth : 0;
              const depthDiff = node.depth - focusDepth;
              const visibleLevels = Math.max(1, 3 - focusDepth);
              const step =
                (sunburstOuterRadius - innerRadiusBase) / visibleLevels;
              const rMid = innerRadiusBase + (depthDiff - 0.5) * step;

              const midAngle =
                Math.max(
                  0,
                  Math.min(
                    2 * Math.PI,
                    (((node.x0 + node.x1) / 2 -
                      (currentFocus ? currentFocus.x0 : 0)) /
                      (currentFocus ? currentFocus.x1 - currentFocus.x0 : 1)) *
                      2 *
                      Math.PI,
                  ),
                ) -
                Math.PI / 2;

              const xText = Math.cos(midAngle) * rMid;
              const yText = Math.sin(midAngle) * rMid;
              const degAngle = (midAngle * 180) / Math.PI;
              const rotateDeg =
                degAngle > 90 || degAngle < -90 ? degAngle + 180 : degAngle;

              const showLabel = angleSpread > 0.08;

              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: Interactive SVG chart slice
                <g
                  key={node.data.path}
                  className="cursor-pointer transition-all duration-200 group"
                  onClick={(e) => handleSliceClick(node, e)}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  opacity={isDimmed ? 0.18 : 1}
                >
                  <path
                    d={dPath}
                    fill={node.data.color || "#999"}
                    stroke="#ffffff"
                    strokeWidth={
                      isSelected || (isBelongingSlice && hoveredBeanId !== null)
                        ? 3
                        : isHovered
                          ? 2
                          : 1
                    }
                    className={`transition-all duration-200 ${
                      isDimmed
                        ? "filter grayscale-30"
                        : isHovered ||
                            (isBelongingSlice && hoveredBeanId !== null)
                          ? "filter brightness-110 drop-shadow-md"
                          : isSelected
                            ? "filter brightness-105"
                            : "opacity-95"
                    }`}
                  />

                  {/* Arc Text Label */}
                  {showLabel && (
                    <text
                      x={xText}
                      y={yText}
                      transform={`rotate(${rotateDeg}, ${xText}, ${yText})`}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      opacity={isDimmed ? 0.25 : 1}
                      fontSize={
                        angleSpread > 0.3 ? (depthDiff === 1 ? 12 : 10) : 9
                      }
                      fontWeight={depthDiff === 1 ? "700" : "600"}
                      className="pointer-events-none select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
                    >
                      {languageMode === "ja"
                        ? node.data.nameJa || node.data.name
                        : languageMode === "en"
                          ? node.data.name
                          : angleSpread > 0.25
                            ? `${node.data.nameJa || node.data.name}`
                            : node.data.nameJa || node.data.name}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Radial connectors from each dot of the hovered coffee bean to its belonging sunburst slice */}
          {/* Rendered ON TOP of sunburst slices so it is clearly visible and never covered */}
          <g className="hovered-dot-connectors pointer-events-none">
            {hoveredDotConnectors.map((conn) => (
              <g key={conn.id}>
                {/* White halo line for contrast */}
                <line
                  x1={conn.x1}
                  y1={conn.y1}
                  x2={conn.x2}
                  y2={conn.y2}
                  stroke="#ffffff"
                  strokeWidth={4.5}
                  strokeLinecap="round"
                  opacity={0.85}
                />
                {/* Solid crisp tag-colored connection line */}
                <line
                  x1={conn.x1}
                  y1={conn.y1}
                  x2={conn.x2}
                  y2={conn.y2}
                  stroke={conn.color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  opacity={1}
                />
                {/* Anchor dot on sunburst boundary */}
                <circle
                  cx={conn.x1}
                  cy={conn.y1}
                  r={3}
                  fill={conn.color}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
              </g>
            ))}
          </g>

          {/* Outer Perimeter Dots (Representing individual coffee bean data) */}
          <g className="outer-data-dots">
            {outerDots.map((dot) => {
              const isBeanHovered = hoveredBeanId === dot.beanId;
              const isDirectHover = hoveredDot?.dotId === dot.dotId;
              const isDimmed = hoveredBeanId !== null && !isBeanHovered;

              const dotRadius = isDirectHover
                ? 6.5
                : isBeanHovered
                  ? 5.5
                  : isDimmed
                    ? 2.5
                    : 3.5;

              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: Interactive SVG data dot
                <g
                  key={dot.dotId}
                  className="cursor-pointer transition-all duration-200"
                  opacity={isDimmed ? 0.18 : 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectCoffee) onSelectCoffee(dot.bean);
                  }}
                  onMouseEnter={() => {
                    setHoveredBeanId(dot.beanId);
                    setHoveredDot(dot);
                  }}
                  onMouseLeave={() => {
                    setHoveredBeanId(null);
                    setHoveredDot(null);
                  }}
                >
                  {/* Subtle hit target */}
                  <circle
                    cx={dot.cx}
                    cy={dot.cy}
                    r={isDirectHover ? 12 : 8}
                    fill="transparent"
                  />

                  {/* Outer subtle static ring for highlighted bean */}
                  {isBeanHovered && (
                    <circle
                      cx={dot.cx}
                      cy={dot.cy}
                      r={dotRadius + 2.5}
                      fill="none"
                      stroke={isDirectHover ? "#fbbf24" : dot.color}
                      strokeWidth={1.5}
                      opacity={0.9}
                    />
                  )}

                  {/* Coffee Bean Dot */}
                  <circle
                    cx={dot.cx}
                    cy={dot.cy}
                    r={dotRadius}
                    fill={isBeanHovered ? "#fbbf24" : dot.color}
                    stroke="#ffffff"
                    strokeWidth={isBeanHovered ? 2 : 1}
                    className="transition-all duration-200 shadow-sm"
                  />
                </g>
              );
            })}
          </g>

          {/* Radial Labels for Outermost Dots */}
          <g className="outer-data-labels pointer-events-none">
            {outerDots.map((dot) => {
              const isBeanHovered = hoveredBeanId === dot.beanId;

              // When hovering a bean, ONLY show labels for that hovered bean's dots!
              if (hoveredBeanId !== null) {
                if (!isBeanHovered) return null;
              } else {
                const showLabel = isZoomed || dot.canShowInFull;
                if (!showLabel) return null;
              }

              const titleText =
                dot.bean.title.length > (isZoomed ? 22 : 14)
                  ? `${dot.bean.title.slice(0, isZoomed ? 22 : 14)}…`
                  : dot.bean.title;

              return (
                <text
                  key={`label-${dot.dotId}`}
                  x={dot.lx}
                  y={dot.ly}
                  transform={`rotate(${dot.rotateDeg}, ${dot.lx}, ${dot.ly})`}
                  textAnchor={dot.textAnchor}
                  dominantBaseline="central"
                  fill={isBeanHovered ? "#854d0e" : "#475569"}
                  fontSize={isBeanHovered ? 10.5 : isZoomed ? 9.5 : 8.5}
                  fontWeight={isBeanHovered ? "800" : "500"}
                  className="transition-all duration-150 select-none drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]"
                >
                  {titleText}
                </text>
              );
            })}
          </g>

          {/* Center Circle (Interactive Reset / Focus Anchor) */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: Interactive SVG center reset */}
          <g
            className="cursor-pointer group"
            onClick={handleCenterClick}
            onMouseEnter={() => setHoveredNode(centerNode)}
            onMouseLeave={() => setHoveredNode(null)}
          >
            {/* Center Background Glow & Circle */}
            <circle
              r={innerRadiusBase - 3}
              fill={
                centerNode?.data?.color
                  ? centerNode.data.color
                  : "var(--color-primary, #6f4e37)"
              }
              stroke="#ffffff"
              strokeWidth={3}
              className="transition-all duration-300 group-hover:filter group-hover:brightness-110 shadow-lg"
            />
            <circle
              r={innerRadiusBase - 8}
              fill="rgba(0,0,0,0.15)"
              className="pointer-events-none"
            />

            {/* Center Text */}
            <g className="pointer-events-none text-center">
              <text
                textAnchor="middle"
                y={isAtRoot ? -10 : -14}
                fill="#ffffff"
                fontSize={isAtRoot ? 14 : 13}
                fontWeight="800"
                className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
              >
                {isAtRoot
                  ? "フレーバー全体"
                  : centerNode.data.nameJa || centerNode.data.name}
              </text>
              <text
                textAnchor="middle"
                y={isAtRoot ? 8 : 4}
                fill="#ffffff"
                fontSize={isAtRoot ? 11 : 10}
                fontWeight="500"
                opacity="0.9"
                className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
              >
                {isAtRoot ? "All Flavors" : centerNode.data.name}
              </text>
              <text
                textAnchor="middle"
                y={isAtRoot ? 24 : 20}
                fill="#ffffff"
                fontSize={10}
                fontWeight="700"
                className="bg-black/30"
              >
                {centerNode.data.beanCount !== undefined
                  ? `${centerNode.data.beanCount} 銘柄`
                  : `${root ? root.value : 100} 銘柄`}
              </text>
              {!isAtRoot && (
                <text
                  textAnchor="middle"
                  y={34}
                  fill="#ffffff"
                  fontSize={8.5}
                  opacity="0.8"
                >
                  (クリックで戻る)
                </text>
              )}
            </g>
          </g>
        </svg>

        {/* Hover Tooltip Overlay for Slices */}
        {hoveredNode && hoveredNode.depth > 0 && !hoveredDot && (
          <div className="absolute top-2 right-2 pointer-events-none bg-neutral text-neutral-content px-3 py-2 rounded-xl text-xs shadow-xl border border-white/20 backdrop-blur-md max-w-xs animate-fade-in z-20">
            <div
              className="flex items-center gap-1.5 font-bold text-sm"
              style={{ color: hoveredNode.data.color }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: hoveredNode.data.color }}
              />
              {hoveredNode.data.nameJa} ({hoveredNode.data.name})
            </div>
            <div className="text-[11px] text-neutral-content/70 mt-0.5">
              階層: {hoveredNode.data.path}
            </div>
            <div className="mt-1 font-semibold flex items-center gap-1">
              <Sparkles size={12} className="text-warning" />
              <span>
                該当コーヒー豆: {hoveredNode.data.beanCount || 0} 銘柄
              </span>
            </div>
            <div className="text-[10px] text-neutral-content/60 mt-1 italic">
              クリックでこの階層をズーム・絞り込み
            </div>
          </div>
        )}

        {/* Hover Tooltip for Outer Data Dots (Coffee Bean) */}
        {hoveredDot && (
          <div className="absolute top-2 right-2 pointer-events-none bg-neutral text-neutral-content px-3.5 py-2.5 rounded-2xl text-xs shadow-2xl border border-amber-400/40 backdrop-blur-md max-w-xs animate-fade-in z-30">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5 mb-1.5">
              <span className="font-bold text-amber-300 text-xs">
                {hoveredDot.bean.roaster}
              </span>
              <span className="bg-white/15 px-2 py-0.5 rounded-full text-[10px]">
                {hoveredDot.bean.country}
              </span>
            </div>
            <div className="font-extrabold text-sm text-white line-clamp-2">
              {hoveredDot.bean.title}
            </div>
            <div className="mt-2 text-[11px] text-neutral-content/80">
              <div className="font-semibold text-amber-200/90 mb-1">
                保持フレーバータグ ({hoveredDot.bean.tastingNotes.length}件):
              </div>
              <div className="flex flex-wrap gap-1">
                {hoveredDot.bean.tastingNotes.map((tn) => {
                  const isCurrent = tn.fullPath === hoveredDot.path;
                  return (
                    <span
                      key={tn.fullPath}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        isCurrent
                          ? "bg-amber-400 text-black font-bold"
                          : "bg-white/20 text-white"
                      }`}
                    >
                      {tn.nameJa || tn.descriptor}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 text-[10px] text-amber-200/70 italic flex items-center justify-between">
              <span>クリックで詳細モーダル表示</span>
              <span>
                {hoveredDot.bean.priceCurrency === "USD"
                  ? "$"
                  : hoveredDot.bean.priceCurrency}{" "}
                {hoveredDot.bean.priceValue.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Category Quick Jump Chips */}
      <div className="pt-2 border-t border-base-200">
        <div className="text-[11px] font-semibold text-base-content/60 mb-1.5 flex items-center justify-between">
          <span>大カテゴリから選ぶ:</span>
          <span className="text-[10px] text-base-content/50">
            スライスクリックでズームイン
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {flavorTree?.children?.map((cat) => {
            const isCatSelected =
              selectedFlavor &&
              (selectedFlavor.path === cat.path ||
                selectedFlavor.path.startsWith(`${cat.path} >`));
            return (
              <button
                key={cat.name}
                type="button"
                onClick={() => {
                  let found = null;
                  root.each((d) => {
                    if (d.data.path === cat.path) found = d;
                  });
                  if (found) handleSliceClick(found);
                }}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  isCatSelected
                    ? "text-white shadow-sm ring-2 ring-offset-1 ring-primary"
                    : "bg-base-200/80 hover:bg-base-300 text-base-content"
                }`}
                style={{
                  backgroundColor: isCatSelected ? cat.color : undefined,
                  borderLeft: !isCatSelected
                    ? `3px solid ${cat.color}`
                    : undefined,
                }}
              >
                <span>{cat.nameJa}</span>
                <span className="text-[10px] opacity-75">
                  ({cat.beanCount})
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
