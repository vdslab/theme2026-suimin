import { useMemo, useState } from "react";
import { translateCountry } from "../lib/countryNames";
import { getFlavorColor } from "../lib/flavorColorUtils";
import { flavorName } from "../lib/flavorJapanese";
import {
  buildMatrix,
  matrixGroupNotes,
  matrixOrders,
  plainColor,
  UNCERTAINTY_JA,
  VSUP_BINS,
  vsupColor,
} from "../lib/flavorMatrix";
import { formatBags } from "../lib/flavorStats";
import { sunburstHierarchy } from "../lib/sunburstLayout";

// Rows with fewer tagged beans than this are left out of the table.
const MIN_ROW_BEANS = 20;
const SIZES = {
  mid: { cw: 34, rh: 26, font: 12.5 },
  leaf: { cw: 22, rh: 17, font: 11.5 },
};
const LABW = 150;
const TOP = 84;
const NOTE_W = 170;
const NOTE_H = 48;
const RAMP = Array.from({ length: 17 }, (_, s) => -2 + s / 4);

// Rows in the sunburst's (SCA wheel) order: middle categories ("mid") or
// individual flavors ("leaf").
export function matrixRows(data, level) {
  const root = sunburstHierarchy(data.root);
  const nodes =
    level === "mid"
      ? root.descendants().filter((n) => n.depth === 2)
      : root.leaves();
  return nodes
    .map((n) => n.data)
    .filter((n) => n.path.length >= 2 && n.beanIds.size >= MIN_ROW_BEANS);
}

export function useFlavorMatrix(data, attributes, level = "mid") {
  return useMemo(() => {
    const matrix = buildMatrix(data, attributes, matrixRows(data, level));
    const orders = matrixOrders(matrix, {
      rowGroups: level === "mid" ? 4 : 5,
      columnGroups: 4,
    });
    return {
      matrix,
      orders,
      notes: matrixGroupNotes(matrix, orders.similar, {
        name: rowLabel,
        origin: translateCountry,
      }),
    };
  }, [data, attributes, level]);
}

const rowLabel = (node) => flavorName(node.name);

export function MatrixLegend({ color }) {
  if (color === "plain") {
    return (
      <svg
        width="280"
        height="34"
        role="img"
        aria-label="凡例：全体平均の4分の1以下から4倍以上"
      >
        {RAMP.map((v, s) => (
          <rect
            key={v}
            x={s * 15}
            y="2"
            width="15"
            height="12"
            fill={plainColor(v)}
          />
        ))}
        <text x="0" y="28" className="leg">
          平均の1/4以下
        </text>
        <text x={8 * 15 + 7.5} y="28" textAnchor="middle" className="leg">
          平均
        </text>
        <text x="255" y="28" textAnchor="end" className="leg">
          4倍以上
        </text>
      </svg>
    );
  }
  const LW = 168;
  const X0 = 72;
  return (
    <svg
      width="280"
      height="66"
      role="img"
      aria-label="凡例：不確かなほど色の段階が減り、薄くなる"
    >
      {VSUP_BINS.map((nb, level) => (
        <g key={nb}>
          {Array.from({ length: nb }, (_, b) => -2 + ((b + 0.5) * 4) / nb).map(
            (center, b) => (
              <rect
                key={center}
                x={X0 + (b * LW) / nb}
                y={2 + level * 12}
                width={LW / nb}
                height="11"
                fill={vsupColor(center, level)}
              />
            ),
          )}
          <text x={X0 - 6} y={11 + level * 12} textAnchor="end" className="leg">
            {UNCERTAINTY_JA[level]}
          </text>
        </g>
      ))}
      <text x={X0} y="62" className="leg">
        平均の1/4以下
      </text>
      <text x={X0 + LW / 2} y="62" textAnchor="middle" className="leg">
        平均
      </text>
      <text x={X0 + LW} y="62" textAnchor="end" className="leg">
        4倍以上
      </text>
    </svg>
  );
}

export function describeCell(matrix, i, j) {
  const c = matrix.cells[i][j];
  return `${translateCountry(matrix.origins[j])} × ${rowLabel(matrix.rows[i])}：${c.t.toLocaleString()}袋中${c.k}袋（10袋中${formatBags(c.p)}袋）、全体平均の${c.ratio.toFixed(2)}倍、確かさ：${UNCERTAINTY_JA[c.level]}`;
}

export default function FlavorMatrix({
  matrix,
  orders,
  notes,
  level = "mid",
  order = "similar",
  color = "vsup",
  selectedId,
  onSelectRow,
  onHover,
}) {
  const [hover, setHover] = useState(null);
  const similar = order === "similar";
  const o = orders[order];
  const { cw, rh, font } = SIZES[level];
  const layout = useMemo(() => {
    // A gap between groups: SCA categories in wheel order, clusters otherwise.
    const rowGroup = (i) =>
      similar ? o.rowGroups.get(i) : matrix.rows[i].path[0];
    const colGroup = (j) => (similar ? o.colGroups.get(j) : 0);
    const rowY = [];
    let y = TOP;
    o.rows.forEach((i, p) => {
      if (p && rowGroup(i) !== rowGroup(o.rows[p - 1])) y += 8;
      rowY[i] = y;
      y += rh;
    });
    const colX = [];
    let x = LABW;
    o.cols.forEach((j, p) => {
      if (p && colGroup(j) !== colGroup(o.cols[p - 1])) x += 8;
      colX[j] = x;
      x += cw;
    });
    return { rowY, colX, gridR: x, gridB: y };
  }, [matrix, o, similar, cw, rh]);
  const { rowY, colX, gridR, gridB } = layout;
  const W = gridR + (similar ? NOTE_W : 12);
  const H = gridB + (similar ? NOTE_H : 6);
  const setCell = (cell) => {
    setHover(cell);
    onHover?.(cell);
  };
  return (
    <svg
      className="flavor-matrix"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={`味と産地の早見表（${similar ? "似ている順" : "ホイール順"}、${color === "vsup" ? "不確かさを込めた配色" : "普通の配色"}）`}
      onMouseLeave={() => setCell(null)}
    >
      {o.cols.map((j) => (
        <text
          key={j}
          className="col"
          fontSize={font}
          transform={`translate(${colX[j] + cw / 2 + 4},${TOP - 6}) rotate(-55)`}
        >
          {translateCountry(matrix.origins[j])}
        </text>
      ))}
      {o.rows.map((i) => {
        const node = matrix.rows[i];
        const active = node.id === selectedId;
        return (
          <g key={node.id}>
            {active && (
              <rect
                x="0"
                y={rowY[i]}
                width={gridR}
                height={rh}
                fill="#6f4e37"
                opacity="0.12"
              />
            )}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: row label selects the flavor; the sunburst offers keyboard selection */}
            <g
              onClick={() => onSelectRow?.(node.id)}
              style={onSelectRow ? { cursor: "pointer" } : undefined}
            >
              <rect
                x="2"
                y={rowY[i] + rh / 2 - 4}
                width="8"
                height="8"
                rx="2"
                fill={getFlavorColor(node.path.slice(0, 1))}
              />
              <text
                x="16"
                y={rowY[i] + rh / 2 + font * 0.36}
                fontSize={font}
                className={active ? "row active" : "row"}
              >
                {rowLabel(node)}
              </text>
            </g>
            {o.cols.map((j) => {
              const c = matrix.cells[i][j];
              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: cells mirror the row label and the hover readout
                <rect
                  key={j}
                  x={colX[j] + 1}
                  y={rowY[i] + 1}
                  width={cw - 2}
                  height={rh - 2}
                  rx="3"
                  fill={
                    color === "vsup" ? vsupColor(c.v, c.level) : plainColor(c.v)
                  }
                  onMouseEnter={() => setCell([i, j])}
                  onClick={() => {
                    setCell([i, j]);
                    onSelectRow?.(node.id);
                  }}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
          </g>
        );
      })}
      {similar &&
        notes.rows.map((g) => {
          const ys = g.members.map((i) => rowY[i]);
          const y0 = Math.min(...ys);
          const y1 = Math.max(...ys) + rh;
          return (
            <g key={`r${g.id}`} className="group-note">
              <path d={`M${gridR + 6},${y0 + 2}h5V${y1 - 2}h-5`} fill="none" />
              <text x={gridR + 16} y={(y0 + y1) / 2 - 2}>
                {g.lines[0]}
              </text>
              {g.lines[1] && (
                <text x={gridR + 16} y={(y0 + y1) / 2 + 12}>
                  {g.lines[1]}
                </text>
              )}
            </g>
          );
        })}
      {similar &&
        notes.cols.map((g, q) => {
          const xs = g.members.map((j) => colX[j]);
          const x0 = Math.min(...xs);
          const x1 = Math.max(...xs) + cw;
          return (
            <g key={`c${g.id}`} className="group-note">
              <path d={`M${x0 + 2},${gridB + 6}v5H${x1 - 2}v-5`} fill="none" />
              {/* neighbouring notes alternate rows so narrow groups do not collide */}
              <text
                x={(x0 + x1) / 2}
                y={gridB + 24 + (q % 2) * 15}
                textAnchor="middle"
              >
                {g.lines[0]}
              </text>
            </g>
          );
        })}
      {hover && (
        <g pointerEvents="none">
          <rect
            x={LABW}
            y={rowY[hover[0]]}
            width={gridR - LABW}
            height={rh}
            fill="none"
            stroke="#6f4e37"
          />
          <rect
            x={colX[hover[1]]}
            y={TOP}
            width={cw}
            height={gridB - TOP}
            fill="none"
            stroke="#6f4e37"
          />
          <rect
            x={colX[hover[1]] - 1.5}
            y={rowY[hover[0]] - 1.5}
            width={cw + 3}
            height={rh + 3}
            rx="4"
            fill="none"
            stroke="#2a211b"
            strokeWidth="2"
          />
        </g>
      )}
    </svg>
  );
}
