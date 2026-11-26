import { useState } from "react";
import { getFlavorColor } from "../lib/flavorColorUtils";
import { pathId } from "../lib/flavorData";
import { flavorName } from "../lib/flavorJapanese";
import { characterList, KIND_JA } from "../lib/flavorStats";

// Scatter of flavors: x = share explained by roast, y = share explained by
// origin (uncertainty coefficients, posts 9160). Square-root axes keep the
// many small values apart; both axes share one scale so the diagonal is where
// roast and origin explain the same amount.
const W = 460;
const H = 420;
const M = { left: 46, right: 16, top: 14, bottom: 40 };
const MAX = 30;
const TICKS = [0, 1, 3, 5, 10, 20, 30];

const sx = (v) =>
  M.left +
  (Math.sqrt(Math.max(0, v)) / Math.sqrt(MAX)) * (W - M.left - M.right);
const sy = (v) =>
  H -
  M.bottom -
  (Math.sqrt(Math.max(0, v)) / Math.sqrt(MAX)) * (H - M.top - M.bottom);

// Flavors where roast + origin explain under 3% count as "found anywhere".
const WEAK_TOTAL = 3;
const weakCurve = Array.from({ length: 31 }, (_, i) => {
  const x = (WEAK_TOTAL * i) / 30;
  return `${i ? "L" : "M"}${sx(x)},${sy(WEAK_TOTAL - x)}`;
}).join("");

export default function FlavorCharacterMap({ data, selectedId, onSelect }) {
  const [hovered, setHovered] = useState(null);
  const points = characterList()
    .filter((c) => c.level === 3)
    .map((c) => ({ ...c, id: pathId(c.path) }))
    .filter((c) => data.nodes.has(c.id))
    .sort((a, b) => b.n - a.n);
  const selectedNode = selectedId ? data.nodes.get(selectedId) : null;
  const isSelected = (p) =>
    p.id === selectedId ||
    (selectedNode &&
      selectedNode.path.length === 2 &&
      pathId([...selectedNode.path, selectedNode.path.at(-1)]) === p.id);
  const radius = (n) => 3 + Math.sqrt(n) * 0.32;
  // Greedy label placement: larger flavors first; a label is drawn on the
  // right of its point (left near the right edge) only if it does not
  // overlap one already placed. Selected and hovered points always get one.
  const placed = [];
  const labels = new Map();
  const forced = points.filter((p) => isSelected(p) || p.id === hovered);
  for (const p of [...forced, ...points]) {
    if (labels.has(p.id)) continue;
    const text = flavorName(p.path.at(-1));
    const w = text.length * 10.5;
    const r = radius(p.n);
    const right = sx(p.roast) + r + 3 + w < W - 2;
    const x = right ? sx(p.roast) + r + 3 : sx(p.roast) - r - 3 - w;
    const box = [x, sy(p.origin) - 7, x + w, sy(p.origin) + 7];
    const hit = placed.some(
      (b) => box[0] < b[2] && b[0] < box[2] && box[1] < b[3] && b[1] < box[3],
    );
    if (hit && !forced.includes(p)) continue;
    placed.push(box);
    labels.set(p.id, { x: right ? x : x + w, anchor: right ? "start" : "end" });
  }
  return (
    <div className="flavor-character-map">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="味の性格マップ。横は焙煎で説明できる割合、縦は産地で説明できる割合"
      >
        <path
          d={`M${sx(0)},${sy(0)} L${sx(MAX)},${sy(MAX)}`}
          stroke="#cdb79b"
          strokeDasharray="4 4"
        />
        <path
          d={weakCurve}
          stroke="#cdb79b"
          fill="none"
          strokeDasharray="4 4"
        />
        <text x={sx(0.25)} y={sy(18)} className="region">
          産地の味
        </text>
        <text x={sx(26)} y={sy(0.6)} className="region" textAnchor="end">
          焙煎の味
        </text>
        <text
          x={sx(14)}
          y={sy(14) - 8}
          className="region"
          textAnchor="middle"
          transform={`rotate(-45 ${sx(14)} ${sy(14) - 8})`}
        >
          両方が効く（この線のあたり）
        </text>
        <text x={sx(0.05) + 4} y={sy(0.05) - 6} className="region small">
          どこにでもある味
        </text>
        {TICKS.map((t) => (
          <g key={t} className="axis">
            <line
              x1={sx(t)}
              x2={sx(t)}
              y1={H - M.bottom}
              y2={H - M.bottom + 4}
            />
            <text x={sx(t)} y={H - M.bottom + 15} textAnchor="middle">
              {t}%
            </text>
            <line x1={M.left - 4} x2={M.left} y1={sy(t)} y2={sy(t)} />
            <text x={M.left - 7} y={sy(t) + 3} textAnchor="end">
              {t}%
            </text>
          </g>
        ))}
        <line
          x1={M.left}
          x2={W - M.right}
          y1={H - M.bottom}
          y2={H - M.bottom}
          className="axis-line"
        />
        <line
          x1={M.left}
          x2={M.left}
          y1={M.top}
          y2={H - M.bottom}
          className="axis-line"
        />
        <text
          x={(M.left + W - M.right) / 2}
          y={H - 6}
          textAnchor="middle"
          className="axis-title"
        >
          焙煎で説明できる割合 →
        </text>
        <text
          transform={`translate(12 ${(M.top + H - M.bottom) / 2}) rotate(-90)`}
          textAnchor="middle"
          className="axis-title"
        >
          産地で説明できる割合 →
        </text>
        {points.map((p) => {
          const active = isSelected(p);
          const label = labels.get(p.id);
          return (
            // biome-ignore lint/a11y/useSemanticElements: SVG point acts as a button
            <g
              key={p.id}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              aria-label={`${flavorName(p.path.at(-1))}：${KIND_JA[p.kind]}。焙煎${p.roast}%、産地${p.origin}%`}
              onClick={() => onSelect(p.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(p.id);
                }
              }}
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}
              className="point"
            >
              <title>
                {`${flavorName(p.path.at(-1))}（${KIND_JA[p.kind]}）\n焙煎で説明できる ${p.roast}% ／ 産地で説明できる ${p.origin}%\n焙煎度と産地が分かる豆のうち ${p.n}件`}
              </title>
              <circle
                cx={sx(p.roast)}
                cy={sy(p.origin)}
                r={radius(p.n)}
                fill={getFlavorColor(p.path.slice(0, 1))}
                fillOpacity={active ? 1 : 0.72}
                stroke={active ? "#2a211b" : "#fffbf3"}
                strokeWidth={active ? 2.5 : 1}
              />
              {label && (
                <text
                  x={label.x}
                  textAnchor={label.anchor}
                  y={sy(p.origin) + 4}
                  className={active ? "label active" : "label"}
                >
                  {flavorName(p.path.at(-1))}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="flavor-note">
        点は味（大きさは件数、色は大分類）。押すと右に詳細が出ます。「説明できる割合」は、焙煎度（または産地）を知ると、その味が書かれているかをどれだけ当てやすくなるか（不確実性係数）。焙煎度と産地の両方が分かる豆2,556件で計算。点線は分類の目安（対角線＝焙煎と産地が同じくらい、原点近くの曲線＝合計3%）。
      </p>
    </div>
  );
}
