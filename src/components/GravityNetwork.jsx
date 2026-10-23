import * as d3Drag from "d3-drag";
import * as d3Force from "d3-force";
import * as d3Selection from "d3-selection";
import * as d3Zoom from "d3-zoom";
import {
  ChevronRight,
  Eye,
  Info,
  Magnet,
  RotateCcw,
  Sliders,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function GravityNetwork({
  data,
  selectedCoffee,
  onSelectCoffee,
  languageMode = "both",
  onOpenDetail,
}) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const simulationRef = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const nodesRef = useRef([]);

  // States
  const [filterMode, setFilterMode] = useState("all"); // "all" | "multi" | "single"
  const [selectedAnchorId, setSelectedAnchorId] = useState(null);
  const [hoveredBean, setHoveredBean] = useState(null);
  const [showAllLines, setShowAllLines] = useState(false);
  const [showPhysicsPanel, setShowPhysicsPanel] = useState(false);

  // Physics Parameters
  const [physicsParams, setPhysicsParams] = useState({
    linkStrength: 0.5,
    repulsion: -25,
    collisionRadius: 13,
    gravityCenter: 0.03,
  });

  // Container dimensions
  const [dimensions, setDimensions] = useState({ width: 900, height: 650 });

  // Update dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height: Math.max(height, 560) });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute Anchor coordinates symmetrically on perimeter
  const anchorLayout = useMemo(() => {
    if (!data?.anchors) return [];
    const { width, height } = dimensions;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.38;
    const count = data.anchors.length;

    return data.anchors.map((anchor, i) => {
      const angle = (i * 2 * Math.PI) / count - Math.PI / 2;
      return {
        ...anchor,
        originalX: cx + radius * Math.cos(angle),
        originalY: cy + radius * Math.sin(angle),
      };
    });
  }, [data?.anchors, dimensions]);

  // Main D3 Rendering & Simulation Mount
  useEffect(() => {
    if (!svgRef.current || !data?.beans || anchorLayout.length === 0) return;

    const { width, height } = dimensions;
    const cx = width / 2;
    const cy = height / 2;

    const svg = d3Selection.select(svgRef.current);
    // Clear previous dynamic content
    svg.selectAll(".root-container").remove();

    // Create root zoomed container
    const root = svg.append("g").attr("class", "root-container");

    // Static Background Field Guide Circles
    const bgGuides = root
      .append("g")
      .attr("class", "bg-guides")
      .attr("pointer-events", "none")
      .attr("opacity", 0.35);

    const orbitRadius = Math.min(width, height) * 0.38;
    bgGuides
      .append("circle")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", orbitRadius)
      .attr("fill", "url(#center-bg-gradient)")
      .attr("stroke", "#d4a373")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 8");

    bgGuides
      .append("circle")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", orbitRadius * 0.5)
      .attr("fill", "none")
      .attr("stroke", "#d4a373")
      .attr("stroke-width", 0.7)
      .attr("stroke-dasharray", "2 6");

    for (const a of anchorLayout) {
      bgGuides
        .append("line")
        .attr("x1", cx)
        .attr("y1", cy)
        .attr("x2", a.originalX)
        .attr("y2", a.originalY)
        .attr("stroke", a.color)
        .attr("stroke-width", 0.8)
        .attr("stroke-dasharray", "3 7")
        .attr("opacity", 0.4);
    }

    // Layers
    const linksLayer = root.append("g").attr("class", "links-layer");
    const beansLayer = root.append("g").attr("class", "beans-layer");
    const anchorsLayer = root.append("g").attr("class", "anchors-layer");

    // 1. Anchor Nodes
    const anchorNodes = anchorLayout.map((a) => ({
      id: a.id,
      name: a.name,
      nameJa: a.nameJa,
      color: a.color,
      accent: a.accent,
      bgGlow: a.bgGlow,
      description: a.description,
      beanCount: a.beanCount,
      isAnchor: true,
      x: a.originalX,
      y: a.originalY,
      fx: a.originalX,
      fy: a.originalY,
      radius: 36,
    }));

    // 2. Bean Nodes
    const beanNodes = data.beans.map((b) => {
      // Find initial centroid near its matching anchors
      let targetX = cx;
      let targetY = cy;
      const matchingAnchors = anchorLayout.filter((a) =>
        b.categories.includes(a.id),
      );
      if (matchingAnchors.length > 0) {
        targetX =
          matchingAnchors.reduce((acc, curr) => acc + curr.originalX, 0) /
          matchingAnchors.length;
        targetY =
          matchingAnchors.reduce((acc, curr) => acc + curr.originalY, 0) /
          matchingAnchors.length;
      }

      return {
        ...b,
        isAnchor: false,
        x: targetX + (Math.random() - 0.5) * 40,
        y: targetY + (Math.random() - 0.5) * 40,
        radius: b.isMultiLabel ? 9 : 7.5,
      };
    });

    const allNodes = [...anchorNodes, ...beanNodes];
    nodesRef.current = allNodes;
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

    // 3. Links
    const simulationLinks = data.links
      .filter((l) => nodeMap.has(l.source) && nodeMap.has(l.target))
      .map((l) => ({
        source: l.source,
        target: l.target,
        weight: l.weight,
        count: l.count,
      }));

    // D3 Link Elements
    const linkSelection = linksLayer
      .selectAll("line.gravity-link")
      .data(simulationLinks)
      .enter()
      .append("line")
      .attr("class", "gravity-link pointer-events-none")
      .attr("stroke", (d) => {
        const anchor = data.anchors.find((a) => a.id === d.target);
        return anchor ? anchor.color : "#d4a373";
      })
      .attr("stroke-width", (d) => Math.max(0.7, d.weight * 2))
      .attr("stroke-opacity", 0.08);

    // D3 Bean Elements
    const beanSelection = beansLayer
      .selectAll("g.bean-group")
      .data(beanNodes)
      .enter()
      .append("g")
      .attr("class", "bean-group cursor-pointer")
      .attr("opacity", 0.9)
      .on("mouseenter", (_event, d) => {
        setHoveredBean(d);
      })
      .on("mouseleave", () => {
        setHoveredBean(null);
      })
      .on("click", (_event, d) => {
        onSelectCoffee(d);
      });

    // Bean Outer Dash Aura (for multi-label)
    beanSelection
      .filter((d) => d.isMultiLabel)
      .append("circle")
      .attr("class", "bean-aura animate-spin-slow")
      .attr("r", (d) => d.radius + 3)
      .attr("fill", "none")
      .attr("stroke", (d) => d.blendColor)
      .attr("stroke-width", 1.2)
      .attr("stroke-dasharray", "3 2")
      .attr("opacity", 0.65);

    // Main Bean Circle
    beanSelection
      .append("circle")
      .attr("class", "bean-circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => d.blendColor)
      .attr("stroke", "rgba(255, 255, 255, 0.4)")
      .attr("stroke-width", 1);

    // Bean crease line (coffee bean shape detail)
    beanSelection
      .append("path")
      .attr("class", "bean-crease")
      .attr("d", "M -1.8 -3.5 C -0.5 -1, 0.5 1, 1.8 3.5")
      .attr("stroke", "rgba(0, 0, 0, 0.5)")
      .attr("stroke-width", 1.1)
      .attr("stroke-linecap", "round")
      .attr("fill", "none")
      .attr("pointer-events", "none");

    // D3 Anchor Elements
    const anchorSelection = anchorsLayer
      .selectAll("g.anchor-group")
      .data(anchorNodes)
      .enter()
      .append("g")
      .attr("class", "anchor-group cursor-grab select-none")
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelectedAnchorId((prev) => (prev === d.id ? null : d.id));
      });

    // Anchor outer pulse orbit
    anchorSelection
      .append("circle")
      .attr("class", "anchor-orbit animate-spin-slow")
      .attr("r", 48)
      .attr("fill", "none")
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", 1.2)
      .attr("stroke-dasharray", "4 6")
      .attr("opacity", 0.35);

    // Anchor aura glow
    anchorSelection
      .append("circle")
      .attr("class", "anchor-glow")
      .attr("r", 40)
      .attr("fill", (d) => d.bgGlow)
      .attr("filter", "url(#anchor-glow)")
      .attr("opacity", 0.55);

    // Anchor body
    anchorSelection
      .append("circle")
      .attr("class", "anchor-body")
      .attr("r", 36)
      .attr("fill", (d) => `url(#grad-${d.id})`)
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", 2.2);

    // Anchor inner ring
    anchorSelection
      .append("circle")
      .attr("r", 31)
      .attr("fill", "none")
      .attr("stroke", "rgba(255, 255, 255, 0.35)")
      .attr("stroke-width", 1);

    // Japanese text label
    anchorSelection
      .append("text")
      .attr("class", "anchor-text-ja")
      .attr("text-anchor", "middle")
      .attr("y", -4)
      .attr("fill", "#ffffff")
      .attr("font-size", "12.5px")
      .attr("font-weight", "900")
      .attr("filter", "drop-shadow(0px 1px 3px rgba(0,0,0,0.85))")
      .attr("pointer-events", "none")
      .text((d) => (languageMode === "en" ? d.name : d.nameJa));

    // English text sublabel
    if (languageMode !== "en") {
      anchorSelection
        .append("text")
        .attr("class", "anchor-text-en")
        .attr("text-anchor", "middle")
        .attr("y", 10)
        .attr("fill", "rgba(255, 255, 255, 0.85)")
        .attr("font-size", "9.5px")
        .attr("font-weight", "600")
        .attr("filter", "drop-shadow(0px 1px 2px rgba(0,0,0,0.8))")
        .attr("pointer-events", "none")
        .text((d) => d.name);
    }

    // Bean count pill badge
    const badgeGroup = anchorSelection
      .append("g")
      .attr("transform", "translate(0, 24)")
      .attr("pointer-events", "none");

    badgeGroup
      .append("rect")
      .attr("x", -18)
      .attr("y", -7)
      .attr("width", 36)
      .attr("height", 14)
      .attr("rx", 7)
      .attr("fill", "rgba(0, 0, 0, 0.75)")
      .attr("stroke", "rgba(255, 255, 255, 0.3)")
      .attr("stroke-width", 0.8);

    badgeGroup
      .append("text")
      .attr("text-anchor", "middle")
      .attr("y", 3.5)
      .attr("fill", "#fef08a")
      .attr("font-size", "9px")
      .attr("font-weight", "bold")
      .attr("font-family", "monospace")
      .text((d) => `${d.beanCount} 豆`);

    // D3 Force Simulation Setup
    const simulation = d3Force
      .forceSimulation(allNodes)
      // Gravity link pull to anchors
      .force(
        "link",
        d3Force
          .forceLink(simulationLinks)
          .id((d) => d.id)
          .distance(55)
          .strength((link) => {
            const base = physicsParams.linkStrength;
            const bean = link.source;
            return bean.isMultiLabel ? base * link.weight * 1.1 : base * 1.35;
          }),
      )
      // Node repulsion
      .force(
        "charge",
        d3Force
          .forceManyBody()
          .strength((d) => (d.isAnchor ? 0 : physicsParams.repulsion))
          .distanceMax(260),
      )
      // Collision
      .force(
        "collide",
        d3Force
          .forceCollide()
          .radius((d) =>
            d.isAnchor ? 46 : d.radius + physicsParams.collisionRadius - 10,
          )
          .strength(0.85),
      )
      // Gentle center anchor pull
      .force(
        "center_pull",
        d3Force.forceRadial(15, cx, cy).strength(physicsParams.gravityCenter),
      )
      .alphaDecay(0.02)
      .velocityDecay(0.35);

    simulationRef.current = simulation;

    // Simulation Tick: Update Positions
    simulation.on("tick", () => {
      linkSelection
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      anchorSelection.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
      beanSelection.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
    });

    // Drag behavior for Beans
    const beanDrag = d3Drag
      .drag()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    // Drag behavior for Anchors
    const anchorDrag = d3Drag
      .drag()
      .on("start", (event) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event) => {
        if (!event.active) simulation.alphaTarget(0);
      });

    beanSelection.call(beanDrag);
    anchorSelection.call(anchorDrag);

    // Zoom setup
    const zoom = d3Zoom
      .zoom()
      .scaleExtent([0.5, 3.5])
      .on("zoom", (event) => {
        root.attr("transform", event.transform);
      });
    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    return () => {
      simulation.stop();
    };
  }, [
    anchorLayout,
    data,
    dimensions,
    languageMode,
    onSelectCoffee,
    physicsParams,
  ]);

  // Update Visual Highlights (Filtering, Links, Active selection) dynamically
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3Selection.select(svgRef.current);

    // Update Bean Opacity & Scale based on filters
    svg.selectAll(".bean-group").each(function (d) {
      const g = d3Selection.select(this);
      let active = true;

      if (filterMode === "multi" && !d.isMultiLabel) active = false;
      if (filterMode === "single" && d.isMultiLabel) active = false;
      if (selectedAnchorId && !d.categories.includes(selectedAnchorId)) {
        active = false;
      }

      const isSelected = selectedCoffee?.id === d.id;
      const isHovered = hoveredBean?.id === d.id;
      const isFocused = isSelected || isHovered;

      g.transition()
        .duration(150)
        .attr("opacity", active ? (isFocused ? 1 : 0.88) : 0.12);

      g.select(".bean-circle")
        .transition()
        .duration(150)
        .attr("r", isFocused ? d.radius + 3 : d.radius)
        .attr("stroke", isFocused ? "#ffffff" : "rgba(255,255,255,0.4)")
        .attr("stroke-width", isFocused ? 2.5 : 1)
        .attr("filter", isFocused ? "url(#glow-link)" : null);
    });

    // Update Links Highlight
    svg.selectAll(".gravity-link").each(function (d) {
      const line = d3Selection.select(this);
      const sourceId = typeof d.source === "object" ? d.source.id : d.source;
      const targetId = typeof d.target === "object" ? d.target.id : d.target;

      const isFocused =
        (hoveredBean && hoveredBean.id === sourceId) ||
        (selectedCoffee && selectedCoffee.id === sourceId) ||
        (selectedAnchorId && selectedAnchorId === targetId);

      if (showAllLines || isFocused) {
        line
          .transition()
          .duration(120)
          .attr("stroke-opacity", isFocused ? 0.95 : 0.14)
          .attr(
            "stroke-width",
            isFocused
              ? Math.max(1.8, d.weight * 4.2)
              : Math.max(0.6, d.weight * 1.5),
          )
          .attr("stroke-dasharray", isFocused ? "4 4" : "none")
          .attr("filter", isFocused ? "url(#glow-link)" : null);
      } else {
        line.transition().duration(120).attr("stroke-opacity", 0);
      }
    });

    // Update Anchor styling
    svg.selectAll(".anchor-group").each(function (d) {
      const g = d3Selection.select(this);
      const isSelected = selectedAnchorId === d.id;

      g.select(".anchor-body")
        .transition()
        .duration(150)
        .attr("stroke", isSelected ? "#ffffff" : d.color)
        .attr("stroke-width", isSelected ? 3.5 : 2.2);

      g.select(".anchor-glow")
        .transition()
        .duration(150)
        .attr("opacity", isSelected ? 0.95 : 0.55);
    });
  }, [filterMode, selectedAnchorId, selectedCoffee, hoveredBean, showAllLines]);

  // Restart simulation with warmth
  const reheatSimulation = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.alpha(0.4).restart();
    }
  }, []);

  // Reset View & Anchors
  const handleReset = () => {
    if (!svgRef.current || !anchorLayout.length) return;
    const svg = d3Selection.select(svgRef.current);
    if (zoomBehaviorRef.current) {
      svg
        .transition()
        .duration(650)
        .call(zoomBehaviorRef.current.transform, d3Zoom.zoomIdentity);
    }
    const simulation = simulationRef.current;
    if (simulation) {
      const nodes = simulation.nodes();
      for (const node of nodes) {
        if (node.isAnchor) {
          const original = anchorLayout.find((a) => a.id === node.id);
          if (original) {
            node.fx = original.originalX;
            node.fy = original.originalY;
          }
        } else {
          node.fx = null;
          node.fy = null;
        }
      }
      simulation.alpha(0.6).restart();
    }
    setSelectedAnchorId(null);
  };

  // Zoom helpers
  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3Selection
        .select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3Selection
        .select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.scaleBy, 0.77);
    }
  };

  // Active anchor
  const activeAnchor = useMemo(() => {
    return data?.anchors?.find((a) => a.id === selectedAnchorId);
  }, [data?.anchors, selectedAnchorId]);

  const inspectedBean = hoveredBean || selectedCoffee;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col bg-gradient-to-br from-[#1c1815] via-[#241e1b] to-[#161210] text-amber-50 rounded-2xl border border-amber-950/40 shadow-2xl overflow-hidden select-none"
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2.5 pointer-events-none">
        {/* Left: Mode Title & Quick Filters */}
        <div className="flex items-center gap-2 pointer-events-auto bg-neutral-900/80 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 shadow-lg">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mr-1.5">
            <Magnet size={15} className="animate-pulse" />
            <span className="hidden sm:inline">多極引力モデル</span>
            <span className="sm:hidden">引力</span>
          </div>

          {/* Filter: All / Multi-label / Single */}
          <div className="flex items-center bg-black/40 p-0.5 rounded-xl text-[11px] font-medium border border-white/5">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterMode === "all"
                  ? "bg-amber-600 text-white font-bold shadow-sm"
                  : "text-amber-200/60 hover:text-white"
              }`}
            >
              すべて ({data?.metadata?.totalBeans ?? 100})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("multi")}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                filterMode === "multi"
                  ? "bg-amber-600 text-white font-bold shadow-sm"
                  : "text-amber-200/60 hover:text-white"
              }`}
              title="複数の味を持つブレンド豆（磁石の中間地点に浮遊）"
            >
              <Sparkles size={11} className="text-amber-300" />
              <span>
                中間ブレンド ({data?.metadata?.multiLabelCount ?? 59})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("single")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterMode === "single"
                  ? "bg-amber-600 text-white font-bold shadow-sm"
                  : "text-amber-200/60 hover:text-white"
              }`}
              title="1つの味のみを持つ豆（磁石の直下に集束）"
            >
              単一タグ ({data?.metadata?.singleLabelCount ?? 41})
            </button>
          </div>
        </div>

        {/* Right: Actions & Physics Toggle */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Toggle All Force Lines */}
          <button
            type="button"
            onClick={() => setShowAllLines((prev) => !prev)}
            className={`btn btn-xs rounded-xl border border-white/10 backdrop-blur-md gap-1.5 font-medium transition-all ${
              showAllLines
                ? "bg-amber-500/20 text-amber-300 border-amber-400/40"
                : "bg-neutral-900/80 text-amber-100/70 hover:text-white"
            }`}
            title="全ての引力線（力線）を常時表示"
          >
            <Eye size={12} />
            <span className="hidden sm:inline">引力線常時表示</span>
          </button>

          {/* Physics parameters drawer toggle */}
          <button
            type="button"
            onClick={() => setShowPhysicsPanel((prev) => !prev)}
            className={`btn btn-xs rounded-xl border border-white/10 backdrop-blur-md gap-1 font-medium transition-all ${
              showPhysicsPanel
                ? "bg-amber-500 text-neutral-950 font-bold"
                : "bg-neutral-900/80 text-amber-100/70 hover:text-white"
            }`}
            title="引力・反発力などの物理パラメータを調整"
          >
            <Sliders size={12} />
            <span className="hidden md:inline">引力調整</span>
          </button>

          {/* Zoom & View Controls */}
          <div className="flex items-center bg-neutral-900/80 backdrop-blur-md p-0.5 rounded-xl border border-white/10 shadow-lg">
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 hover:text-amber-400 transition-colors text-amber-200/80"
              title="拡大"
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 hover:text-amber-400 transition-colors text-amber-200/80"
              title="縮小"
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 hover:text-amber-400 transition-colors text-amber-200/80 border-l border-white/10"
              title="初期配置にリセット"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Physics Control Floating Panel */}
      {showPhysicsPanel && (
        <div className="absolute top-14 right-3 z-30 w-72 bg-neutral-900/95 backdrop-blur-xl border border-amber-500/30 p-4 rounded-2xl shadow-2xl text-xs space-y-3 animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <Sliders size={13} />
              引力シミュレーション設定
            </span>
            <button
              type="button"
              onClick={() => {
                setPhysicsParams({
                  linkStrength: 0.5,
                  repulsion: -25,
                  collisionRadius: 13,
                  gravityCenter: 0.03,
                });
                reheatSimulation();
              }}
              className="text-[10px] text-amber-300/70 hover:text-amber-200 underline"
            >
              初期値
            </button>
          </div>

          {/* Link Strength */}
          <div>
            <div className="flex justify-between text-amber-200/70 mb-1">
              <span>磁石への引力 (Link Force):</span>
              <span className="font-mono text-amber-400">
                {physicsParams.linkStrength.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={physicsParams.linkStrength}
              onChange={(e) => {
                setPhysicsParams((p) => ({
                  ...p,
                  linkStrength: Number.parseFloat(e.target.value),
                }));
                reheatSimulation();
              }}
              className="range range-xs range-warning w-full"
            />
          </div>

          {/* Repulsion */}
          <div>
            <div className="flex justify-between text-amber-200/70 mb-1">
              <span>ドット同士の反発 (Charge):</span>
              <span className="font-mono text-amber-400">
                {Math.abs(physicsParams.repulsion)}
              </span>
            </div>
            <input
              type="range"
              min="-70"
              max="-10"
              step="5"
              value={physicsParams.repulsion}
              onChange={(e) => {
                setPhysicsParams((p) => ({
                  ...p,
                  repulsion: Number.parseFloat(e.target.value),
                }));
                reheatSimulation();
              }}
              className="range range-xs range-warning w-full"
            />
          </div>

          {/* Collision Radius */}
          <div>
            <div className="flex justify-between text-amber-200/70 mb-1">
              <span>衝突間隔 (Collision):</span>
              <span className="font-mono text-amber-400">
                {physicsParams.collisionRadius}px
              </span>
            </div>
            <input
              type="range"
              min="8"
              max="24"
              step="1"
              value={physicsParams.collisionRadius}
              onChange={(e) => {
                setPhysicsParams((p) => ({
                  ...p,
                  collisionRadius: Number.parseInt(e.target.value, 10),
                }));
                reheatSimulation();
              }}
              className="range range-xs range-warning w-full"
            />
          </div>

          <p className="text-[10px] text-amber-100/40 italic pt-1">
            ※ 磁石やドットはマウスでドラッグして動かすことができます。
          </p>
        </div>
      )}

      {/* Main Interactive SVG */}
      <div className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full h-full block"
          role="img"
          aria-label="コーヒー豆の多極引力モデル可視化ネットワーク"
        >
          <title>コーヒー豆の多極引力モデル可視化ネットワーク</title>
          {/* SVG Definitions */}
          <defs>
            <filter id="glow-link" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation="2.5"
                result="blur"
              />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter
              id="anchor-glow"
              x="-70%"
              y="-70%"
              width="240%"
              height="240%"
            >
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation="6"
                result="blur"
              />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {data?.anchors?.map((anchor) => (
              <radialGradient
                key={`grad-${anchor.id}`}
                id={`grad-${anchor.id}`}
                cx="35%"
                cy="35%"
                r="65%"
              >
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                <stop offset="40%" stopColor={anchor.color} />
                <stop offset="100%" stopColor={anchor.accent} />
              </radialGradient>
            ))}

            <radialGradient id="center-bg-gradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3d2a1d" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#221914" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#140f0c" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>

        {/* Hover Mini Tooltip */}
        {hoveredBean && !selectedCoffee && (
          <div
            className="absolute pointer-events-none z-30 transition-all duration-100 bg-neutral-900/95 backdrop-blur-md border border-amber-500/40 p-2.5 rounded-xl shadow-2xl max-w-xs text-xs"
            style={{
              left: Math.min(
                dimensions.width - 240,
                Math.max(16, (hoveredBean.x || 0) + 18),
              ),
              top: Math.min(
                dimensions.height - 130,
                Math.max(50, (hoveredBean.y || 0) - 20),
              ),
            }}
          >
            <div className="flex items-center gap-1.5 font-bold text-amber-200 line-clamp-1">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: hoveredBean.blendColor }}
              />
              {hoveredBean.title}
            </div>
            <div className="text-[11px] text-amber-100/60 mt-0.5">
              {hoveredBean.roaster}・{hoveredBean.country}
            </div>

            {/* Flavor blend breakdown */}
            <div className="mt-2 pt-1.5 border-t border-white/10 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-amber-300 font-semibold">
                <span>引力配分 ({hoveredBean.labelCount}味)</span>
                <span>
                  {hoveredBean.isMultiLabel ? "中間地点" : "単極吸着"}
                </span>
              </div>
              <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-black/50">
                {Object.entries(hoveredBean.categoryWeights).map(([cat, w]) => {
                  const anchor = data?.anchors?.find((a) => a.id === cat);
                  return (
                    <div
                      key={cat}
                      style={{
                        width: `${w * 100}%`,
                        backgroundColor: anchor?.color ?? "#888",
                      }}
                      title={`${cat}: ${(w * 100).toFixed(0)}%`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(hoveredBean.categoryWeights).map(([cat, w]) => {
                  const anchor = data?.anchors?.find((a) => a.id === cat);
                  return (
                    <span
                      key={cat}
                      className="text-[10px] px-1.5 py-0.2 rounded-md font-medium text-white/90"
                      style={{
                        backgroundColor: `${anchor?.color ?? "#888"}44`,
                      }}
                    >
                      {languageMode === "en" ? cat : anchor?.nameJa || cat}{" "}
                      {Math.round(w * 100)}%
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Info / Inspected Bean Drawer */}
      {inspectedBean ? (
        <div className="absolute bottom-3 left-3 right-3 z-20 bg-neutral-900/90 backdrop-blur-xl border border-amber-500/30 p-3 sm:p-4 rounded-2xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-fade-in">
          {/* Left Bean Info */}
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg border border-white/20"
              style={{
                backgroundColor: inspectedBean.blendColor,
                boxShadow: `0 0 20px ${inspectedBean.blendColor}66`,
              }}
            >
              <span className="text-white font-extrabold text-sm sm:text-base">
                {inspectedBean.labelCount}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-amber-100 truncate">
                  {inspectedBean.title}
                </h3>
                <span
                  className="badge badge-xs text-[10px] font-semibold border-none text-white"
                  style={{ backgroundColor: inspectedBean.blendColor }}
                >
                  {inspectedBean.isMultiLabel
                    ? `${inspectedBean.labelCount}味ブレンド地点`
                    : "単極（磁石周辺）"}
                </span>
                {inspectedBean.altitude && (
                  <span className="text-[10px] text-amber-200/50">
                    標高: {inspectedBean.altitude}
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-100/70 truncate mt-0.5">
                {inspectedBean.roaster} ・ {inspectedBean.country} ・ 製法:{" "}
                {inspectedBean.process}
              </p>
            </div>
          </div>

          {/* Center: Gravity Blend Weights */}
          <div className="w-full md:w-80 flex flex-col gap-1.5 shrink-0">
            <div className="flex justify-between items-center text-[11px] text-amber-200/80 font-medium">
              <span>引力バランス (磁石からの引力比率)</span>
              <span className="font-mono text-amber-400">
                計 {inspectedBean.tagCount} 個の味タグ
              </span>
            </div>

            {/* Stacked Percentage Bar */}
            <div className="h-2.5 w-full rounded-full overflow-hidden bg-black/60 flex shadow-inner">
              {Object.entries(inspectedBean.categoryWeights).map(([cat, w]) => {
                const anchor = data?.anchors?.find((a) => a.id === cat);
                return (
                  <div
                    key={cat}
                    style={{
                      width: `${w * 100}%`,
                      backgroundColor: anchor?.color ?? "#888",
                    }}
                    className="h-full transition-all duration-300"
                    title={`${cat}: ${(w * 100).toFixed(0)}%`}
                  />
                );
              })}
            </div>

            {/* Badges with exact weights */}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(inspectedBean.categoryWeights).map(([cat, w]) => {
                const anchor = data?.anchors?.find((a) => a.id === cat);
                return (
                  <span
                    key={cat}
                    className="text-[10px] px-2 py-0.5 rounded-md font-semibold text-white flex items-center gap-1 shadow-xs"
                    style={{ backgroundColor: anchor?.color ?? "#888" }}
                  >
                    <span>
                      {languageMode === "en" ? cat : anchor?.nameJa || cat}
                    </span>
                    <span className="font-mono bg-black/30 px-1 rounded">
                      {Math.round(w * 100)}%
                    </span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Right Action: Open Full Detail */}
          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            <button
              type="button"
              onClick={() => onOpenDetail?.(inspectedBean)}
              className="btn btn-sm bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold rounded-xl border-none shadow-md flex items-center gap-1.5"
            >
              <span>詳細を見る</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      ) : activeAnchor ? (
        /* Anchor Category Guide */
        <div className="absolute bottom-3 left-3 right-3 z-20 bg-neutral-900/90 backdrop-blur-xl border border-amber-500/30 p-3 sm:p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-lg"
              style={{ backgroundColor: activeAnchor.color }}
            >
              {activeAnchor.beanCount}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-amber-200 text-sm sm:text-base">
                  {languageMode === "en"
                    ? activeAnchor.name
                    : activeAnchor.nameJa}{" "}
                  磁石
                </h4>
                <span className="badge badge-xs badge-outline text-amber-300">
                  {activeAnchor.beanCount} 銘柄がこの引力を保持
                </span>
              </div>
              <p className="text-xs text-amber-100/60 mt-0.5">
                {activeAnchor.description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedAnchorId(null)}
            className="btn btn-xs btn-ghost text-amber-200/60 hover:text-white"
          >
            フィルター解除
          </button>
        </div>
      ) : (
        /* Default Concept Tip */
        <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none hidden sm:flex items-center justify-between text-[11px] text-amber-200/50 bg-black/40 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/5">
          <div className="flex items-center gap-2">
            <Info size={13} className="text-amber-400" />
            <span>
              💡
              外周の磁石が味カテゴリ。複数の味を持つ豆は、それぞれの引力の合力により中間地点に静止します。
            </span>
          </div>
          <span className="font-mono">
            全 {data?.metadata?.totalBeans ?? 100} 銘柄 /{" "}
            {data?.anchors?.length ?? 6} 極
          </span>
        </div>
      )}
    </div>
  );
}
