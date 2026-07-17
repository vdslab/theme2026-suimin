import * as d3geo from "d3-geo";
import { select } from "d3-selection";
import "d3-transition"; // select(...).transition() を有効化（zoom.transformのアニメーション用）
import { zoom, zoomIdentity, zoomTransform } from "d3-zoom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as topojson from "topojson-client";
import worldTopoJson from "../data/world-110m.json";
import { clusterColor } from "../lib/clusters";
import { coffeeData, nearestByTaste } from "../lib/coffeeData";
import { translateCountry } from "../lib/countryNames";

import MapLegend from "./MapLegend";
import MethodPopup from "./MethodPopup";

// 精製方法を選ぶと DetailPanel (App.jsx の w-96) が右からスライドインするため、
// ポップアップがその下に潜り込まないよう右端に余白を確保する
const DETAIL_PANEL_WIDTH = 384;
const POPUP_WIDTH = 560;
// 味覚クラスタ凡例（左下）を避けるための、ポップアップの想定高さ
const POPUP_HEIGHT = 360;

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
  popupRequest = 0,
}) {
  const [activeCluster, setActiveCluster] = useState(null);
  const [popupInfo, setPopupInfo] = useState(null); // { geoName, x, y }
  const [sliderValues, setSliderValues] = useState({});

  const similarCoffeeIds = useMemo(() => {
    if (!selectedCoffee) return new Set();
    const neighbors = nearestByTaste(selectedCoffee, 3);
    return new Set(neighbors.map((n) => n.id));
  }, [selectedCoffee]);

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
          node.admin1 || "",
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

  // 地図に点を打つための平坦なノード配列（検索フィルタ反映済み）
  const filteredNodeList = useMemo(() => {
    const list = Object.values(filteredNodesByGeoName).flat();
    // 描画順を制御するため、強調されるノードを配列の後ろに移動（z-indexの代わり）
    return list.sort((a, b) => {
      const getZIndex = (node) => {
        const isRecommended = recommendedCoffee?.id === node.id;
        const isSelected = selectedCoffee?.id === node.id;
        const isSimilar = selectedCoffee
          ? similarCoffeeIds.has(node.id)
          : false;
        const isDrank = !!drankCoffees[node.id];

        if (isRecommended) return 4;
        if (isSelected) return 3;
        if (isSimilar) return 2;
        if (isDrank) return 1;
        return 0;
      };
      return getZIndex(a) - getZIndex(b);
    });
  }, [
    filteredNodesByGeoName,
    recommendedCoffee,
    selectedCoffee,
    similarCoffeeIds,
    drankCoffees,
  ]);

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

  // 指定した経緯度が見えている画面中央（詳細パネルを避けた位置）に来るよう、パンをアニメーションで寄せる。
  const animateCenterTo = useCallback(
    (coord) => {
      const svgNode = svgRef.current;
      if (!svgNode || !zoomRef.current || !coord) return;
      const projected = projection(coord);
      if (!projected) return;

      const [px, py] = projected;
      const current = zoomTransform(svgNode);
      const k = current.k;
      const period = worldWidth * k;

      // 詳細パネル(幅384px)を考慮した、見えている領域の中心
      const visibleCenterX = (width - 384) / 2;
      const visibleCenterY = height / 2;

      // その点が画面中央に来るためのパン量。
      let targetX = visibleCenterX - px * k;
      const targetY = visibleCenterY - py * k;

      // 現在位置に最も近い周期を選び、最短距離で寄せる（世界を何周もしない）。
      targetX += Math.round((current.x - targetX) / period) * period;

      select(svgNode)
        .transition()
        .duration(600)
        .call(
          zoomRef.current.transform,
          zoomIdentity.translate(targetX, targetY).scale(k),
        );
    },
    [projection, width, height, worldWidth],
  );

  // 外部から豆が選択されたとき（おすすめ、味が近い豆など）、その場所へパンする
  useEffect(() => {
    if (
      selectedCoffee &&
      selectedCoffee.lng != null &&
      selectedCoffee.lat != null
    ) {
      animateCenterTo([selectedCoffee.lng, selectedCoffee.lat]);
    }
  }, [selectedCoffee, animateCenterTo]);

  // 対象の豆の画面上の位置を求めて、ポップアップ表示用の情報を作る。
  const computePopupInfo = useCallback(
    (coffee) => {
      const geoName = mapCountryName(coffee.country);
      let cx;
      let cy;
      if (coffee.lng != null && coffee.lat != null) {
        [cx, cy] = projection([coffee.lng, coffee.lat]) || [0, 0];
      } else if (geoName === "Hawaii") {
        [cx, cy] = projection([-155.5828, 19.8968]) || [0, 0];
      } else {
        const geo = geoFeatures.find((g) => g.properties.name === geoName);
        if (!geo) return { geoName, coffeeId: coffee.id, x: 0, y: 0 };
        [cx, cy] = pathGenerator.centroid(geo);
      }
      const transform = zoomTransformRef.current;
      const [rawSx, sy] = transform.apply([cx, cy]);
      // 横方向は無限スクロールで折り返すため、画面中央に最も近いコピーの位置を採用する
      const period = worldWidth * transform.k;
      const sx = rawSx - Math.round((rawSx - width / 2) / period) * period;

      const x = Math.max(
        0,
        Math.min(sx, width - DETAIL_PANEL_WIDTH - POPUP_WIDTH),
      );
      const y = Math.max(0, Math.min(sy, height - 300));
      return { geoName, coffeeId: coffee.id, x, y };
    },
    [geoFeatures, pathGenerator, projection, width, height, worldWidth],
  );

  // DetailPanel の「味が近い豆」など、地図外から別の国の豆が選択されたとき、
  // 開いているポップアップをその豆に追従させ、正しい国と精製方法を表示する。
  useEffect(() => {
    if (!selectedCoffee) return;
    const geoName = mapCountryName(selectedCoffee.country);
    setPopupInfo((prev) => {
      // ポップアップが閉じている、または既に同じ豆を表示中なら何もしない
      if (
        !prev ||
        (prev.geoName === geoName && prev.coffeeId === selectedCoffee.id)
      )
        return prev;
      return computePopupInfo(selectedCoffee);
    });
  }, [selectedCoffee, computePopupInfo]);

  // 飲んだ豆リストから選ばれたとき(popupRequestが進んだとき)は、
  // ポップアップが閉じていても新規に開く。selectedCoffeeだけの変化では開かない。
  const lastPopupRequestRef = useRef(0);
  useEffect(() => {
    if (popupRequest === lastPopupRequestRef.current) return;
    lastPopupRequestRef.current = popupRequest;
    if (popupRequest === 0 || !selectedCoffee) return;
    setPopupInfo(computePopupInfo(selectedCoffee));
  }, [popupRequest, selectedCoffee, computePopupInfo]);

  const handleCountryClick = (e, geoName, geo = null) => {
    e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();

    if (geo) {
      animateCenterTo(d3geo.geoCentroid(geo));
    }

    const nodes = filteredNodesByGeoName[geoName];
    let topNode = null;
    if (nodes && nodes.length > 0) {
      topNode = [...nodes].sort((a, b) => b.sampleCount - a.sampleCount)[0];
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

    setPopupInfo({ geoName, coffeeId: topNode?.id, x, y });
  };

  // 地図上の産地(点)クリック: その産地ノードを選択し、近くにポップアップを出す。
  const handlePointClick = (e, node) => {
    e.stopPropagation();
    if (node.lng != null && node.lat != null) {
      animateCenterTo([node.lng, node.lat]);
    }
    onSelectCoffee(node);

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(e.clientX - rect.left, width - DETAIL_PANEL_WIDTH - POPUP_WIDTH),
    );
    let y = Math.min(e.clientY - rect.top, height - 300);

    // 左下の凡例と重なる位置なら、その上に収まるよう持ち上げる
    const legend = legendRef.current;
    if (legend) {
      const lr = legend.getBoundingClientRect();
      const legendLeft = lr.left - rect.left;
      const legendRight = lr.right - rect.left;
      const legendTop = lr.top - rect.top;
      if (x < legendRight && x + POPUP_WIDTH > legendLeft) {
        y = Math.max(0, Math.min(y, legendTop - POPUP_HEIGHT));
      }
    }
    setPopupInfo({
      geoName: mapCountryName(node.country),
      coffeeId: node.id,
      x,
      y,
    });
  };

  const handleSliderChange = (id, val) => {
    setSliderValues((prev) => ({ ...prev, [id]: val }));
  };

  const toggleCluster = (name) =>
    setActiveCluster((prev) => (prev === name ? null : name));

  // コーヒーベルト(南北回帰線±23.4°)と赤道の描画用Y座標。
  // メルカトル図法では緯線は水平なので、経度は任意でよい。
  const TROPIC = 25;
  const yEquator = projection([centerLng, 0])?.[1] ?? 0;
  const yCancer = projection([centerLng, TROPIC])?.[1] ?? 0; // 北回帰線
  const yCapricorn = projection([centerLng, -TROPIC])?.[1] ?? 0; // 南回帰線

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
        <g ref={gRef} className="countries">
          {worldCopyOffsets.map((offsetX) => (
            <g
              key={`world-copy-${offsetX}`}
              transform={`translate(${offsetX},0)`}
            >
              {geoFeatures.map((geo, geoIdx) => {
                const geoName = geo.properties.name;
                const hasData = !!filteredNodesByGeoName[geoName];
                // 点(産地)を主役にするため、国の塗りは控えめに。
                // データのある国はうっすら色づけ、無い国はグレー。
                const fill = hasData ? "#fde9d0" : "#e2e8f0";

                return (
                  // biome-ignore lint/a11y/noStaticElementInteractions: SVG map path
                  <path
                    key={`geo-${geoName}`}
                    d={geoPaths[geoIdx]}
                    fill={fill}
                    stroke="#f8fafc"
                    strokeWidth={0.5}
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
                const fill = hasData ? "#fde9d0" : "#e2e8f0";
                const [hx, hy] = projection([-155.5828, 19.8968]) || [0, 0];

                return (
                  // biome-ignore lint/a11y/noStaticElementInteractions: SVG map circle
                  <circle
                    cx={hx}
                    cy={hy}
                    r={8}
                    fill={fill}
                    stroke="#f8fafc"
                    strokeWidth={0.5}
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

              {/* コーヒーベルト(南北回帰線の間)を薄く塗り、回帰線と赤道を引く。
                  クリックを邪魔しないよう pointerEvents は無効。 */}
              <rect
                x={0}
                y={yCancer}
                width={worldWidth}
                height={yCapricorn - yCancer}
                fill="#f59e0b"
                opacity={0.12}
                pointerEvents="none"
              />
              <line
                x1={0}
                x2={worldWidth}
                y1={yCancer}
                y2={yCancer}
                stroke="#f59e0b"
                strokeWidth={0.8}
                strokeDasharray="4 4"
                opacity={0.55}
                pointerEvents="none"
              />
              <line
                x1={0}
                x2={worldWidth}
                y1={yCapricorn}
                y2={yCapricorn}
                stroke="#f59e0b"
                strokeWidth={0.8}
                strokeDasharray="4 4"
                opacity={0.55}
                pointerEvents="none"
              />
              <line
                x1={0}
                x2={worldWidth}
                y1={yEquator}
                y2={yEquator}
                stroke="#ef4444"
                strokeWidth={1}
                strokeDasharray="6 4"
                opacity={0.7}
                pointerEvents="none"
              />

              {/* 産地(admin1)の点。UMAP座標ではなく地理座標[lng,lat]に配置する。 */}
              {filteredNodeList.map((node) => {
                if (node.lng == null || node.lat == null) return null;
                const projected = projection([node.lng, node.lat]);
                if (!projected) return null;
                const [px, py] = projected;

                const isRecommended = recommendedCoffee?.id === node.id;
                const isSelected = selectedCoffee?.id === node.id;
                const isDrank = !!drankCoffees[node.id];
                const isSimilar = selectedCoffee
                  ? similarCoffeeIds.has(node.id)
                  : false;

                // Opacity logic based on user rules
                let opacity = 1;
                const isFilteredOut =
                  activeCluster !== null && activeCluster !== node.clusterName;
                if (isFilteredOut) {
                  opacity = 0.12;
                } else if (recommendedCoffee) {
                  // "おすすめを計算する"が実行中: 計算結果の豆と飲んだ豆以外を暗くする
                  if (!isDrank && !isRecommended) opacity = 0.3;
                } else if (selectedCoffee) {
                  if (!isSelected && !isSimilar) opacity = 0.3;
                }
                // 何も選択されていない時は、未飲豆のグレーアウトはしない

                // Radius and stroke logic
                let r = 3.5;
                let strokeColor = "#ffffff";
                let strokeWidth = 0.7;

                if (isSelected || isSimilar) {
                  r += 2; // 少し大きくなるだけ
                }

                if (isRecommended) {
                  if (!isSelected && !isSimilar) r += 2; // 重複して大きくならないように
                  strokeColor = "#eab308";
                  strokeWidth = 2;
                }

                return (
                  <g key={`pt-${node.id}`}>
                    {(isDrank || isSelected) && (
                      <circle
                        cx={px}
                        cy={py}
                        r={r + 1.5}
                        fill="none"
                        stroke="#000000"
                        strokeWidth={0.5}
                        opacity={opacity}
                      />
                    )}
                    {isRecommended && (
                      <circle
                        cx={px}
                        cy={py}
                        r={r}
                        fill="none"
                        stroke="#eab308"
                        strokeWidth={2}
                      >
                        <animate
                          attributeName="r"
                          values={`${r};${r + 15}`}
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="1;0"
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: SVG map point */}
                    <circle
                      cx={px}
                      cy={py}
                      r={r}
                      fill={clusterColor(node.clusterName)}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      opacity={opacity}
                      className="cursor-pointer transition-opacity hover:opacity-80"
                      onClick={(e) => handlePointClick(e, node)}
                    />
                  </g>
                );
              })}
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
