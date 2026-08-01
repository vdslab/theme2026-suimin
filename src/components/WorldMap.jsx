import { forceCollide, forceSimulation, forceX, forceY } from "d3-force";
import * as d3geo from "d3-geo";
import { select } from "d3-selection";
import { MapPin } from "lucide-react";
import "d3-transition"; // select(...).transition() を有効化（zoom.transformのアニメーション用）
import { zoom, zoomIdentity, zoomTransform } from "d3-zoom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as topojson from "topojson-client";
import worldTopoJson from "../data/world-50m.json";
import { clusterColor } from "../lib/clusters";
import { coffeeData, nearestByTaste } from "../lib/coffeeData";
import { translateCountry } from "../lib/countryNames";
import {
  BELT_COLOR,
  BELT_FILL_OPACITY,
  BELT_LAT,
  BELT_LINE_OPACITY,
  EQUATOR_COLOR,
  EQUATOR_LINE_OPACITY,
} from "../lib/mapStyle";

import MapLegend from "./MapLegend";

// 点の基本半径(px, ズーム率1のとき)。重なり除去の衝突半径もこれを基準にする。
const NODE_BASE_R = 3.5;
// 重なり除去のパラメータ。
// バネが産地の実座標へ引き戻し、衝突が点どうしを押し離す。その釣り合いで位置が決まる。
const LAYOUT_SPRING = 0.3; // 実座標へ引き戻すバネの強さ
const LAYOUT_COLLIDE_PADDING = 0.5; // 点と点のあいだに空ける余白(px)
const LAYOUT_COLLIDE_STRENGTH = 0.85;
const LAYOUT_TICKS = 300; // 収束させるステップ数（アニメーションはさせない）

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
  recommendedCoffee,
}) {
  const [activeCluster, setActiveCluster] = useState(null);
  // ノードのホバーで表示する国・地域ツールチップ（コンテナ基準の座標）
  const [hoveredNode, setHoveredNode] = useState(null);

  const similarCoffees = useMemo(() => {
    if (!selectedCoffee) return [];
    return nearestByTaste(selectedCoffee, 3);
  }, [selectedCoffee]);

  const similarCoffeeIds = useMemo(() => {
    return new Set(similarCoffees.map((n) => n.id));
  }, [similarCoffees]);

  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const zoomRef = useRef(null);
  const legendRef = useRef(null);
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

  const geoFeatures = useMemo(() => {
    return topojson.feature(worldTopoJson, worldTopoJson.objects.countries)
      .features;
  }, []);

  // 描画の初期位置（経度）が日本。再センタリングはパンのアニメーションで行うため固定。
  const centerLng = 139;
  const worldWidth = width;
  const mapScale = worldWidth / (2 * Math.PI);

  const projection = useMemo(() => {
    return d3geo
      .geoMercator()
      .rotate([-centerLng, 0])
      .scale(mapScale)
      .translate([width / 2, height / 1.5]);
  }, [width, height, mapScale]);

  // 横ドラッグ時に地図が途切れないよう、画面外の隣接コピーを左右1枚ずつ用意する。
  // zoom側で描画位置を1周ぶん(period = 画面幅 × k)に折り返しているうえ period は
  // 常に画面幅以上なので、左右1枚ずつで画面は必ず埋まる。
  // （50mの地図はパスが重いので、コピーは必要最小限に留める）
  const worldCopyOffsets = useMemo(() => {
    const offsets = [];
    for (let i = -1; i <= 1; i++) offsets.push(i * worldWidth);
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

  // 産地(admin1)の実座標を投影し、点が重ならないように押し離した位置。
  // アンカーは国の中心ではなく産地そのものの座標なので、動くのは重なった分だけで、
  // 産地の地理的な位置関係は保たれる。
  // 投影後のpx空間で一度だけ収束させ、その結果をズーム/パン中は使い回す。
  // (点は変換後のgの中にあり、ズームすると点も一緒に拡大するので、
  //  等倍で重なりが解けていれば、どのズーム率でも重ならない)
  const nodePositions = useMemo(() => {
    const particles = [];
    coffeeData.forEach((node) => {
      if (node.lng == null || node.lat == null) return;
      const p = projection([node.lng, node.lat]);
      if (!p) return;
      particles.push({
        id: node.id,
        anchorX: p[0],
        anchorY: p[1],
        x: p[0],
        y: p[1],
      });
    });

    forceSimulation(particles)
      .force("spring-x", forceX((d) => d.anchorX).strength(LAYOUT_SPRING))
      .force("spring-y", forceY((d) => d.anchorY).strength(LAYOUT_SPRING))
      .force(
        "collide",
        forceCollide(NODE_BASE_R + LAYOUT_COLLIDE_PADDING).strength(
          LAYOUT_COLLIDE_STRENGTH,
        ),
      )
      .stop()
      .tick(LAYOUT_TICKS);

    return new Map(particles.map((p) => [p.id, [p.x, p.y]]));
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

  // 指定した投影済みの点[px,py]が見えている画面中央（詳細パネルを避けた位置）に
  // 来るよう、パンをアニメーションで寄せる。
  const animateCenterTo = useCallback(
    (point) => {
      const svgNode = svgRef.current;
      if (!svgNode || !zoomRef.current || !point) return;

      const [px, py] = point;
      const current = zoomTransform(svgNode);
      const k = current.k;
      const period = worldWidth * k;

      // 見えている領域の中心。詳細パネルに隠れない位置へ寄せる。
      // モバイル(<640px)は下部のボトムシート(約80dvh)を避け、上部の帯の中央へ。
      // デスクトップは右の詳細パネル(幅384px)を避けて左寄りの中央へ。
      const isMobile = width < 640;
      const visibleCenterX = isMobile ? width / 2 : (width - 384) / 2;
      const visibleCenterY = isMobile ? height * 0.1 : height / 2;

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
    [width, height, worldWidth],
  );

  // 外部から豆が選択されたとき（おすすめ、味が近い豆など）、その場所へパンする
  useEffect(() => {
    if (!selectedCoffee) return;
    animateCenterTo(nodePositions.get(selectedCoffee.id));
  }, [selectedCoffee, nodePositions, animateCenterTo]);

  // 地図上の産地(点)クリック: その産地ノードを選択し、詳細パネルを開く。
  const handlePointClick = (e, node) => {
    e.stopPropagation();
    animateCenterTo(nodePositions.get(node.id));
    onSelectCoffee(node);
  };

  // ノードにホバーしたとき、国・地域名をカーソル位置に表示する。
  const handleNodeHover = (e, node) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoveredNode({
      country: node.country,
      admin1: node.admin1,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const toggleCluster = (name) =>
    setActiveCluster((prev) => (prev === name ? null : name));

  // コーヒーベルト(南北 BELT_LAT 度)と赤道の描画用Y座標。
  // メルカトル図法では緯線は水平なので、経度は任意でよい。
  const yEquator = projection([centerLng, 0])?.[1] ?? 0;
  const yBeltNorth = projection([centerLng, BELT_LAT])?.[1] ?? 0;
  const yBeltSouth = projection([centerLng, -BELT_LAT])?.[1] ?? 0;

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
          // 背景クリックで凡例のクラスタ絞り込みも解除する
          setActiveCluster(null);
        }}
      >
        <g ref={gRef} className="countries">
          {/* レイヤー1: 地図（陸地と背景線） */}
          <g className="layer-map">
            {worldCopyOffsets.map((offsetX) => (
              <g
                key={`world-copy-map-${offsetX}`}
                transform={`translate(${offsetX},0)`}
              >
                {geoFeatures.map((geo, geoIdx) => {
                  const geoName = geo.properties.name;
                  const hasData = !!filteredNodesByGeoName[geoName];
                  // 点(産地)を主役にするため、国の塗りは控えめに。
                  // データのある国はうっすら色づけ、無い国はグレー。
                  const fill = hasData ? "#fde9d0" : "#e2e8f0";

                  // 点(産地ノード)を主役にするため、国ポリゴン自体はクリック不可。
                  // クリックは背景として扱われ、SVGのonClickで選択解除される。
                  return (
                    <path
                      key={`geo-${geoName}`}
                      d={geoPaths[geoIdx]}
                      fill={fill}
                      stroke="#f8fafc"
                      strokeWidth={0.5}
                    />
                  );
                })}

                {/* コーヒーベルト(南北 BELT_LAT 度の間)を薄く塗り、その境界線と赤道を引く。
                  クリックを邪魔しないよう pointerEvents は無効。 */}
                <rect
                  x={0}
                  y={yBeltNorth}
                  width={worldWidth}
                  height={yBeltSouth - yBeltNorth}
                  fill={BELT_COLOR}
                  opacity={BELT_FILL_OPACITY}
                  pointerEvents="none"
                />
                <line
                  x1={0}
                  x2={worldWidth}
                  y1={yBeltNorth}
                  y2={yBeltNorth}
                  stroke={BELT_COLOR}
                  strokeWidth={0.8}
                  strokeDasharray="4 4"
                  opacity={BELT_LINE_OPACITY}
                  pointerEvents="none"
                />
                <line
                  x1={0}
                  x2={worldWidth}
                  y1={yBeltSouth}
                  y2={yBeltSouth}
                  stroke={BELT_COLOR}
                  strokeWidth={0.8}
                  strokeDasharray="4 4"
                  opacity={BELT_LINE_OPACITY}
                  pointerEvents="none"
                />
                <line
                  x1={0}
                  x2={worldWidth}
                  y1={yEquator}
                  y2={yEquator}
                  stroke={EQUATOR_COLOR}
                  strokeWidth={1}
                  strokeDasharray="6 4"
                  opacity={EQUATOR_LINE_OPACITY}
                  pointerEvents="none"
                />
              </g>
            ))}
          </g>

          {/* レイヤー2: 弧線 */}
          <g className="layer-arcs">
            {worldCopyOffsets.map((offsetX) => (
              <g
                key={`world-copy-arcs-${offsetX}`}
                transform={`translate(${offsetX},0)`}
              >
                {/* 選択された豆から味が近い豆への弧線(アニメーション) */}
                {selectedCoffee &&
                  similarCoffees.map((similar) => {
                    const p1 = nodePositions.get(selectedCoffee.id);
                    const p2 = nodePositions.get(similar.id);
                    if (!p1 || !p2) return null;

                    // 投影後の座標距離（世界地図のループを考慮）
                    let dx = p2[0] - p1[0];
                    if (dx > worldWidth / 2) dx -= worldWidth;
                    else if (dx < -worldWidth / 2) dx += worldWidth;

                    const startX = p1[0];
                    const startY = p1[1];
                    const endX = p1[0] + dx;
                    const endY = p2[1];

                    const dist = Math.sqrt(
                      dx * dx + (endY - startY) * (endY - startY),
                    );

                    // ベジェ曲線の制御点（距離に応じて上に膨らむように）
                    const cx = (startX + endX) / 2;
                    const cy = (startY + endY) / 2 - dist * 0.25;

                    const pathD = `M ${startX},${startY} Q ${cx},${cy} ${endX},${endY}`;

                    return (
                      <path
                        key={`arc-${similar.id}`}
                        d={pathD}
                        fill="none"
                        stroke="#14b8a6" // teal-500
                        strokeWidth="2"
                        strokeDasharray="6 6"
                        opacity="0.9"
                        pointerEvents="none"
                      >
                        <animate
                          attributeName="stroke-dashoffset"
                          from="12"
                          to="0"
                          dur="0.6s"
                          repeatCount="indefinite"
                        />
                      </path>
                    );
                  })}
              </g>
            ))}
          </g>

          {/* レイヤー3: 産地の点 */}
          <g className="layer-points">
            {worldCopyOffsets.map((offsetX) => (
              <g
                key={`world-copy-pts-${offsetX}`}
                transform={`translate(${offsetX},0)`}
              >
                {/* 産地(admin1)の点。地理座標[lng,lat]をバネ+衝突で重なり除去した位置に置く。 */}
                {filteredNodeList.map((node) => {
                  const pos = nodePositions.get(node.id);
                  if (!pos) return null;
                  const [px, py] = pos;

                  const isRecommended = recommendedCoffee?.id === node.id;
                  const isSelected = selectedCoffee?.id === node.id;
                  const isDrank = !!drankCoffees[node.id];
                  const isSimilar = selectedCoffee
                    ? similarCoffeeIds.has(node.id)
                    : false;

                  let opacity = 1;
                  const isFilteredOut =
                    activeCluster !== null &&
                    activeCluster !== node.clusterName;
                  if (isFilteredOut) {
                    opacity = 0.12;
                  } else if (recommendedCoffee) {
                    // "おすすめを計算する"が実行中: 計算結果の豆と飲んだ豆以外を暗くする
                    if (!isDrank && !isRecommended) opacity = 0.3;
                  } else if (selectedCoffee) {
                    if (!isSelected && !isSimilar) opacity = 0.3;
                  }
                  // 何も選択されていない時は、未飲豆のグレーアウトはしない

                  let r = NODE_BASE_R;
                  let strokeColor = "#ffffff";
                  let strokeWidth = 0.7;

                  if (isSelected || isSimilar) {
                    r += 2;
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
                        onMouseEnter={(e) => handleNodeHover(e, node)}
                        onMouseMove={(e) => handleNodeHover(e, node)}
                        onMouseLeave={() => setHoveredNode(null)}
                      />
                    </g>
                  );
                })}
              </g>
            ))}
          </g>
        </g>
      </svg>

      <MapLegend
        ref={legendRef}
        activeCluster={activeCluster}
        toggleCluster={toggleCluster}
        setActiveCluster={setActiveCluster}
      />

      {hoveredNode && (
        <div
          className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-full rounded-lg bg-base-100/95 px-2.5 py-1.5 shadow-lg border border-base-200 whitespace-nowrap"
          style={{ left: hoveredNode.x, top: hoveredNode.y - 8 }}
        >
          <div className="text-sm font-semibold leading-tight">
            {translateCountry(hoveredNode.country)}
          </div>
          {hoveredNode.admin1 && (
            <div className="flex items-center gap-1 text-[11px] text-base-content/60 leading-tight">
              <MapPin size={11} className="shrink-0" />
              {hoveredNode.admin1}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
