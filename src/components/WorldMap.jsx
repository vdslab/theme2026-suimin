import * as d3geo from "d3-geo";
import { select } from "d3-selection";
import "d3-transition"; // select(...).transition() を有効化（zoom.transformのアニメーション用）
import { zoom, zoomIdentity, zoomTransform } from "d3-zoom";
import { useEffect, useMemo, useRef, useState } from "react";
import * as topojson from "topojson-client";
import worldTopoJson from "../data/world-110m.json";
import { clusterColor } from "../lib/clusters";
import { coffeeData } from "../lib/coffeeData";
import { translateCountry } from "../lib/countryNames";

import MapLegend from "./MapLegend";
import MethodPopup from "./MethodPopup";

// メルカトル図法の投影スケールと、地球1周分の投影後の幅（px）
const MAP_SCALE = 180;
const WORLD_WIDTH = 2 * Math.PI * MAP_SCALE;

// TopoJSONのnameとcoffeeDataのcountryをマッピング
const mapCountryName = (c) => {
  if (c === "Tanzania, United Republic Of") return "Tanzania";
  if (c === "United States") return "United States of America";
  if (c === "United States (Hawaii)") return "Hawaii";
  if (c === "United States (Puerto Rico)") return "Puerto Rico";
  return c;
};

export default function WorldMap({
  selectedCoffee,
  onSelectCoffee,
  searchQuery,
  drankCoffees = {},
  onUpdateDrank,
  onRemoveDrank,
  recommendedCoffee,
}) {
  const [activeCluster, setActiveCluster] = useState(null);
  const [popupInfo, setPopupInfo] = useState(null); // { geoName, x, y }
  const [sliderValues, setSliderValues] = useState({});

  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const zoomRef = useRef(null);

  const [{ width, height }, setDimensions] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 世界地図データ
  const geoFeatures = useMemo(() => {
    return topojson.feature(worldTopoJson, worldTopoJson.objects.countries)
      .features;
  }, []);

  // 描画の初期位置（経度）が日本。再センタリングはパンのアニメーションで行うため固定。
  const centerLng = 139;
  // Projection
  const projection = useMemo(() => {
    return d3geo
      .geoMercator()
      .rotate([-centerLng, 0])
      .scale(MAP_SCALE)
      .translate([width / 2, height / 1.5]);
  }, [width, height]);

  // 横方向に無限スクロールさせるための世界地図コピーのxオフセット群。
  // 画面幅を覆うのに必要な数だけ、中央を挟んで左右対称に並べる。
  const worldCopyOffsets = useMemo(() => {
    const n = Math.ceil(width / (2 * WORLD_WIDTH)) + 1;
    const offsets = [];
    for (let i = -n; i <= n; i++) offsets.push(i * WORLD_WIDTH);
    return offsets;
  }, [width]);

  const pathGenerator = useMemo(() => {
    return d3geo.geoPath().projection(projection);
  }, [projection]);

  // 各国のパス文字列は投影が変わったときだけ再計算し、コピー間で使い回す。
  // （コピー枚数ぶん geoPath を再生成する無駄を防ぐ）
  const geoPaths = useMemo(
    () => geoFeatures.map((geo) => pathGenerator(geo)),
    [geoFeatures, pathGenerator],
  );

  // 描画される陸地全体の縦方向の範囲（投影後px, スケール前）。
  // 縦パンを陸地の外（＝空白の海）まで動かさないためのクランプに使う。
  const worldBounds = useMemo(
    () =>
      pathGenerator.bounds({
        type: "FeatureCollection",
        features: geoFeatures,
      }),
    [pathGenerator, geoFeatures],
  );

  // constrain は zoom の初期化 effect（deps []）から参照するため、
  // 最新値を ref 経由で渡す。
  const clampRef = useRef({ bounds: worldBounds, width, height });
  clampRef.current = { bounds: worldBounds, width, height };

  // ノードのグループ化（検索・フィルタ反映）
  const filteredNodesByGeoName = useMemo(() => {
    const rawQuery = (searchQuery || "").trim();
    let regex = null;
    let isRegexValid = false;

    if (rawQuery) {
      try {
        regex = new RegExp(rawQuery, "i");
        isRegexValid = true;
      } catch (_e) {
        // 正規表現として無効な場合は通常の文字列検索にフォールバック
      }
    }

    const queryLower = rawQuery.toLowerCase();
    const map = {};

    coffeeData.forEach((node) => {
      let matchesSearch = false;
      if (!rawQuery) {
        matchesSearch = true;
      } else {
        const targets = [
          translateCountry(node.country) || "",
          node.country || "",
          node.method || "",
          node.name || "",
          (node.varieties || []).join(" "),
        ];

        if (isRegexValid) {
          matchesSearch = targets.some((str) => regex.test(str));
        } else {
          matchesSearch = targets.some((str) =>
            str.toLowerCase().includes(queryLower),
          );
        }
      }

      if (matchesSearch) {
        const geoName = mapCountryName(node.country);
        if (!map[geoName]) map[geoName] = [];
        map[geoName].push(node);
      }
    });
    return map;
  }, [searchQuery]);

  // ズーム設定
  useEffect(() => {
    const svg = select(svgRef.current);
    const zoomBehavior = zoom()
      .scaleExtent([1, 8])
      .extent([
        [0, 0],
        [clampRef.current.width, clampRef.current.height],
      ])
      // 縦(y)だけを陸地の範囲内にクランプする
      .constrain((transform, extent) => {
        const { bounds } = clampRef.current;
        const k = transform.k;
        const top = bounds[0][1] * k; // 陸地上端の画面y（translate前）
        const bottom = bounds[1][1] * k; // 陸地下端の画面y（translate前）
        const viewTop = extent[0][1];
        const viewBottom = extent[1][1];
        const viewH = viewBottom - viewTop;

        let y = transform.y;
        if (bottom - top <= viewH) {
          y = viewTop + (viewH - (top + bottom)) / 2;
        } else {
          y = Math.min(viewTop - top, Math.max(viewBottom - bottom, y));
        }
        return zoomIdentity.translate(transform.x, y).scale(k);
      })
      .on("zoom", (event) => {
        const { x, y, k } = event.transform;
        const period = WORLD_WIDTH * k;
        const wrappedX = x - Math.round(x / period) * period;
        select(gRef.current).attr(
          "transform",
          `translate(${wrappedX},${y}) scale(${k})`,
        );
      });
    zoomRef.current = zoomBehavior;
    svg.call(zoomBehavior);
    svg.call(zoomBehavior.transform, zoomIdentity);
  }, []);

  useEffect(() => {
    if (zoomRef.current) {
      zoomRef.current.extent([
        [0, 0],
        [width, height],
      ]);
    }
  }, [width, height]);

  // 指定した経緯度が画面中央（横方向）に来るよう、パンをアニメーションで寄せる。
  const animateCenterTo = (coord) => {
    const svgNode = svgRef.current;
    if (!svgNode || !zoomRef.current || !coord) return;
    const projected = projection(coord);
    if (!projected) return;

    const [px] = projected;
    const current = zoomTransform(svgNode);
    const k = current.k;
    const period = WORLD_WIDTH * k;

    // その点が画面中央に来るためのパン量。
    let targetX = width / 2 - px * k;
    // 現在位置に最も近い周期を選び、最短距離で寄せる（世界を何周もしない）。
    targetX += Math.round((current.x - targetX) / period) * period;

    select(svgNode)
      .transition()
      .duration(600)
      .call(
        zoomRef.current.transform,
        zoomIdentity.translate(targetX, current.y).scale(k),
      );
  };

  const handleCountryClick = (e, geoName, geo = null) => {
    e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();

    if (geo) {
      animateCenterTo(d3geo.geoCentroid(geo));
    }

    const nodes = filteredNodesByGeoName[geoName];
    if (nodes && nodes.length > 0) {
      const topNode = [...nodes].sort(
        (a, b) => b.sampleCount - a.sampleCount,
      )[0];
      onSelectCoffee(topNode);
    }

    setPopupInfo({
      geoName,
      x: Math.min(e.clientX - rect.left, width - 600),
      y: Math.min(e.clientY - rect.top, height - 300),
    });
  };

  const handleSliderChange = (id, val) => {
    setSliderValues((prev) => ({ ...prev, [id]: val }));
  };

  const toggleCluster = (name) =>
    setActiveCluster((prev) => (prev === name ? null : name));

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Map interaction is pointer-driven */}
      <svg
        role="application"
        aria-label="Coffee World Map"
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        className="absolute inset-0 select-none bg-[#e0f2fe]"
        onClick={() => {
          onSelectCoffee(null);
          setPopupInfo(null);
        }}
      >
        <defs>
          {Object.entries(filteredNodesByGeoName).map(([geoName, nodes]) => {
            const totalSamples = nodes.reduce(
              (sum, n) => sum + n.sampleCount,
              0,
            );
            let currentX = 0;
            const patternWidth = 24; // 縞模様の太さ

            return (
              <pattern
                key={geoName}
                id={`pattern-${geoName.replace(/[^a-zA-Z0-9]/g, "-")}`}
                width={patternWidth}
                height={patternWidth}
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                {nodes.map((node) => {
                  const ratio = node.sampleCount / totalSamples;
                  const stripeWidth = ratio * patternWidth;

                  const isHighlighted =
                    selectedCoffee?.id === node.id ||
                    recommendedCoffee?.id === node.id;
                  const isAnyHighlighted = !!(
                    selectedCoffee || recommendedCoffee
                  );
                  const isFilteredOut =
                    activeCluster !== null &&
                    activeCluster !== node.clusterName;

                  let opacity = 1;
                  if (isFilteredOut) opacity = 0.15;
                  else if (isAnyHighlighted && !isHighlighted) opacity = 0.25;

                  const color =
                    node.blendedColor || clusterColor(node.clusterName);

                  const rect = (
                    <rect
                      key={node.id}
                      x={currentX}
                      width={stripeWidth}
                      height={patternWidth}
                      fill={color}
                      opacity={opacity}
                    />
                  );
                  currentX += stripeWidth;
                  return rect;
                })}
              </pattern>
            );
          })}
        </defs>

        <g ref={gRef} className="countries">
          {worldCopyOffsets.map((offsetX) => (
            <g
              key={`world-copy-${offsetX}`}
              transform={`translate(${offsetX},0)`}
            >
              {geoFeatures.map((geo, geoIdx) => {
                const geoName = geo.properties.name;
                const hasData = !!filteredNodesByGeoName[geoName];
                const fill = hasData
                  ? `url(#pattern-${geoName.replace(/[^a-zA-Z0-9]/g, "-")})`
                  : "#cbd5e1";

                // おすすめハイライト時の国の枠線強調
                const isCountryRecommended =
                  recommendedCoffee &&
                  mapCountryName(recommendedCoffee.country) === geoName;

                return (
                  // biome-ignore lint/a11y/noStaticElementInteractions: SVG map path
                  <path
                    key={`geo-${geoName}`}
                    d={geoPaths[geoIdx]}
                    fill={fill}
                    stroke={isCountryRecommended ? "#eab308" : "#f8fafc"}
                    strokeWidth={isCountryRecommended ? 2.5 : 0.5}
                    className={
                      hasData
                        ? "cursor-pointer hover:opacity-80 transition-opacity"
                        : ""
                    }
                    onClick={(e) =>
                      hasData && handleCountryClick(e, geoName, geo)
                    }
                  />
                );
              })}

              {/* ハワイを別途描画（110m地図だと省略されたり小さすぎたりするため） */}
              {(() => {
                const geoName = "Hawaii";
                const hasData = !!filteredNodesByGeoName[geoName];
                if (!hasData && !recommendedCoffee) return null;
                const fill = hasData ? `url(#pattern-Hawaii)` : "#cbd5e1";
                const [hx, hy] = projection([-155.5828, 19.8968]) || [0, 0];
                const isCountryRecommended =
                  recommendedCoffee &&
                  mapCountryName(recommendedCoffee.country) === geoName;

                return (
                  // biome-ignore lint/a11y/noStaticElementInteractions: SVG map circle
                  <circle
                    cx={hx}
                    cy={hy}
                    r={8}
                    fill={fill}
                    stroke={isCountryRecommended ? "#eab308" : "#f8fafc"}
                    strokeWidth={isCountryRecommended ? 2.5 : 0.5}
                    className={
                      hasData
                        ? "cursor-pointer hover:opacity-80 transition-opacity"
                        : ""
                    }
                    onClick={(e) => {
                      if (hasData) {
                        animateCenterTo([-155.5828, 19.8968]);
                        handleCountryClick(e, geoName);
                      }
                    }}
                  />
                );
              })()}
            </g>
          ))}
        </g>
      </svg>

      <MapLegend
        activeCluster={activeCluster}
        toggleCluster={toggleCluster}
        setActiveCluster={setActiveCluster}
      />

      {popupInfo && (
        <MethodPopup
          popupInfo={popupInfo}
          setPopupInfo={setPopupInfo}
          nodes={filteredNodesByGeoName[popupInfo.geoName]}
          selectedCoffee={selectedCoffee}
          onSelectCoffee={onSelectCoffee}
          sliderValues={sliderValues}
          handleSliderChange={handleSliderChange}
          drankCoffees={drankCoffees}
          onRemoveDrank={onRemoveDrank}
          onUpdateDrank={onUpdateDrank}
        />
      )}
    </div>
  );
}
