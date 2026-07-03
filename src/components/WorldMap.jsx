import * as d3geo from "d3-geo";
import { select } from "d3-selection";
import { zoom } from "d3-zoom";
import { useEffect, useMemo, useRef, useState } from "react";
import * as topojson from "topojson-client";
import worldTopoJson from "../data/world-110m.json";
import { clusterColor } from "../lib/clusters";
import { coffeeData } from "../lib/coffeeData";
import { translateCountry } from "../lib/countryNames";

import MapLegend from "./MapLegend";
import MethodPopup from "./MethodPopup";

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

  const width = typeof window !== "undefined" ? window.innerWidth : 1200;
  const height = typeof window !== "undefined" ? window.innerHeight : 800;

  // 世界地図データ
  const geoFeatures = useMemo(() => {
    return topojson.feature(worldTopoJson, worldTopoJson.objects.countries)
      .features;
  }, []);

  // Projection
  const projection = useMemo(() => {
    return d3geo
      .geoMercator()
      .scale(180)
      .translate([width / 2, height / 1.5]);
  }, [width, height]);

  const pathGenerator = useMemo(() => {
    return d3geo.geoPath().projection(projection);
  }, [projection]);

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
      .on("zoom", (event) => {
        select(gRef.current).attr("transform", event.transform);
      });
    svg.call(zoomBehavior);
  }, []);

  const handleCountryClick = (e, geoName) => {
    e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();

    const nodes = filteredNodesByGeoName[geoName];
    if (nodes && nodes.length > 0) {
      // 一番サンプル数が多い精製方法をデフォルト選択
      const topNode = [...nodes].sort(
        (a, b) => b.sampleCount - a.sampleCount,
      )[0];
      onSelectCoffee(topNode);
    }

    setPopupInfo({
      geoName,
      x: Math.min(e.clientX - rect.left, width - 600), // 2ウィンドウ分の見切れ防止
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
          {geoFeatures.map((geo) => {
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
                d={pathGenerator(geo)}
                fill={fill}
                stroke={isCountryRecommended ? "#eab308" : "#f8fafc"}
                strokeWidth={isCountryRecommended ? 2.5 : 0.5}
                className={
                  hasData
                    ? "cursor-pointer hover:opacity-80 transition-opacity"
                    : ""
                }
                onClick={(e) => hasData && handleCountryClick(e, geoName)}
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
                onClick={(e) => hasData && handleCountryClick(e, geoName)}
              />
            );
          })()}
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
