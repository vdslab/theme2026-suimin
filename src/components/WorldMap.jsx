import * as d3geo from "d3-geo";
import { select } from "d3-selection";
import "d3-transition"; // select(...).transition() を有効化（zoom.transformのアニメーション用）
import { Delaunay } from "d3-delaunay";
import { zoom, zoomIdentity, zoomTransform } from "d3-zoom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as topojson from "topojson-client";
import worldTopoJson from "../data/world-110m.json";
import { clusterColor } from "../lib/clusters";
import { coffeeData } from "../lib/coffeeData";
import { translateCountry } from "../lib/countryNames";

import MapLegend from "./MapLegend";
import MethodPopup from "./MethodPopup";

// 精製方法を選ぶと DetailPanel (App.jsx の w-96) が右からスライドインするため、
// ポップアップがその下に潜り込まないよう右端に余白を確保する
const DETAIL_PANEL_WIDTH = 384;
const POPUP_WIDTH = 560;
// 味覚クラスタ凡例（左下）を避けるための、ポップアップの想定高さ
const POPUP_HEIGHT = 360;

// GeoKeyと名義を取得するユーティリティ
const getGeoKey = (node) =>
  node.admin1_code
    ? `admin1-${node.admin1_code}`
    : `point-${node.lat}-${node.lng}`;

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
  const [popupInfo, setPopupInfo] = useState(null); // { geoKey, regionName, x, y }
  const [sliderValues, setSliderValues] = useState({});

  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const zoomRef = useRef(null);
  const legendRef = useRef(null);
  // ズームの最新 transform を保持（外部選択時のポップアップ追従で使用）
  const zoomTransformRef = useRef(zoomIdentity);

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
  const worldWidth = width;
  const mapScale = worldWidth / (2 * Math.PI);

  // Projection
  const projection = useMemo(() => {
    return d3geo
      .geoMercator()
      .rotate([-centerLng, 0])
      .scale(mapScale)
      .translate([width / 2, height / 1.5]);
  }, [width, height, mapScale]);

  // 横ドラッグ時に地図が途切れないよう、画面外の隣接コピーを左右2枚ずつ用意する。
  // （1周=画面幅なので、静止時は中央のコピー1枚だけが見える＝重複しない）
  const worldCopyOffsets = useMemo(() => {
    const offsets = [];
    for (let i = -2; i <= 2; i++) offsets.push(i * worldWidth);
    return offsets;
  }, [worldWidth]);

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
  const filteredNodesByLocation = useMemo(() => {
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
          node.region || "",
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
        const geoKey = getGeoKey(node);
        if (!map[geoKey]) map[geoKey] = [];
        map[geoKey].push(node);
      }
    });
    return map;
  }, [searchQuery]);

  // 国ごとに地域（geoKey）とその代表座標をまとめる
  const regionsByCountry = useMemo(() => {
    const map = {};
    Object.entries(filteredNodesByLocation).forEach(([geoKey, nodes]) => {
      const firstNode = nodes[0];

      // GeoJSON(world-110m)の国名にマッピングする
      const matchedGeo = geoFeatures.find(
        (g) =>
          g.properties.name === firstNode.country ||
          translateCountry(g.properties.name) ===
            translateCountry(firstNode.country) ||
          (g.properties.name === "United States of America" &&
            firstNode.country === "United States") ||
          (g.properties.name === "Tanzania" &&
            firstNode.country.includes("Tanzania")) ||
          (g.properties.name === "Taiwan" && firstNode.country === "Taiwan"),
      );
      const cName = matchedGeo ? matchedGeo.properties.name : firstNode.country;

      if (!map[cName]) map[cName] = [];
      const [px, py] = projection([firstNode.lng, firstNode.lat]) || [0, 0];

      // 同じ座標が重なるとDelaunayがエラーになるため、微小なジッターを加える
      const isDuplicate = map[cName].some(
        (r) => r.rawPx === px && r.rawPy === py,
      );
      const jitterX = isDuplicate ? (Math.random() - 0.5) * 0.1 : 0;
      const jitterY = isDuplicate ? (Math.random() - 0.5) * 0.1 : 0;

      map[cName].push({
        geoKey,
        nodes,
        firstNode,
        rawPx: px,
        rawPy: py,
        px: px + jitterX,
        py: py + jitterY,
      });
    });
    console.log("regionsByCountry:", map);
    return map;
  }, [filteredNodesByLocation, projection, geoFeatures]);

  // 国ごとにボロノイ図を計算
  const voronoisByCountry = useMemo(() => {
    const map = {};
    Object.entries(regionsByCountry).forEach(([cName, regions]) => {
      if (regions.length > 1) {
        const points = regions.map((r) => [r.px, r.py]);
        const delaunay = Delaunay.from(points);
        // クリップパスで切り取るため、領域は画面全体以上に大きく取っておく
        const voronoi = delaunay.voronoi([
          -width * 2,
          -height * 2,
          width * 3,
          height * 3,
        ]);
        map[cName] = voronoi;
      }
    });
    return map;
  }, [regionsByCountry, width, height]);

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
        // worldWidth(=width) は初期化 effect(deps [])では古くなるため ref 経由で最新値を使う
        const period = clampRef.current.width * k;
        const wrappedX = x - Math.round(x / period) * period;
        select(gRef.current).attr(
          "transform",
          `translate(${wrappedX},${y}) scale(${k})`,
        );
        // 外部選択時のポップアップ追従で参照するため最新 transform を保持
        zoomTransformRef.current = event.transform;
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
  const animateCenterTo = useCallback(
    (coord) => {
      const svgNode = svgRef.current;
      if (!svgNode || !zoomRef.current || !coord) return;
      const projected = projection(coord);
      if (!projected) return;

      const [px] = projected;
      const current = zoomTransform(svgNode);
      const k = current.k;
      const period = worldWidth * k;

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
    },
    [projection, width, worldWidth],
  );

  // DetailPanel の「味が近い豆」など、地図外から別の豆が選択されたとき、
  // 選択された地域へパンし、開いているポップアップを追従させる。
  useEffect(() => {
    if (!selectedCoffee) return;
    const geoKey = getGeoKey(selectedCoffee);

    // パンアニメーションを実行
    const geoCoord = [selectedCoffee.lng, selectedCoffee.lat];
    if (geoCoord) {
      animateCenterTo(geoCoord);
    }

    setPopupInfo((prev) => {
      // ポップアップが閉じている、または既に同じ地域を表示中なら何もしない
      if (!prev || prev.geoKey === geoKey) return prev;

      // 対象の地域の画面上の位置を求めてポップアップを移動する
      const [cx, cy] = projection(geoCoord) || [0, 0];

      const transform = zoomTransformRef.current;
      const [rawSx, sy] = transform.apply([cx, cy]);
      const period = worldWidth * transform.k;
      const sx = rawSx - Math.round((rawSx - width / 2) / period) * period;

      const x = Math.max(
        0,
        Math.min(sx, width - DETAIL_PANEL_WIDTH - POPUP_WIDTH),
      );
      const y = Math.max(0, Math.min(sy, height - 300));
      return { geoKey, regionName: selectedCoffee.region, x, y };
    });
  }, [selectedCoffee, projection, width, height, worldWidth, animateCenterTo]);

  const handleRegionClick = (e, geoKey, regionName, geo = null) => {
    e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();

    if (geo) {
      animateCenterTo(d3geo.geoCentroid(geo));
    } else {
      const nodes = filteredNodesByLocation[geoKey];
      if (nodes && nodes.length > 0) {
        animateCenterTo([nodes[0].lng, nodes[0].lat]);
      }
    }

    const nodes = filteredNodesByLocation[geoKey];
    if (nodes && nodes.length > 0) {
      const topNode = [...nodes].sort(
        (a, b) => b.sample_count - a.sample_count,
      )[0];
      onSelectCoffee(topNode);
    }

    // 右端は DetailPanel の幅も避けてクランプ（詳細パネルと重ならないように）
    const x = Math.max(
      0,
      Math.min(e.clientX - rect.left, width - DETAIL_PANEL_WIDTH - POPUP_WIDTH),
    );
    let y = Math.min(e.clientY - rect.top, height - 300);

    // 左下の味覚クラスタ凡例と横方向で重なる位置なら、その上に収まるよう持ち上げる
    const legend = legendRef.current;
    if (legend) {
      const lr = legend.getBoundingClientRect();
      const legendLeft = lr.left - rect.left;
      const legendRight = lr.right - rect.left;
      const legendTop = lr.top - rect.top;
      const overlapsHorizontally =
        x < legendRight && x + POPUP_WIDTH > legendLeft;
      if (overlapsHorizontally) {
        y = Math.max(0, Math.min(y, legendTop - POPUP_HEIGHT));
      }
    }

    setPopupInfo({ geoKey, regionName, x, y });
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
          {Object.entries(filteredNodesByLocation).map(([geoKey, nodes]) => {
            const totalSamples = nodes.reduce(
              (sum, n) => sum + (n.sampleCount || 1),
              0,
            );
            let currentX = 0;
            const patternWidth = 24; // 縞模様の太さ

            return (
              <pattern
                key={geoKey}
                id={`pattern-${geoKey.replace(/[^a-zA-Z0-9]/g, "-")}`}
                width={patternWidth}
                height={patternWidth}
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                {nodes.map((node) => {
                  const ratio = (node.sampleCount || 1) / totalSamples;
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

                  const color = clusterColor(node.clusterName);

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

          {/* 国ごとのクリップパス定義 */}
          {geoFeatures.map((geo, geoIdx) => (
            <clipPath
              key={`clip-${geo.properties.name}`}
              id={`clip-${geo.properties.name.replace(/[^a-zA-Z0-9]/g, "-")}`}
            >
              <path d={geoPaths[geoIdx]} />
            </clipPath>
          ))}
        </defs>

        <g ref={gRef} className="countries">
          {worldCopyOffsets.map((offsetX) => (
            <g
              key={`world-copy-${offsetX}`}
              transform={`translate(${offsetX},0)`}
            >
              {geoFeatures.map((geo, geoIdx) => {
                const cName = geo.properties.name;
                const regions = regionsByCountry[cName] || [];

                // データがない場合はグレーで塗りつぶす
                if (regions.length === 0) {
                  return (
                    <path
                      key={`geo-empty-${cName}`}
                      d={geoPaths[geoIdx]}
                      fill="#cbd5e1"
                      stroke="#f8fafc"
                      strokeWidth={0.5}
                    />
                  );
                }

                // 領域が1つの場合は、国全体をその領域のパターンで塗りつぶす
                if (regions.length === 1) {
                  const region = regions[0];
                  const { geoKey } = region;
                  const fill = `url(#pattern-${geoKey.replace(/[^a-zA-Z0-9]/g, "-")})`;
                  const isRegionRecommended =
                    recommendedCoffee &&
                    getGeoKey(recommendedCoffee) === geoKey;

                  return (
                    // biome-ignore lint/a11y/noStaticElementInteractions: SVG map path
                    <path
                      key={`geo-${geoKey}`}
                      d={geoPaths[geoIdx]}
                      fill={fill}
                      stroke={isRegionRecommended ? "#eab308" : "#f8fafc"}
                      strokeWidth={isRegionRecommended ? 2.5 : 0.5}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={(e) =>
                        handleRegionClick(
                          e,
                          geoKey,
                          region.firstNode.region,
                          null,
                        )
                      }
                    />
                  );
                }

                // 領域が複数の場合は、Voronoi分割を使って国の中で領域を区切る
                const voronoi = voronoisByCountry[cName];
                const clipId = `clip-${cName.replace(/[^a-zA-Z0-9]/g, "-")}`;

                return (
                  <g
                    key={`country-group-${cName}`}
                    clipPath={`url(#${clipId})`}
                  >
                    {/* ベースの背景色（境界の隙間埋め用） */}
                    <path d={geoPaths[geoIdx]} fill="#cbd5e1" />
                    {regions.map((region, i) => {
                      const { geoKey } = region;
                      const fill = `url(#pattern-${geoKey.replace(/[^a-zA-Z0-9]/g, "-")})`;
                      const isRegionRecommended =
                        recommendedCoffee &&
                        getGeoKey(recommendedCoffee) === geoKey;
                      const cellPath = voronoi.renderCell(i);

                      return (
                        // biome-ignore lint/a11y/noStaticElementInteractions: SVG map path
                        <path
                          key={`voronoi-${geoKey}`}
                          d={cellPath}
                          fill={fill}
                          stroke={isRegionRecommended ? "#eab308" : "#f8fafc"}
                          strokeWidth={isRegionRecommended ? 2.5 : 0.5}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={(e) =>
                            handleRegionClick(
                              e,
                              geoKey,
                              region.firstNode.region,
                              null,
                            )
                          }
                        />
                      );
                    })}
                  </g>
                );
              })}

              {/* 座標のみのポイント（国のポリゴンにマッチしなかった地域用） */}
              {Object.entries(filteredNodesByLocation).map(
                ([geoKey, nodes]) => {
                  const firstNode = nodes[0];
                  const matchedGeo = geoFeatures.find(
                    (g) =>
                      g.properties.name === firstNode.country ||
                      translateCountry(g.properties.name) ===
                        translateCountry(firstNode.country) ||
                      (g.properties.name === "United States of America" &&
                        firstNode.country === "United States") ||
                      (g.properties.name === "Tanzania" &&
                        firstNode.country.includes("Tanzania")) ||
                      (g.properties.name === "Taiwan" &&
                        firstNode.country === "Taiwan"),
                  );

                  // ポリゴン描画済みならスキップ
                  if (matchedGeo) return null;

                  const fill = `url(#pattern-${geoKey.replace(/[^a-zA-Z0-9]/g, "-")})`;
                  const [hx, hy] = projection([
                    firstNode.lng,
                    firstNode.lat,
                  ]) || [0, 0];
                  const isRegionRecommended =
                    recommendedCoffee &&
                    getGeoKey(recommendedCoffee) === geoKey;

                  return (
                    // biome-ignore lint/a11y/noStaticElementInteractions: SVG map circle
                    <circle
                      key={`point-${geoKey}`}
                      cx={hx}
                      cy={hy}
                      r={6}
                      fill={fill}
                      stroke={isRegionRecommended ? "#eab308" : "#f8fafc"}
                      strokeWidth={isRegionRecommended ? 2.5 : 0.5}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={(e) =>
                        handleRegionClick(e, geoKey, firstNode.region, null)
                      }
                    />
                  );
                },
              )}
            </g>
          ))}
        </g>
      </svg>

      <MapLegend
        ref={legendRef}
        activeCluster={activeCluster}
        toggleCluster={toggleCluster}
        setActiveCluster={setActiveCluster}
      />

      {popupInfo && (
        <MethodPopup
          popupInfo={popupInfo}
          setPopupInfo={setPopupInfo}
          nodes={filteredNodesByLocation[popupInfo.geoKey]}
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
