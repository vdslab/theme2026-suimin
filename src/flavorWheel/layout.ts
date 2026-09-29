// レイアウト計算: Flavor ツリーを放射状に、豆をその外周に配置する。描画は FlavorWheelGraph 側。
import { cluster, hierarchy, type HierarchyNode } from "d3-hierarchy";
import { type Bean, type FlavorNode, PATH_SEP } from "./data";
import { categoryColor, compareScaOrder } from "./scaOrder";

/** 角度は 12 時方向を 0 とした時計回り（d3.lineRadial と同じ規約） */
export interface Polar {
  angle: number;
  radius: number;
}

export interface TagNode extends Polar {
  id: string;
  name: string;
  depth: number;
  parentId: string | null;
  color: string;
  isLeaf: boolean;
  /** 階層エッジの終端半径。末端タグは点を R1 に置き、階層エッジはラベルの内側で止める */
  linkRadius: number;
  /** このノード以下のタグを持つ豆の id */
  beanIds: Set<string>;
}

export interface BeanNode extends Polar {
  bean: Bean;
  color: string;
}

export interface RelationEdge {
  beanId: string;
  tagId: string;
  color: string;
  bean: BeanNode;
  /** 大分類 → 中分類 → 末端タグ */
  chain: TagNode[];
}

export type BeanOrder = "flavor" | "csv";

export interface Radii {
  /** 階層エッジの各深さの半径（index 0 は中心） */
  levels: number[];
  /** R1: 末端タグ */
  tag: number;
  /** R2: 豆 */
  bean: number;
}

export interface WheelLayout {
  tags: TagNode[];
  tagById: Map<string, TagNode>;
  treeLinks: { source: TagNode; target: TagNode }[];
  beans: BeanNode[];
  edges: RelationEdge[];
  radii: Radii;
}

export function toXY({ angle, radius }: Polar): [number, number] {
  return [radius * Math.sin(angle), -radius * Math.cos(angle)];
}

const TAU = Math.PI * 2;

function circularMean(angles: number[]): number {
  if (angles.length === 0) return Number.POSITIVE_INFINITY;
  const s = angles.reduce((acc, a) => acc + Math.sin(a), 0);
  const c = angles.reduce((acc, a) => acc + Math.cos(a), 0);
  return (Math.atan2(s, c) + TAU) % TAU;
}

function level1Of(id: string): string {
  return id.split(PATH_SEP)[0];
}

export function computeLayout(
  tree: FlavorNode,
  beans: Bean[],
  opts: { treeRadius: number; tagRadius: number; beanRadius: number; beanOrder: BeanOrder },
): WheelLayout {
  const root = hierarchy(tree).sort((a, b) => compareScaOrder(a.data.name, b.data.name));
  // 角度だけ cluster で決め、半径は深さで固定する（葉の深さが揃っていなくても階層＝リングになる）
  cluster<FlavorNode>().size([TAU, 1])(root);

  const maxDepth = root.height;
  const levels = Array.from({ length: maxDepth + 1 }, (_, d) => (opts.treeRadius * d) / maxDepth);

  const beanIdsByTag = new Map<string, Set<string>>();
  for (const bean of beans) {
    for (const tag of bean.tags) {
      const parts = tag.split(PATH_SEP);
      for (let d = 1; d <= parts.length; d++) {
        const id = parts.slice(0, d).join(PATH_SEP);
        if (!beanIdsByTag.has(id)) beanIdsByTag.set(id, new Set());
        beanIdsByTag.get(id)?.add(bean.id);
      }
    }
  }

  const tags: TagNode[] = [];
  const tagById = new Map<string, TagNode>();
  root.each((n: HierarchyNode<FlavorNode>) => {
    if (n.depth === 0) return;
    const node: TagNode = {
      id: n.data.id,
      name: n.data.name,
      depth: n.depth,
      parentId: n.depth > 1 && n.parent ? n.parent.data.id : null,
      color: categoryColor(level1Of(n.data.id)),
      isLeaf: !n.children,
      angle: n.x ?? 0,
      radius: n.children ? levels[n.depth] : opts.tagRadius,
      linkRadius: levels[n.depth],
      beanIds: beanIdsByTag.get(n.data.id) ?? new Set(),
    };
    tags.push(node);
    tagById.set(node.id, node);
  });

  const treeLinks = tags
    .filter((t) => t.parentId !== null)
    .map((t) => ({ source: tagById.get(t.parentId as string) as TagNode, target: t }));

  // 豆の並び: 接続先タグ角度の円周平均でソートすると、エッジが近くのタグに向かい交差が減る
  const ordered =
    opts.beanOrder === "flavor"
      ? beans
          .map((bean) => ({
            bean,
            key: circularMean(bean.tags.map((t) => tagById.get(t)?.angle ?? 0)),
          }))
          .sort((a, b) => a.key - b.key)
          .map((d) => d.bean)
      : beans;

  const beanNodes: BeanNode[] = ordered.map((bean, i) => {
    const counts = new Map<string, number>();
    for (const t of bean.tags) counts.set(level1Of(t), (counts.get(level1Of(t)) ?? 0) + 1);
    const dominant = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    return {
      bean,
      angle: (TAU * (i + 0.5)) / ordered.length,
      radius: opts.beanRadius,
      color: categoryColor(dominant),
    };
  });

  const edges: RelationEdge[] = [];
  for (const b of beanNodes) {
    for (const tagId of b.bean.tags) {
      const target = tagById.get(tagId);
      if (!target) continue;
      const parts = tagId.split(PATH_SEP);
      const chain = parts.map((_, d) => tagById.get(parts.slice(0, d + 1).join(PATH_SEP)) as TagNode);
      edges.push({
        beanId: b.bean.id,
        tagId,
        color: target.color,
        bean: b,
        chain,
      });
    }
  }

  return {
    tags,
    tagById,
    treeLinks,
    beans: beanNodes,
    edges,
    radii: { levels, tag: opts.tagRadius, bean: opts.beanRadius },
  };
}
