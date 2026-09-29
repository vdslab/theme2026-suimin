// データ前処理: CSV → 豆リスト、tasting_notes_sca_nodes → SCA 階層ツリー
import { csvParse } from "d3-dsv";

export interface Bean {
  id: string;
  name: string;
  roaster: string;
  country: string;
  region: string;
  /** "Fruity > Citrus Fruit > Lemon" 形式のフルパス（重複除去済み） */
  tags: string[];
}

export interface FlavorNode {
  /** ルートからのフルパス。"Floral > Floral" のように同名が階層違いで現れるためパスで一意化する */
  id: string;
  name: string;
  children: FlavorNode[];
}

export const PATH_SEP = " > ";

/**
 * 実データは "A > B > C; A > B > D" の ; 区切り。
 * JSON 配列文字列や Python 風 ['a', 'b'] でも読めるようにしておく。
 */
export function parseTags(raw: string | undefined): string[] {
  const text = (raw ?? "").trim();
  if (!text) return [];
  let items: string[];
  if (text.startsWith("[")) {
    try {
      items = JSON.parse(text);
    } catch {
      items = JSON.parse(text.replace(/'/g, '"'));
    }
  } else {
    items = text.split(/[;|]/);
  }
  const normalized = items
    .map((s) =>
      String(s)
        .split(">")
        .map((p) => p.trim())
        .filter(Boolean)
        .join(PATH_SEP),
    )
    .filter(Boolean);
  return [...new Set(normalized)];
}

export function parseBeans(csvText: string): Bean[] {
  return csvParse(csvText).map((row, i) => ({
    id: row.product_id || String(i),
    name: row.title || row.name || row.product_name || `bean-${i}`,
    roaster: row.source_roaster ?? "",
    country: row.origin_country ?? "",
    region: row.origin_region ?? "",
    tags: parseTags(row.tasting_notes_sca_nodes),
  }));
}

/** 全豆のタグパスを 1 本のツリーにマージする（同じパスは 1 ノード） */
export function buildFlavorTree(beans: Bean[]): FlavorNode {
  const root: FlavorNode = { id: "", name: "root", children: [] };
  const index = new Map<string, FlavorNode>([["", root]]);
  for (const bean of beans) {
    for (const tag of bean.tags) {
      const parts = tag.split(PATH_SEP);
      let parent = root;
      parts.forEach((name, depth) => {
        const id = parts.slice(0, depth + 1).join(PATH_SEP);
        let node = index.get(id);
        if (!node) {
          node = { id, name, children: [] };
          index.set(id, node);
          parent.children.push(node);
        }
        parent = node;
      });
    }
  }
  return root;
}
