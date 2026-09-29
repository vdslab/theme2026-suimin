// 描画: SVG。D3 はパス文字列の生成にだけ使い、DOM は React が持つ。
import { linkRadial, lineRadial } from "d3-shape";
import { useMemo, useRef, useState } from "react";
import { PATH_SEP } from "./data";
import { type BeanNode, type Polar, type TagNode, toXY, type WheelLayout } from "./layout";
import { type RingRoute, routeEdge } from "./ringRouting";

interface Props {
  layout: WheelLayout;
  beta: number;
  route: RingRoute;
  showBeanLabels: boolean;
}

type Hover = { kind: "bean"; id: string } | { kind: "tag"; id: string } | null;

const VIEW = 590;
const RAD2DEG = 180 / Math.PI;

// 階層エッジは linkRadius で止める（末端タグの点は R1 にあり、その間にラベルが入る）
const treeLinkPath = linkRadial<{ source: TagNode; target: TagNode }, TagNode>()
  .angle((d) => d.angle)
  .radius((d) => d.linkRadius);

// 経路はすでに密にサンプリング済みなので直線でつなぐだけ
const ringLine = lineRadial<Polar>()
  .angle((d) => d.angle)
  .radius((d) => d.radius);

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/**
 * 円周上のラベルを放射方向に回転し、左半分は読める向きに反転する。
 * inward なら radius から中心側へ伸ばす
 */
function radialLabel(angle: number, radius: number, inward = false) {
  const deg = angle * RAD2DEG - 90;
  const flip = angle > Math.PI;
  return {
    transform: `rotate(${deg}) translate(${radius},0)${flip ? " rotate(180)" : ""}`,
    textAnchor: (flip !== inward ? "end" : "start") as "end" | "start",
  };
}

function xyAt(angle: number, radius: number) {
  const [cx, cy] = toXY({ angle, radius });
  return { cx, cy };
}

function isUnder(tagId: string, ancestorId: string) {
  return tagId === ancestorId || tagId.startsWith(ancestorId + PATH_SEP);
}

export default function FlavorWheelGraph({ layout, beta, route, showBeanLabels }: Props) {
  const [hover, setHover] = useState<Hover>(null);
  const [mouse, setMouse] = useState<[number, number]>([0, 0]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const edgePaths = useMemo(
    () => layout.edges.map((e) => ringLine(routeEdge(e, layout.radii, beta, route)) ?? ""),
    [layout, beta, route],
  );

  // ホバー対象から、強調する豆・タグ・エッジを決める
  const active = useMemo(() => {
    if (!hover) return null;
    const beans = new Set<string>();
    const tags = new Set<string>();
    let edgeOn: (beanId: string, tagId: string) => boolean;
    if (hover.kind === "bean") {
      beans.add(hover.id);
      const bean = layout.beans.find((b) => b.bean.id === hover.id);
      for (const t of bean?.bean.tags ?? []) {
        const parts = t.split(PATH_SEP);
        for (let d = 1; d <= parts.length; d++) tags.add(parts.slice(0, d).join(PATH_SEP));
      }
      edgeOn = (beanId) => beanId === hover.id;
    } else {
      const tag = layout.tagById.get(hover.id);
      for (const id of tag?.beanIds ?? []) beans.add(id);
      for (const t of layout.tags) {
        if (isUnder(t.id, hover.id) || isUnder(hover.id, t.id)) tags.add(t.id);
      }
      edgeOn = (_, tagId) => isUnder(tagId, hover.id);
    }
    return { beans, tags, edgeOn };
  }, [hover, layout]);

  const onMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) setMouse([e.clientX - rect.left, e.clientY - rect.top]);
  };

  const hoveredBean: BeanNode | undefined =
    hover?.kind === "bean" ? layout.beans.find((b) => b.bean.id === hover.id) : undefined;
  const hoveredTag: TagNode | undefined =
    hover?.kind === "tag" ? layout.tagById.get(hover.id) : undefined;

  const edgeIdx = layout.edges.map((_, i) => i);
  const activeEdgeIdx = active
    ? edgeIdx.filter((i) => active.edgeOn(layout.edges[i].beanId, layout.edges[i].tagId))
    : [];
  const activeEdgeSet = new Set(activeEdgeIdx);

  return (
    <div className="fw-graph" ref={wrapRef} onMouseMove={onMove}>
      <svg viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`} role="img" aria-label="Flavor wheel">
        {/* 関係エッジ専用の円環 R1〜R2 */}
        <circle
          className="fw-annulus"
          r={(layout.radii.tag + layout.radii.bean) / 2}
          strokeWidth={layout.radii.bean - layout.radii.tag}
        />

        {/* 階層リングのガイド */}
        <g className="fw-rings">
          {layout.radii.levels.slice(1, -1).map((r, i) => (
            <g key={r}>
              <circle r={r} />
              <text y={-r - 3}>L{i + 1}</text>
            </g>
          ))}
          <circle r={layout.radii.tag} className="fw-tag-ring" />
          <text y={-layout.radii.tag - 3}>R1</text>
          <circle r={layout.radii.bean} className="fw-bean-ring" />
          <text y={-layout.radii.bean - 3}>R2</text>
        </g>

        {/* 豆 → タグ の関係エッジ（大分類色・半透明の曲線） */}
        <g className={`fw-edges${active ? " is-dimmed" : ""}`}>
          {edgeIdx
            .filter((i) => !activeEdgeSet.has(i))
            .map((i) => (
              <path key={i} d={edgePaths[i]} stroke={layout.edges[i].color} />
            ))}
        </g>

        {/* Flavor Wheel 自体の階層エッジ（灰色の実線） */}
        <g className="fw-tree-links">
          {layout.treeLinks.map((l) => (
            <path
              key={l.target.id}
              d={treeLinkPath(l) ?? ""}
              className={active?.tags.has(l.target.id) ? "is-active" : ""}
            />
          ))}
        </g>

        <g className="fw-edges is-active">
          {activeEdgeIdx.map((i) => (
            <path key={i} d={edgePaths[i]} stroke={layout.edges[i].color} />
          ))}
        </g>

        {/* Flavor タグ */}
        <g className="fw-tags">
          {layout.tags.map((t) => {
            const [x, y] = toXY(t);
            const r = t.isLeaf ? 2 + Math.sqrt(t.beanIds.size) * 0.9 : t.depth === 1 ? 7 : 4.5;
            const dim = active && !active.tags.has(t.id);
            const label = radialLabel(t.angle, t.radius - r - 4, true);
            return (
              <g
                key={t.id}
                className={`fw-tag depth-${t.depth}${dim ? " is-dim" : ""}`}
                onMouseEnter={() => setHover({ kind: "tag", id: t.id })}
                onMouseLeave={() => setHover(null)}
              >
                <circle cx={x} cy={y} r={r} fill={t.color} />
                {t.isLeaf && <circle className="fw-link-end" {...xyAt(t.angle, t.linkRadius)} r={1.5} />}
                {t.isLeaf ? (
                  <text transform={label.transform} textAnchor={label.textAnchor} dy="0.32em">
                    {t.name}
                  </text>
                ) : (
                  <text x={x} y={y - r - 3} textAnchor="middle" className="fw-halo">
                    {t.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* 豆ノード（外周に均等配置） */}
        <g className="fw-beans">
          {layout.beans.map((b) => {
            const [x, y] = toXY(b);
            const on = active?.beans.has(b.bean.id);
            const dim = active && !on;
            const label = radialLabel(b.angle, b.radius + 7);
            return (
              <g
                key={b.bean.id}
                className={`fw-bean${on ? " is-active" : ""}${dim ? " is-dim" : ""}`}
                onMouseEnter={() => setHover({ kind: "bean", id: b.bean.id })}
                onMouseLeave={() => setHover(null)}
              >
                <circle cx={x} cy={y} r={on ? 5 : 3} fill={b.color} />
                {(showBeanLabels || on) && (
                  <text transform={label.transform} textAnchor={label.textAnchor} dy="0.32em">
                    {truncate(b.bean.name, 30)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {(hoveredBean || hoveredTag) && (
        <div
          className="fw-tooltip"
          // 右半分では左側に出して画面外へはみ出さないようにする
          style={
            mouse[0] > (wrapRef.current?.clientWidth ?? 0) / 2
              ? { right: (wrapRef.current?.clientWidth ?? 0) - mouse[0] + 14, top: mouse[1] + 14 }
              : { left: mouse[0] + 14, top: mouse[1] + 14 }
          }
        >
          {hoveredBean && (
            <>
              <strong>{hoveredBean.bean.name}</strong>
              <div className="fw-muted">{hoveredBean.bean.roaster}</div>
              <div>origin_country: {hoveredBean.bean.country || "—"}</div>
              <div>origin_region: {hoveredBean.bean.region || "—"}</div>
              <div className="fw-muted">tasting_notes_sca_nodes ({hoveredBean.bean.tags.length})</div>
              <ul>
                {hoveredBean.bean.tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          )}
          {hoveredTag && (
            <>
              <strong>{hoveredTag.id}</strong>
              <div>このタグ（以下）を持つ豆: {hoveredTag.beanIds.size} 件</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
