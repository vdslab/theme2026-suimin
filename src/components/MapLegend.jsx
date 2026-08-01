import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { forwardRef, useMemo, useState } from "react";
import {
  clusterColor,
  clusterIndex,
  computeClusterTasteDeviations,
  isNoise,
  shortName,
  TASTE_AXES,
} from "../lib/clusters";
import { coffeeData } from "../lib/coffeeData";
import {
  BELT_COLOR,
  BELT_FILL_OPACITY,
  BELT_LAT,
  BELT_LINE_OPACITY,
  EQUATOR_COLOR,
  EQUATOR_LINE_OPACITY,
} from "../lib/mapStyle";

const legendClusters = (() => {
  const set = new Set(coffeeData.map((d) => d.clusterName));
  return Array.from(set).sort((a, b) => {
    if (isNoise(a)) return 1;
    if (isNoise(b)) return -1;
    return (clusterIndex(a) ?? 0) - (clusterIndex(b) ?? 0);
  });
})();

const clusterDevs = computeClusterTasteDeviations(coffeeData);

const globalMaxDev = (() => {
  let maxVal = 0.15;
  Object.values(clusterDevs).forEach((devObj) => {
    Object.values(devObj).forEach((val) => {
      const abs = Math.abs(val);
      if (abs > maxVal) maxVal = abs;
    });
  });
  return maxVal;
})();

function ClusterRadarChart({ devs, color, selected }) {
  const size = 80;
  const cx = size / 2;
  const cy = size / 2;
  const Rmax = 22;
  const R0 = 11;
  const Rmin = 4;
  const Rlabel = 29;

  const angles = useMemo(
    () => TASTE_AXES.map((_, i) => -Math.PI / 2 + i * (Math.PI / 3)),
    [],
  );

  // 外枠（背景）の多角形頂点
  const bgPoints = useMemo(
    () =>
      angles
        .map((a) => {
          const x = cx + Rmax * Math.cos(a);
          const y = cy + Rmax * Math.sin(a);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" "),
    [angles, cx, cy],
  );

  // 基準線 (偏差 0) の多角形頂点
  const basePoints = useMemo(
    () =>
      angles
        .map((a) => {
          const x = cx + R0 * Math.cos(a);
          const y = cy + R0 * Math.sin(a);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" "),
    [angles, cx, cy],
  );

  // データの多角形頂点と点一覧
  const { dataPointsStr, dataPoints } = useMemo(() => {
    if (!devs) return { dataPointsStr: "", dataPoints: [] };
    const maxD = Math.max(0.1, globalMaxDev * 1.25);

    const pts = TASTE_AXES.map((axis, i) => {
      const dev = devs[axis.en] ?? 0;
      let r = R0 + (dev / maxD) * (Rmax - R0);
      r = Math.max(Rmin, Math.min(Rmax, r));

      const a = angles[i];
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      return { x, y, dev };
    });

    return {
      dataPointsStr: pts
        .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" "),
      dataPoints: pts,
    };
  }, [devs, angles, cx, cy]);

  return (
    <svg
      role="img"
      aria-label="クラスタの味覚傾向レーダーチャート"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="overflow-visible select-none my-0.5"
    >
      <title>クラスタの味覚傾向レーダーチャート</title>

      {/* 背景多角形 */}
      <polygon
        points={bgPoints}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
        className="text-base-content/15"
      />

      {/* 基準線（偏差0） */}
      <polygon
        points={basePoints}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeDasharray="2 2"
        className="text-base-content/30"
      />

      {/* 軸線 */}
      {angles.map((a, i) => {
        const x2 = cx + Rmax * Math.cos(a);
        const y2 = cy + Rmax * Math.sin(a);
        return (
          <line
            key={`axis-${TASTE_AXES[i].key}`}
            x1={cx}
            y1={cy}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="0.6"
            className="text-base-content/15"
          />
        );
      })}

      {/* データポリゴン */}
      {dataPointsStr && (
        <polygon
          points={dataPointsStr}
          fill={color}
          fillOpacity={selected ? 0.45 : 0.25}
          stroke={color}
          strokeWidth={selected ? "1.8" : "1.2"}
        />
      )}

      {/* データ頂点の丸ポチ */}
      {dataPoints.map((p, i) => (
        <circle
          key={`pt-${TASTE_AXES[i].key}`}
          cx={p.x}
          cy={p.y}
          r={selected ? 2 : 1.5}
          fill={color}
        />
      ))}

      {/* 軸名テキストラベル */}
      {angles.map((a, i) => {
        const lx = cx + Rlabel * Math.cos(a);
        const ly = cy + Rlabel * Math.sin(a);
        const axis = TASTE_AXES[i];

        let textAnchor = "middle";
        let dx = 0;
        let dy = 0;

        if (i === 0) {
          textAnchor = "middle";
          dy = -1;
        } else if (i === 1 || i === 2) {
          textAnchor = "start";
          dx = 1;
          dy = 2;
        } else if (i === 3) {
          textAnchor = "middle";
          dy = 6;
        } else if (i === 4 || i === 5) {
          textAnchor = "end";
          dx = -1;
          dy = 2;
        }

        return (
          <text
            key={`lbl-${axis.key}`}
            x={lx}
            y={ly}
            dx={dx}
            dy={dy}
            textAnchor={textAnchor}
            className={`text-[7.5px] font-medium leading-none ${
              selected ? "fill-base-content font-bold" : "fill-base-content/70"
            }`}
          >
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}

// 地図に引いてある緯度線の凡例。色と破線パターンは地図と同じものを使う。
// ただし透明度は上げる。地図では広い面積に敷くので薄くてよいが、
// 26pxの見本を同じ薄さで塗ると白背景に埋もれて見えないため。
const SWATCH_FILL_OPACITY = Math.min(1, BELT_FILL_OPACITY * 2.5);
const SWATCH_LINE_OPACITY = Math.min(1, BELT_LINE_OPACITY * 1.6);
const SWATCH_EQUATOR_OPACITY = Math.min(1, EQUATOR_LINE_OPACITY * 1.3);

function MapLinesLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-base-200 px-1 pt-1.5">
      <span className="flex items-center gap-1.5 text-[11px] text-base-content/70">
        <svg width="26" height="14" aria-hidden="true" className="shrink-0">
          <rect
            x="0"
            y="2.5"
            width="26"
            height="9"
            fill={BELT_COLOR}
            opacity={SWATCH_FILL_OPACITY}
          />
          <line
            x1="0"
            x2="26"
            y1="3"
            y2="3"
            stroke={BELT_COLOR}
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity={SWATCH_LINE_OPACITY}
          />
          <line
            x1="0"
            x2="26"
            y1="11"
            y2="11"
            stroke={BELT_COLOR}
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity={SWATCH_LINE_OPACITY}
          />
        </svg>
        コーヒーベルト（南北{BELT_LAT}度）
      </span>

      <span className="flex items-center gap-1.5 text-[11px] text-base-content/70">
        <svg width="26" height="14" aria-hidden="true" className="shrink-0">
          <line
            x1="0"
            x2="26"
            y1="7"
            y2="7"
            stroke={EQUATOR_COLOR}
            strokeWidth="1.2"
            strokeDasharray="6 4"
            opacity={SWATCH_EQUATOR_OPACITY}
          />
        </svg>
        赤道
      </span>
    </div>
  );
}

const MapLegend = forwardRef(function MapLegend(
  { activeCluster, toggleCluster, setActiveCluster },
  ref,
) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      ref={ref}
      className="absolute bottom-3 left-3 sm:bottom-5 sm:left-5 z-20 flex max-w-[calc(100vw-1.5rem)] sm:max-w-[calc(100vw-2.5rem)] flex-col gap-1.5 p-2.5 sm:p-3 bg-base-100/95 backdrop-blur-md rounded-2xl shadow-xl border border-base-200 pointer-events-auto transition-all duration-300"
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="flex items-center gap-1.5 text-left group cursor-pointer"
        >
          <span className="text-xs font-bold text-base-content/80 group-hover:text-primary transition-colors">
            味覚クラスタ傾向
          </span>
          <span className="text-[10px] text-base-content/40 hidden md:inline">
            (偏差平均)
          </span>
          {isCollapsed ? (
            <ChevronUp
              size={14}
              className="text-base-content/50 group-hover:text-primary transition-transform"
            />
          ) : (
            <ChevronDown
              size={14}
              className="text-base-content/50 group-hover:text-primary transition-transform"
            />
          )}
        </button>

        <div className="flex items-center gap-2">
          {activeCluster && (
            <button
              type="button"
              onClick={() => setActiveCluster(null)}
              className="btn btn-ghost btn-xs text-primary gap-1 px-1.5 h-6 min-h-0 text-[11px]"
            >
              <RotateCcw size={11} />
              解除
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-1 px-0.5 max-w-full">
          {legendClusters.map((name) => {
            const color = clusterColor(name);
            const selected = activeCluster === name;
            const dimmed = activeCluster !== null && !selected;
            const devs = clusterDevs[name];

            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleCluster(name)}
                className={`flex flex-col items-center justify-between p-1.5 rounded-xl border transition-all duration-200 cursor-pointer shrink-0 ${
                  selected
                    ? "bg-base-100 shadow-md ring-2 scale-105 z-10"
                    : dimmed
                      ? "opacity-35 hover:opacity-80 bg-base-100/60 hover:scale-105"
                      : "bg-base-100 hover:bg-base-200/80 hover:shadow-sm hover:scale-105"
                }`}
                style={{
                  borderColor: selected ? color : `${color}40`,
                  ringColor: selected ? color : "transparent",
                }}
              >
                {/* 上部: クラスタ名ラベル */}
                <div
                  className="badge gap-1 px-1.5 py-0.5 text-[10px] font-bold transition-all h-5 min-h-0"
                  style={{
                    backgroundColor: selected ? color : "transparent",
                    borderColor: color,
                    color: selected ? "#fff" : color,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: selected ? "#fff" : color }}
                  />
                  <span className="truncate max-w-[80px]">
                    {shortName(name)}
                  </span>
                </div>

                {/* 下部: ミニレーダーチャート */}
                <ClusterRadarChart
                  devs={devs}
                  color={color}
                  selected={selected}
                />
              </button>
            );
          })}
        </div>
      )}

      {!isCollapsed && <MapLinesLegend />}
    </div>
  );
});

export default MapLegend;
