import { useEffect, useMemo, useRef, useState } from "react";
import { clusterColor, isNoise, shortName, TASTE_AXES } from "../lib/clusters";
import { coffeeData } from "../lib/coffeeData";
import {
  createDefaultAxes,
  createPresetAxes,
  getPresetHighlightRule,
  STAR_PRESET_CONFIG,
  STAR_PRESET_LAYOUT,
} from "../lib/starPresets";

// ------------------------------------------------------------------
// Star Coordinates ビュー（#star で開く独立ページ）
// 6つの味覚偏差軸を放射状に配置し、各産地を軸ベクトルの重み付き和で配置する。
// 軸の先端をドラッグして回転・伸縮できる（= kairollmann の Star Coordinates 相当）。
// ------------------------------------------------------------------

// 1.5倍に伸ばした右向きの軸とラベルが収まる余白を含む。
const SIZE = 800; // 描画領域(正方形)
const CENTER = SIZE / 2;
const BASE_LEN = 240; // 軸の初期長さ(px)

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function shortestAngleDelta(from, to) {
  return ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

// 各偏差次元を [-1, 1] に正規化するためのスケール（全産地の最大絶対値）
function useNormScales() {
  return useMemo(() => {
    const scales = {};
    TASTE_AXES.forEach((a) => {
      const key = `${a.en}_dev`;
      let maxAbs = 0;
      coffeeData.forEach((d) => {
        maxAbs = Math.max(maxAbs, Math.abs(d.deviation?.[key] ?? 0));
      });
      scales[a.en] = maxAbs || 1;
    });
    return scales;
  }, []);
}

export default function StarCoordinates() {
  const norm = useNormScales();
  const svgRef = useRef(null);

  // 各軸の状態: 角度(rad)・長さ(px)・表示ON/OFF。初期は等間隔・同一長・全表示。
  const [axes, setAxes] = useState(() =>
    createDefaultAxes(TASTE_AXES, BASE_LEN),
  );
  const [activePresetKey, setActivePresetKey] = useState(null);
  const [hover, setHover] = useState(null);
  const [activeClusters, setActiveClusters] = useState(() => new Set());
  const dragRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(
    () => () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    },
    [],
  );

  // 軸の単位ベクトル×長さ = 軸ベクトル(px)
  const axisVectors = axes.map((ax) => ({
    x: Math.cos(ax.angle) * ax.length,
    y: Math.sin(ax.angle) * ax.length,
  }));

  // 各産地の座標 = Σ (正規化偏差_i × 軸ベクトル_i)
  const points = useMemo(() => {
    const vecs = axes.map((ax) => ({
      x: Math.cos(ax.angle) * ax.length,
      y: Math.sin(ax.angle) * ax.length,
    }));
    return coffeeData.map((d) => {
      let px = 0;
      let py = 0;
      axes.forEach((ax, i) => {
        if (!ax.enabled) return; // 非表示の軸は投影から除外
        const v = (d.deviation?.[`${ax.en}_dev`] ?? 0) / norm[ax.en];
        px += v * vecs[i].x;
        py += v * vecs[i].y;
      });
      return { node: d, x: CENTER + px, y: CENTER + py };
    });
  }, [axes, norm]);

  // ---- ドラッグで軸を回転・伸縮 ----
  function pointerToLocal(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const scale = SIZE / rect.width;
    return {
      x: (e.clientX - rect.left) * scale - CENTER,
      y: (e.clientY - rect.top) * scale - CENTER,
    };
  }

  function onHandleDown(i, e) {
    e.preventDefault();
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    dragRef.current = i;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (dragRef.current == null) return;
    const p = pointerToLocal(e);
    const angle = Math.atan2(p.y, p.x);
    const length = Math.max(20, Math.min(BASE_LEN * 1.6, Math.hypot(p.x, p.y)));
    setAxes((prev) =>
      prev.map((ax, i) =>
        i === dragRef.current ? { ...ax, angle, length } : ax,
      ),
    );
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function toggleAxis(key) {
    setAxes((prev) =>
      prev.map((ax) => (ax.key === key ? { ...ax, enabled: !ax.enabled } : ax)),
    );
  }

  function resetAxes() {
    setActivePresetKey(null);
    animateAxes(createDefaultAxes(TASTE_AXES, BASE_LEN));
  }

  function animateAxes(targetAxes) {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    const startAxes = axes.map((axis) => ({ ...axis }));
    const startTime = performance.now();

    const frame = (now) => {
      const progress = Math.min(
        1,
        (now - startTime) / STAR_PRESET_LAYOUT.animationMs,
      );
      const eased = easeInOutCubic(progress);
      setAxes(
        startAxes.map((axis, index) => ({
          ...axis,
          enabled: targetAxes[index].enabled,
          angle:
            axis.angle +
            shortestAngleDelta(axis.angle, targetAxes[index].angle) * eased,
          length:
            axis.length + (targetAxes[index].length - axis.length) * eased,
        })),
      );
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(frame);
      } else {
        animationRef.current = null;
      }
    };
    animationRef.current = requestAnimationFrame(frame);
  }

  function selectPreset(key) {
    const preset = STAR_PRESET_CONFIG[key];
    setActivePresetKey(key);
    animateAxes(createPresetAxes(axes, preset, BASE_LEN));
  }

  const activePreset = activePresetKey
    ? STAR_PRESET_CONFIG[activePresetKey]
    : null;
  const presetHighlight = useMemo(
    () => getPresetHighlightRule(coffeeData, activePreset),
    [activePreset],
  );

  // ---- 凡例(クラスタ)一覧 ----
  const clusters = useMemo(() => {
    const map = new Map();
    coffeeData.forEach((d) => {
      const key = d.clusterName || "noise";
      if (!map.has(key)) {
        map.set(key, {
          name: d.clusterName,
          color: clusterColor(d.clusterName),
          label: shortName(d.clusterName),
          count: 0,
        });
      }
      map.get(key).count += 1;
    });
    // ノイズを末尾に
    return [...map.values()].sort((a, b) => {
      if (isNoise(a.name) !== isNoise(b.name)) return isNoise(a.name) ? 1 : -1;
      return b.count - a.count;
    });
  }, []);

  function toggleCluster(name) {
    setActiveClusters((prev) => {
      const next = new Set(prev);
      const key = name || "noise";
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const getNodeEmphasis = (node) => {
    const clusterDimmed =
      activeClusters.size > 0 &&
      !activeClusters.has(node.clusterName || "noise");
    const presetMatch = presetHighlight?.matches(node) ?? false;
    return { clusterDimmed, presetMatch };
  };

  return (
    <div className="min-h-screen bg-base-100 text-base-content p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-4">
          <h1 className="text-2xl font-bold">
            Star Coordinates — コーヒー産地の味覚偏差
          </h1>
          <p className="text-sm opacity-70 mt-1">
            6つの味覚偏差軸を放射状に配置し、各産地({coffeeData.length}
            地域)を軸ベクトルの重み付き和で配置。
            軸の先端(○)をドラッグで回転・伸縮できます。色は既存クラスタと同一。
          </p>
        </header>

        <section className="mb-4 rounded-lg border border-base-300 bg-base-200/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm font-semibold">味から探す</span>
            {Object.entries(STAR_PRESET_CONFIG).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                className={`btn btn-sm ${
                  activePresetKey === key ? "btn-primary" : "btn-outline"
                }`}
                onClick={() => selectPreset(key)}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={resetAxes}
            >
              自由に調整
            </button>
          </div>
          {activePreset && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-base-100 px-3 py-2 text-sm">
              <span>{activePreset.axisLabel}を比較しやすい配置です</span>
              <span className="font-bold text-primary">
                {activePreset.direction === "high" ? "→" : "←"}{" "}
                {activePreset.label}
              </span>
              <span className="text-xs opacity-60">
                色枠の点が条件に当てはまる約30%です
              </span>
            </div>
          )}
        </section>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* 描画 */}
          <div className="flex-1">
            <svg
              ref={svgRef}
              role="application"
              aria-label="Star Coordinates 散布図"
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="w-full border border-base-300 rounded-lg bg-base-200/40 touch-none select-none"
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              {/* 基準円 */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={BASE_LEN}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.1}
              />

              {/* 軸（非表示の軸は描かない） */}
              {axes.map((ax, i) => {
                if (!ax.enabled) return null;
                const ex = CENTER + axisVectors[i].x;
                const ey = CENTER + axisVectors[i].y;
                return (
                  <g key={ax.key}>
                    <line
                      x1={CENTER}
                      y1={CENTER}
                      x2={ex}
                      y2={ey}
                      stroke="currentColor"
                      strokeOpacity={0.45}
                    />
                    <text
                      x={CENTER + Math.cos(ax.angle) * (ax.length + 22)}
                      y={CENTER + Math.sin(ax.angle) * (ax.length + 22)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-current"
                      fontSize={14}
                      fontWeight={600}
                    >
                      {ax.label}
                    </text>
                    {/* ドラッグハンドル */}
                    <circle
                      cx={ex}
                      cy={ey}
                      r={9}
                      className="fill-primary cursor-grab active:cursor-grabbing"
                      onPointerDown={(e) => onHandleDown(i, e)}
                    />
                  </g>
                );
              })}

              {/* 産地の点 */}
              {points.map(({ node, x, y }) => {
                const { clusterDimmed, presetMatch } = getNodeEmphasis(node);
                const presetDimmed = activePreset && !presetMatch;
                const dim = clusterDimmed || presetDimmed;
                return (
                  // biome-ignore lint/a11y/noStaticElementInteractions: SVG data point (hover only)
                  <circle
                    key={node.id}
                    cx={x}
                    cy={y}
                    r={hover?.id === node.id ? 7 : 5}
                    fill={clusterColor(node.clusterName)}
                    fillOpacity={dim ? 0.12 : presetMatch ? 1 : 0.85}
                    stroke={presetMatch ? "#f59e0b" : "#fff"}
                    strokeWidth={presetMatch ? 2.5 : 0.6}
                    strokeOpacity={dim ? 0.15 : presetMatch ? 1 : 0.6}
                    className="cursor-pointer"
                    onMouseEnter={() => setHover(node)}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
            </svg>

            <div className="mt-3 flex gap-2">
              <button className="btn btn-sm" onClick={resetAxes} type="button">
                軸をリセット
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  window.location.hash = "map";
                }}
              >
                ← アプリに戻る
              </button>
            </div>
          </div>

          {/* サイドパネル */}
          <div className="w-full lg:w-72 shrink-0 space-y-4">
            {/* 軸の表示ON/OFF */}
            <div>
              <h2 className="font-semibold mb-2 text-sm">
                軸の表示（投影に使う次元）
              </h2>
              <ul className="space-y-1">
                {axes.map((ax) => (
                  <li key={ax.key}>
                    <label className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-base-200 cursor-pointer">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={ax.enabled}
                        onChange={() => toggleAxis(ax.key)}
                      />
                      <span className="flex-1">{ax.label}</span>
                      <span className="opacity-40 text-xs">{ax.en}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="text-xs opacity-50 mt-1 px-2">
                OFFにした軸は放射図から消え、点の配置計算からも除外されます。
              </p>
            </div>

            {/* 凡例 */}
            <div>
              <h2 className="font-semibold mb-2 text-sm">
                クラスタ（クリックで強調）
              </h2>
              <ul className="space-y-1">
                {clusters.map((c) => {
                  const key = c.name || "noise";
                  const on =
                    activeClusters.size === 0 || activeClusters.has(key);
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => toggleCluster(c.name)}
                        className={`flex items-center gap-2 w-full text-left text-sm px-2 py-1 rounded hover:bg-base-200 ${
                          on ? "" : "opacity-40"
                        }`}
                      >
                        <span
                          className="inline-block w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="flex-1 truncate">{c.label}</span>
                        <span className="opacity-50 tabular-nums">
                          {c.count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* ホバー詳細 */}
            <div className="border border-base-300 rounded-lg p-3 min-h-32">
              {hover ? (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: clusterColor(hover.clusterName),
                      }}
                    />
                    <span className="font-semibold text-sm">{hover.name}</span>
                  </div>
                  <div className="text-xs opacity-60 mb-2">
                    {shortName(hover.clusterName)} · n={hover.sampleCount}
                  </div>
                  <ul className="text-xs space-y-0.5">
                    {TASTE_AXES.map((a) => {
                      const v = hover.deviation?.[`${a.en}_dev`] ?? 0;
                      return (
                        <li key={a.key} className="flex justify-between">
                          <span className="opacity-70">{a.label}</span>
                          <span
                            className={`tabular-nums ${
                              v >= 0 ? "text-success" : "text-error"
                            }`}
                          >
                            {v >= 0 ? "+" : ""}
                            {v.toFixed(3)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <p className="text-xs opacity-50">
                  点にマウスを乗せると味覚偏差を表示します。
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
