import { useMemo, useState } from "react";
import { translateCountry } from "../lib/countryNames";
import { getFlavorColor } from "../lib/flavorColorUtils";
import { flavorName } from "../lib/flavorJapanese";
import {
  buildMatrix,
  matrixOrders,
  plainColor,
  UNCERTAINTY_JA,
  VSUP_BINS,
  vsupColor,
} from "../lib/flavorMatrix";
import { formatBags } from "../lib/flavorStats";
import { sunburstHierarchy } from "../lib/sunburstLayout";

// Rows with fewer tagged beans than this are left out of the map.
const MIN_ROW_BEANS = 20;
const CW = 20;
const RH = 15;
const LABW = 128;
const TOP = 78;
const DENW = 48;
const DENH = 36;
const RAMP = Array.from({ length: 17 }, (_, s) => -2 + s / 4);

// Leaves in the sunburst's (SCA wheel) order.
export function matrixRows(data) {
  return sunburstHierarchy(data.root)
    .leaves()
    .map((n) => n.data)
    .filter((n) => n.path.length >= 2 && n.beanIds.size >= MIN_ROW_BEANS);
}

export function useFlavorMatrix(data, attributes) {
  return useMemo(() => {
    const matrix = buildMatrix(data, attributes, matrixRows(data));
    return { matrix, orders: matrixOrders(matrix) };
  }, [data, attributes]);
}

// Dendrogram segments from a tree whose leaves are drawn in order.
function dendrogram(tree, leafPos, depth) {
  const max = tree.height || 1;
  const segs = [];
  const walk = (node) => {
    if (node.index !== undefined) return { pos: leafPos(node.index), h: 0 };
    const a = walk(node.left);
    const b = walk(node.right);
    const h = node.height / max;
    segs.push(
      [a.pos, a.h, a.pos, h],
      [a.pos, h, b.pos, h],
      [b.pos, b.h, b.pos, h],
    );
    return { pos: (a.pos + b.pos) / 2, h };
  };
  walk(tree);
  return segs.map(([p1, h1, p2, h2]) => [p1, h1 * depth, p2, h2 * depth]);
}

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
          ×1/4以下
        </text>
        <text x={8 * 15 + 7.5} y="28" textAnchor="middle" className="leg">
          平均
        </text>
        <text x="255" y="28" textAnchor="end" className="leg">
          ×4以上
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
          {Array.from({ length: nb }, (_, b) => (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed bins
              key={b}
              x={X0 + (b * LW) / nb}
              y={2 + level * 12}
              width={LW / nb}
              height="11"
              fill={vsupColor(-2 + ((b + 0.5) * 4) / nb, level)}
            />
          ))}
          <text x={X0 - 6} y={11 + level * 12} textAnchor="end" className="leg">
            {UNCERTAINTY_JA[level]}
          </text>
        </g>
      ))}
      <text x={X0} y="62" className="leg">
        ×1/4以下
      </text>
      <text x={X0 + LW / 2} y="62" textAnchor="middle" className="leg">
        平均
      </text>
      <text x={X0 + LW} y="62" textAnchor="end" className="leg">
        ×4以上
      </text>
    </svg>
  );
}

export function describeCell(matrix, i, j) {
  const c = matrix.cells[i][j];
  return `${translateCountry(matrix.origins[j])} × ${flavorName(matrix.rows[i].name)}：${c.t.toLocaleString()}袋中${c.k}袋（10袋中${formatBags(c.p)}袋）、全体平均の${c.ratio.toFixed(2)}倍、確かさ：${UNCERTAINTY_JA[c.level]}`;
}

export default function FlavorMatrix({
  matrix,
  orders,
  order = "similar",
  color = "vsup",
  selectedId,
  onSelectRow,
  onHover,
}) {
  const [hover, setHover] = useState(null);
  const similar = order === "similar";
  const o = orders[order];
  const layout = useMemo(() => {
    const rowY = [];
    let y = TOP;
    o.rows.forEach((i, p) => {
      if (
        !similar &&
        p &&
        matrix.rows[i].path[0] !== matrix.rows[o.rows[p - 1]].path[0]
      )
        y += 6;
      rowY[i] = y;
      y += RH;
    });
    const colX = [];
    let x = LABW;
    o.cols.forEach((j, p) => {
      if (
        similar &&
        p &&
        o.colGroups?.get(j) !== o.colGroups?.get(o.cols[p - 1])
      )
        x += 5;
      colX[j] = x;
      x += CW;
    });
    const gridR = x;
    const gridB = y;
    const rowDen =
      similar && o.rowTree
        ? dendrogram(o.rowTree, (i) => rowY[i] + RH / 2, DENW - 10)
        : [];
    const colDen =
      similar && o.colTree
        ? dendrogram(o.colTree, (j) => colX[j] + CW / 2, DENH - 10)
        : [];
    return { rowY, colX, gridR, gridB, rowDen, colDen };
  }, [matrix, o, similar]);
  const { rowY, colX, gridR, gridB } = layout;
  const W = gridR + (similar ? DENW : 44);
  const H = gridB + (similar ? DENH : 6);
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
      aria-label={`味と産地のヒートマップ（${similar ? "似ている順" : "ホイール順"}、${color === "vsup" ? "不確かさを込めた配色" : "普通の配色"}）`}
      onMouseLeave={() => setCell(null)}
    >
      {o.cols.map((j) => (
        <text
          key={j}
          className="col"
          transform={`translate(${colX[j] + CW / 2 + 3},${TOP - 6}) rotate(-60)`}
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
                height={RH}
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
                y={rowY[i] + 3.5}
                width="8"
                height="8"
                rx="2"
                fill={getFlavorColor(node.path.slice(0, 1))}
              />
              <text
                x="16"
                y={rowY[i] + 11.5}
                className={active ? "row active" : "row"}
              >
                {flavorName(node.name)}
              </text>
            </g>
            {o.cols.map((j) => {
              const c = matrix.cells[i][j];
              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: cells mirror the row label and the hover readout
                <rect
                  key={j}
                  x={colX[j] + 0.75}
                  y={rowY[i] + 0.75}
                  width={CW - 1.5}
                  height={RH - 1.5}
                  rx="2"
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
      {hover && (
        <g pointerEvents="none">
          <rect
            x={LABW}
            y={rowY[hover[0]]}
            width={gridR - LABW}
            height={RH}
            fill="none"
            stroke="#6f4e37"
          />
          <rect
            x={colX[hover[1]]}
            y={TOP}
            width={CW}
            height={gridB - TOP}
            fill="none"
            stroke="#6f4e37"
          />
          <rect
            x={colX[hover[1]] - 1.5}
            y={rowY[hover[0]] - 1.5}
            width={CW + 3}
            height={RH + 3}
            rx="3"
            fill="none"
            stroke="#2a211b"
            strokeWidth="2"
          />
        </g>
      )}
      {layout.rowDen.map(([p1, h1, p2, h2]) => (
        <line
          key={`r${p1}-${h1}-${p2}-${h2}`}
          x1={gridR + 5 + h1}
          y1={p1}
          x2={gridR + 5 + h2}
          y2={p2}
          className="den"
        />
      ))}
      {layout.colDen.map(([p1, h1, p2, h2]) => (
        <line
          key={`c${p1}-${h1}-${p2}-${h2}`}
          x1={p1}
          y1={gridB + 5 + h1}
          x2={p2}
          y2={gridB + 5 + h2}
          className="den"
        />
      ))}
    </svg>
  );
}
