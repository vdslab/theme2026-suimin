import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  sunburstHierarchy,
  sunburstNodeForId,
  sunburstLabel,
  sunburstRadius,
} from "../lib/sunburstLayout.js";
import { flavorName, flavorPath } from "../lib/flavorJapanese";
import { partition } from "d3-hierarchy";
import { arc } from "d3-shape";
import { pathId } from "../lib/flavorData.js";
import { sunburstLabelLines } from "../lib/sunburstLabels.js";
import {
  flavorColorTheme,
  getFlavorAppearance,
} from "../lib/flavorColorUtils.js";

export default function SunburstFlavorChart({ data, selectedId, onSelect }) {
  const [hoveredId, setHoveredId] = useState(null);
  const viewportRef = useRef(null);
  const clipPrefix = useId();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = viewportRef.current;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setViewport({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const radius = sunburstRadius(viewport.width, viewport.height);
  const { root, shape } = useMemo(() => {
    const root = sunburstHierarchy(data.root);
    partition().size([2 * Math.PI, radius])(root);
    const shape = arc()
      .startAngle((n) => n.x0)
      .endAngle((n) => n.x1)
      .padAngle(0.008)
      .padRadius(radius / 2)
      .innerRadius((n) => n.y0 + 1)
      .outerRadius((n) => n.y1 - 1);
    return { root, shape };
  }, [data, radius]);
  const selected = sunburstNodeForId(root, selectedId)?.data;
  return (
    <>
      <nav className="flavor-breadcrumb" aria-label="選択中の味の階層">
        <span>選択中</span>
        <ol>
          {selected?.path.map((name, index) => (
            <li key={pathId(selected.path.slice(0, index + 1))}>
              {index === selected.path.length - 1 ? (
                <span aria-current="location">{flavorName(name)}</span>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onSelect(pathId(selected.path.slice(0, index + 1)))
                  }
                >
                  {flavorName(name)}
                </button>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <div className="flavor-wheel-viewport" ref={viewportRef}>
        {radius > 0 && (
          <svg
            className="flavor-wheel"
            style={{
              width: viewport.width,
              height: viewport.height,
            }}
            viewBox={`${-viewport.width / 2} ${-viewport.height / 2} ${viewport.width} ${viewport.height}`}
            aria-label="味の階層。各セグメントをクリックして選択"
          >
            {root
              .descendants()
              .filter((n) => n.depth && n.value)
              .map((n, index) => {
                const label = sunburstLabel(n, sunburstLabelLines(n.data.name));
                const clipId = `${clipPrefix}-arc-${index}`;
                const active = selected?.id === n.data.id;
                const appearance = getFlavorAppearance(n.data.path, {
                  hovered: hoveredId === n.data.id,
                  selected: active,
                });
                return (
                  <g key={n.data.id}>
                    <defs>
                      <clipPath id={clipId}>
                        <path d={shape(n)} />
                      </clipPath>
                    </defs>
                    <path
                      d={shape(n)}
                      fill={appearance.fill}
                      fillOpacity={1}
                      stroke={appearance.stroke}
                      strokeWidth={appearance.strokeWidth}
                      vectorEffect="non-scaling-stroke"
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
                    {label.visible && (
                      <g clipPath={`url(#${clipId})`}>
                        <text
                          pointerEvents="none"
                          transform={label.transform}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={appearance.label}
                          fontSize={label.fontSize}
                        >
                          {label.lines.map((line, lineIndex) => (
                            <tspan
                              key={lineIndex}
                              x="0"
                              dy={
                                lineIndex === 0
                                  ? -(label.lines.length - 1) *
                                    label.fontSize *
                                    0.6
                                  : label.fontSize * 1.2
                              }
                            >
                              {line}
                            </tspan>
                          ))}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            <circle r={root.y1 - 3} fill={flavorColorTheme.center} />
            <text
              textAnchor="middle"
              y="-5"
              fill={flavorColorTheme.darkText}
              fontSize={Math.min(13, root.y1 / 5)}
            >
              味の全体像
            </text>
            <text
              textAnchor="middle"
              y="14"
              fill={flavorColorTheme.mutedText}
              fontSize={Math.min(10, root.y1 / 6)}
            >
              {data.beans.length.toLocaleString()}件の豆
            </text>
          </svg>
        )}
      </div>
    </>
  );
}
