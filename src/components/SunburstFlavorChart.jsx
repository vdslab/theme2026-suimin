import { useMemo, useState } from "react";
import { flavorName, flavorPath } from "../lib/flavorJapanese";
import { hierarchy, partition } from "d3-hierarchy";
import { arc } from "d3-shape";

export default function SunburstFlavorChart({ data, selectedId, onSelect }) {
  const [scale, setScale] = useState(1);
  const [hoveredId, setHoveredId] = useState(null);
  const { root, shape } = useMemo(() => {
    const root = hierarchy(data.root)
      .sum((n) => n.weight)
      .sort((a, b) => b.value - a.value);
    partition().size([2 * Math.PI, 235])(root);
    const shape = arc()
      .startAngle((n) => n.x0)
      .endAngle((n) => n.x1)
      .padAngle(0.008)
      .padRadius(120)
      .innerRadius((n) => n.y0 + 1)
      .outerRadius((n) => n.y1 - 1);
    return { root, shape };
  }, [data]);
  const visibleNodes = root.descendants().filter((n) => n.depth && n.value);
  const focused = data.nodes.get(hoveredId || selectedId);
  return (
    <>
      <div className="flavor-wheel-controls">
        <label>
          図の拡大率{" "}
          <input
            type="range"
            min="1"
            max="6"
            step="0.25"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
          />{" "}
          {Math.round(scale * 100)}％
        </label>
        <button type="button" onClick={() => setScale(1)}>
          倍率を戻す
        </button>
      </div>
      <div className="flavor-wheel-viewport">
        <svg
          className="flavor-wheel"
          style={{ width: `${scale * 100}%`, maxHeight: "none" }}
          viewBox="-255 -255 510 510"
          aria-label="味の階層。各セグメントをクリックして選択"
        >
          {root
            .descendants()
            .filter((n) => n.depth && n.value)
            .map((n) => {
              const angle = (((n.x0 + n.x1) / 2) * 180) / Math.PI;
              const radius = (n.y0 + n.y1) / 2;
              const active = selectedId === n.data.id;
              return (
                <g key={n.data.id}>
                  <path
                    d={shape(n)}
                    fill={data.color(n.data.path)}
                    fillOpacity={active ? 1 : 0.85 - n.depth * 0.08}
                    stroke={active ? "#fff8e8" : "#172529"}
                    strokeWidth={active ? 3 : 1}
                    role="button"
                    tabIndex={0}
                    aria-label={`${flavorPath(n.data.path)}: ${n.data.beanIds.size}件`}
                    onMouseEnter={() => setHoveredId(n.data.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onFocus={() => setHoveredId(n.data.id)}
                    onBlur={() => setHoveredId(null)}
                    aria-pressed={active}
                    onClick={() => onSelect(n.data.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(n.data.id);
                      }
                    }}
                  >
                    <title>
                      {flavorPath(n.data.path)}
                      {"\n"}
                      {n.data.beanIds.size}件 · クリックで選択
                    </title>
                  </path>
                  {
                    <text
                      pointerEvents="none"
                      transform={`rotate(${angle - 90}) translate(${radius},0) rotate(${angle < 180 ? 0 : 180})`}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#112126"
                      fontSize={Math.max(
                        0.6,
                        Math.min(
                          11,
                          (n.x1 - n.x0) * radius * 0.75,
                          (n.y1 - n.y0 - 9) / flavorName(n.data.name).length,
                        ),
                      )}
                    >
                      {flavorName(n.data.name)}
                    </text>
                  }
                </g>
              );
            })}
          <circle r={root.y1 - 3} fill="#14272b" />
          <text textAnchor="middle" y="-5" fill="#f4eada" fontSize="13">
            味の全体像
          </text>
          <text textAnchor="middle" y="14" fill="#9fb3ae" fontSize="10">
            {data.beans.length.toLocaleString()}件の豆
          </text>
        </svg>
      </div>
      <div className="flavor-wheel-caption" aria-live="polite">
        {focused && (
          <>
            <strong>{flavorPath(focused.path)}</strong>
            <span>{focused.beanIds.size.toLocaleString()}件の豆</span>
          </>
        )}
      </div>
      <p className="flavor-note">
        細い区画は拡大するか、下の一覧から選択できます。一覧には全階層の名前を表示しています。
      </p>
      <div className="flavor-label-list" aria-label="すべての味の階層ラベル">
        {visibleNodes.map((n) => (
          <button
            type="button"
            key={n.data.id}
            aria-pressed={selectedId === n.data.id}
            onClick={() => onSelect(n.data.id)}
            style={{ paddingLeft: `${12 + (n.depth - 1) * 18}px` }}
          >
            <i style={{ background: data.color(n.data.path) }} />
            <span>{flavorName(n.data.name)}</span>
            <small>{n.data.beanIds.size.toLocaleString()}件</small>
          </button>
        ))}
      </div>
    </>
  );
}
