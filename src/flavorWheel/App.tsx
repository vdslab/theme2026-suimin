import { useMemo, useState } from "react";
import csvText from "../../data/roasterdb_sample.csv?raw";
import { buildFlavorTree, parseBeans } from "./data";
import FlavorWheelGraph from "./FlavorWheelGraph";
import { type BeanOrder, computeLayout } from "./layout";
import type { RingRoute } from "./ringRouting";
import { categoryColor } from "./scaOrder";

const beans = parseBeans(csvText);
const tree = buildFlavorTree(beans);

export default function App() {
  const [beta, setBeta] = useState(0.85);
  const [route, setRoute] = useState<RingRoute>("hierarchy");
  const [beanOrder, setBeanOrder] = useState<BeanOrder>("flavor");
  const [showBeanLabels, setShowBeanLabels] = useState(true);

  const layout = useMemo(
    () => computeLayout(tree, beans, { treeRadius: 190, tagRadius: 280, beanRadius: 440, beanOrder }),
    [beanOrder],
  );

  const stats = useMemo(() => {
    const perBean = beans.map((b) => b.tags.length);
    const hist = new Map<number, number>();
    for (const n of perBean) hist.set(n, (hist.get(n) ?? 0) + 1);
    const byDepth = [1, 2, 3].map((d) => layout.tags.filter((t) => t.depth === d).length);
    return {
      edges: layout.edges.length,
      byDepth,
      mean: perBean.reduce((a, b) => a + b, 0) / perBean.length,
      hist: [...hist].sort((a, b) => a[0] - b[0]),
    };
  }, [layout]);

  const level1 = layout.tags.filter((t) => t.depth === 1);

  return (
    <div className="fw-app">
      <aside className="fw-panel">
        <h1>Flavor Wheel × 豆</h1>
        <p className="fw-muted">
          豆 {beans.length} 件 / エッジ {stats.edges} 本 / タグ L1 {stats.byDepth[0]}・L2 {stats.byDepth[1]}・L3{" "}
          {stats.byDepth[2]}
        </p>
        <p className="fw-muted">
          タグ数/豆: 平均 {stats.mean.toFixed(2)}（{stats.hist.map(([n, c]) => `${n}:${c}`).join(" ")}）
        </p>

        <label>
          バンドル強度 β = {beta.toFixed(2)}
          <input type="range" min={0} max={1} step={0.05} value={beta} onChange={(e) => setBeta(+e.target.value)} />
        </label>
        <p className="fw-hint">0 = 豆からタグへ螺旋で直行（束ねない）、1 = 制御点どおり</p>

        <label>
          円環内の経路
          <select value={route} onChange={(e) => setRoute(e.target.value as RingRoute)}>
            <option value="hierarchy">豆 → L1角度 → L2角度 → タグ（階層順に束ねる）</option>
            <option value="midRing">豆 → Rmid 上を移動 → タグ（タグ単位で束ねる）</option>
          </select>
        </label>
        <p className="fw-hint">関係エッジは R1（末端タグ）〜 R2（豆）の円環内だけを通る</p>

        <label>
          豆の並び順
          <select value={beanOrder} onChange={(e) => setBeanOrder(e.target.value as BeanOrder)}>
            <option value="flavor">接続タグの平均角度順</option>
            <option value="csv">CSV の行順</option>
          </select>
        </label>

        <label className="fw-check">
          <input type="checkbox" checked={showBeanLabels} onChange={(e) => setShowBeanLabels(e.target.checked)} />
          豆名ラベルを表示
        </label>

        <h2>凡例</h2>
        <svg width="220" height="44" aria-hidden="true">
          <line x1="4" y1="12" x2="44" y2="12" className="fw-legend-tree" />
          <text x="52" y="15">Flavor Wheel の階層エッジ</text>
          <line x1="4" y1="32" x2="44" y2="32" stroke="#e03a3e" className="fw-legend-rel" />
          <text x="52" y="35">豆 → タグ（大分類色）</text>
        </svg>
        <ul className="fw-legend">
          {level1.map((t) => (
            <li key={t.id}>
              <span style={{ background: categoryColor(t.name) }} />
              {t.name}（{t.beanIds.size}）
            </li>
          ))}
        </ul>
        <p className="fw-hint">豆・タグにホバーで関連エッジを強調。豆の色は最多の大分類。</p>
      </aside>
      <main className="fw-main">
        <FlavorWheelGraph layout={layout} beta={beta} route={route} showBeanLabels={showBeanLabels} />
      </main>
    </div>
  );
}
