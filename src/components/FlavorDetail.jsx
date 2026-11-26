import { useId, useMemo } from "react";
import { translateCountry } from "../lib/countryNames";
import { pathId } from "../lib/flavorData";
import { flavorName, flavorPath } from "../lib/flavorJapanese";
import {
  adviceFor,
  flavorCharacter,
  formatBags,
  KIND_JA,
  ROAST_JA,
  ROAST_LEVELS,
  shareBy,
  shareByOriginRoast,
} from "../lib/flavorStats";

export const ROAST_COLORS = {
  light: "#D49A5A",
  medium: "#9A5F34",
  dark: "#4A2C1D",
};
const levelLabel = (level) => ROAST_JA[level] ?? translateCountry(level);

// The sunburst collapses e.g. Sweet > Honey > Honey to Sweet > Honey.
export function characterForNode(node) {
  if (!node) return null;
  return (
    flavorCharacter(node.id) ??
    flavorCharacter(pathId([...node.path, node.path.at(-1)]))
  );
}

function Bag({ fill }) {
  const clip = useId();
  const body = "M5 9 L27 9 L29 41 Q29 43 27 43 L5 43 Q3 43 3 41 Z";
  return (
    <svg width="24" height="33" viewBox="0 0 32 44" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <path d={body} />
        </clipPath>
      </defs>
      <path d={body} fill="#fffbf3" />
      <rect
        x="0"
        y={43 - 34 * fill}
        width="32"
        height={34 * fill}
        fill="#A8452A"
        clipPath={`url(#${clip})`}
      />
      <path d={body} fill="none" stroke="#6f4e37" strokeWidth="1.5" />
      <path
        d="M6 9 L8 3 L24 3 L26 9"
        fill="#f2e8d8"
        stroke="#6f4e37"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TenBags({ p, label }) {
  const bags = p * 10;
  return (
    <div className="flavor-bags" role="img" aria-label={label}>
      {Array.from({ length: 10 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed ten bags
        <Bag key={i} fill={Math.max(0, Math.min(1, bags - i))} />
      ))}
    </div>
  );
}

const niceMax = (v) => [1, 2, 3, 5, 10].find((m) => m >= v) ?? 10;

// One row per level: dot at "bags out of 10", line for the 95% interval,
// dashed line for the overall rate. Rows with little data are faded.
function BagChart({ rows, base, labelWidth = 92 }) {
  const max = niceMax(Math.max(base, ...rows.map((r) => r.hi)) * 10);
  const W = 420;
  const rowH = 24;
  const top = 6;
  const H = top + rows.length * rowH + 22;
  const x0 = labelWidth;
  const x1 = W - 70;
  const x = (bags) => x0 + (bags / max) * (x1 - x0);
  const ticks =
    max <= 3 ? [0, 1, 2, 3].filter((t) => t <= max) : [0, max / 2, max];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="flavor-bag-chart"
      role="img"
      aria-label="10袋中何袋かの図"
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={x(t)}
            x2={x(t)}
            y1={top}
            y2={top + rows.length * rowH}
            stroke="#eadcc9"
          />
          <text x={x(t)} y={H - 6} textAnchor="middle" className="tick">
            {t}袋
          </text>
        </g>
      ))}
      <line
        x1={x(base * 10)}
        x2={x(base * 10)}
        y1={top - 2}
        y2={top + rows.length * rowH}
        stroke="#79634f"
        strokeDasharray="3 3"
      />
      {rows.map((r, i) => {
        const cy = top + i * rowH + rowH / 2;
        const color =
          r.color ??
          (r.signal === "hi"
            ? "#A8452A"
            : r.signal === "lo"
              ? "#3F7A80"
              : "#a39280");
        return (
          <g key={r.key ?? r.level} opacity={r.uncertain ? 0.35 : 1}>
            <title>
              {`${r.label}：${r.t.toLocaleString()}袋中${r.k}袋（10袋中${formatBags(r.p)}袋、95%の範囲 ${formatBags(r.lo)}〜${formatBags(r.hi)}袋）${r.uncertain ? "。件数が少なく確かでない" : ""}`}
            </title>
            {!r.inline && (
              <text
                x={labelWidth - 8}
                y={cy + 4}
                textAnchor="end"
                className="label"
              >
                {r.label}
              </text>
            )}
            <line
              x1={x(r.lo * 10)}
              x2={x(r.hi * 10)}
              y1={cy + (r.dy ?? 0)}
              y2={cy + (r.dy ?? 0)}
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.5"
            />
            <circle
              cx={x(r.p * 10)}
              cy={cy + (r.dy ?? 0)}
              r="4.5"
              fill={color}
            />
            {!r.inline && (
              <text x={W - 4} y={cy + 4} textAnchor="end" className="value">
                {formatBags(r.p)}袋
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function OriginRoastChart({ cross }) {
  // One row per origin, three dots (light / medium / dark) on the same scale.
  const rows = cross.rows.flatMap((row) =>
    row.cells.map((c, q) => ({
      ...c,
      key: `${row.level}-${c.roast}`,
      level: row.level,
      label: translateCountry(row.level),
      color: ROAST_COLORS[c.roast],
      inline: true,
      dy: (q - 1) * 5,
      row: row.level,
    })),
  );
  // Collapse the three dots of an origin into one chart row.
  const grouped = cross.rows.map((row) => row.level);
  const max = niceMax(Math.max(cross.base, ...rows.map((r) => r.hi)) * 10);
  const W = 420;
  const rowH = 26;
  const top = 6;
  const H = top + grouped.length * rowH + 22;
  const x0 = 92;
  const x1 = W - 12;
  const x = (bags) => x0 + (bags / max) * (x1 - x0);
  const ticks =
    max <= 3 ? [0, 1, 2, 3].filter((t) => t <= max) : [0, max / 2, max];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="flavor-bag-chart"
      role="img"
      aria-label="産地と焙煎度ごとの10袋中何袋かの図"
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={x(t)}
            x2={x(t)}
            y1={top}
            y2={top + grouped.length * rowH}
            stroke="#eadcc9"
          />
          <text x={x(t)} y={H - 6} textAnchor="middle" className="tick">
            {t}袋
          </text>
        </g>
      ))}
      <line
        x1={x(cross.base * 10)}
        x2={x(cross.base * 10)}
        y1={top - 2}
        y2={top + grouped.length * rowH}
        stroke="#79634f"
        strokeDasharray="3 3"
      />
      {grouped.map((origin, i) => {
        const cy = top + i * rowH + rowH / 2;
        return (
          <g key={origin}>
            <text x={84} y={cy + 4} textAnchor="end" className="label">
              {translateCountry(origin)}
            </text>
            {rows
              .filter((r) => r.row === origin && r.t > 0)
              .map((r) => (
                <g key={r.key} opacity={r.uncertain ? 0.3 : 1}>
                  <title>
                    {`${r.label} × ${ROAST_JA[r.roast]}：${r.t}袋中${r.k}袋（10袋中${formatBags(r.p)}袋）${r.uncertain ? "。件数が少なく確かでない" : ""}`}
                  </title>
                  <line
                    x1={x(r.lo * 10)}
                    x2={x(r.hi * 10)}
                    y1={cy + r.dy}
                    y2={cy + r.dy}
                    stroke={r.color}
                    strokeWidth="1.5"
                    opacity="0.45"
                  />
                  <circle
                    cx={x(r.p * 10)}
                    cy={cy + r.dy}
                    r="4"
                    fill={r.color}
                  />
                </g>
              ))}
          </g>
        );
      })}
    </svg>
  );
}

const ROAST_NOTE =
  "焙煎度が書かれた豆（全体の約4割）の中での値。チョコ系が多い店ほど焙煎度を書いているため、全体の割合としては偏っている。";

export default function FlavorDetail({ data, attributes, node }) {
  const stats = useMemo(() => {
    if (!node) return null;
    return {
      origin: shareBy(data, attributes, node, "origin"),
      roast: shareBy(data, attributes, node, "roast"),
      cross: shareByOriginRoast(data, attributes, node),
    };
  }, [data, attributes, node]);
  if (!node || !stats) {
    return (
      <div className="flavor-detail-empty">
        左の図から味を選ぶと、産地・焙煎度ごとに「10袋中何袋」その味に出会えるかを表示します。
      </div>
    );
  }
  const character = characterForNode(node);
  const kind = character?.kind ?? null;
  const name = flavorName(node.name);
  const advice = adviceFor(
    kind ?? "both",
    name,
    stats.origin,
    stats.roast,
    levelLabel,
  );
  const originRows = stats.origin.rows
    .map((r) => ({ ...r, label: translateCountry(r.level) }))
    .sort((a, b) => b.p - a.p);
  const roastRows = stats.roast.rows.map((r) => ({
    ...r,
    label: ROAST_JA[r.level],
  }));
  const originChart = (
    <section className="flavor-detail-block">
      <h3>産地ごと</h3>
      <BagChart rows={originRows} base={stats.origin.base} />
    </section>
  );
  const roastChart = (
    <section className="flavor-detail-block">
      <h3>焙煎度ごと</h3>
      <p className="flavor-detail-note">{ROAST_NOTE}</p>
      <BagChart rows={roastRows} base={stats.roast.base} labelWidth={70} />
    </section>
  );
  const crossChart = (
    <section className="flavor-detail-block">
      <h3>産地 × 焙煎度</h3>
      <p className="flavor-detail-note">
        <span className="flavor-roast-key">
          {ROAST_LEVELS.map((r) => (
            <span key={r}>
              <i style={{ background: ROAST_COLORS[r] }} />
              {ROAST_JA[r]}
            </span>
          ))}
        </span>
        {ROAST_NOTE}
      </p>
      <OriginRoastChart cross={stats.cross} />
    </section>
  );
  const primary =
    kind === "origin"
      ? originChart
      : kind === "roast"
        ? roastChart
        : kind === "weak"
          ? null
          : crossChart;
  const secondary =
    kind === "origin"
      ? { roast: roastChart }
      : kind === "roast"
        ? { origin: originChart }
        : { origin: originChart, roast: roastChart };
  const pick = advice.pick;
  return (
    <div className="flavor-detail">
      <div className="flavor-detail-head">
        <span className="flavor-detail-path">
          {flavorPath(node.path.slice(0, -1)) || "大分類"}
        </span>
        <h3 className="flavor-detail-name">
          {name}
          <small>{node.beanIds.size.toLocaleString()}件の豆</small>
        </h3>
        <span className={`flavor-kind flavor-kind-${kind ?? "none"}`}>
          {kind ? KIND_JA[kind] : "味の性格は未分析（件数が少ない）"}
        </span>
      </div>
      <div className="flavor-advice">
        <p>{advice.text}</p>
        <TenBags
          p={pick ? pick.p : stats.origin.base}
          label={`10袋中${formatBags(pick ? pick.p : stats.origin.base)}袋`}
        />
        <p className="flavor-detail-note">
          {pick
            ? `${levelLabel(pick.level)}の豆を10袋買うと、${name}の味が書かれた豆は${formatBags(pick.p)}袋（95%の範囲 ${formatBags(pick.lo)}〜${formatBags(pick.hi)}袋）。`
            : ""}
          全体の平均は10袋中{formatBags(stats.origin.base)}袋。
        </p>
      </div>
      {primary}
      <details className="flavor-detail-more">
        <summary>{primary ? "ほかの見方" : "産地・焙煎度ごとに見る"}</summary>
        {Object.entries(secondary).map(([key, chart]) => (
          <div key={key}>{chart}</div>
        ))}
      </details>
      <p className="flavor-detail-note">
        点は「10袋中何袋」、横線は95%の範囲、点線は全体の平均。薄い行は件数が少ない（30袋未満）か、範囲が広く確かでない。値は店の説明文に「
        {name}」の味が書かれた豆の割合です。
      </p>
    </div>
  );
}
