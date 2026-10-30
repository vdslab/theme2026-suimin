import { flavorName, flavorPath } from "./lib/flavorJapanese";
import { useEffect, useMemo, useState } from "react";
import {
  buildFlavorData,
  buildFlavorNetwork,
  MAX_BEANS,
  MAX_FLAVORS,
  toggleFlavorSelection,
} from "./lib/flavorData";
import SunburstFlavorChart from "./components/SunburstFlavorChart";
import FlavorNetworkDetail from "./components/FlavorNetworkDetail";
import FlavorBeanList from "./components/FlavorBeanList";
import "./flavor-explorer.css";

export default function FlavorExplorerPage() {
  const [data, setData] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [allThree, setAllThree] = useState(false);
  const [notice, setNotice] = useState("");
  const selectFlavor = (id) => {
    const next = toggleFlavorSelection(data, selectedIds, id);
    setNotice(next === selectedIds ? "最大3つまで選択できます" : "");
    setSelectedIds(next);
    setSelectedBeanId(null);
    setHoveredBeanId(null);
    setAllThree(false);
  };
  const [selectedBeanId, setSelectedBeanId] = useState(null);
  const [hoveredBeanId, setHoveredBeanId] = useState(null);
  const [isListOpen, setIsListOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isListOpen) {
        setIsListOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isListOpen]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}api/flavor-data.csv`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok)
          throw new Error(`CSVを読み込めません (${response.status})`);
        return response.text();
      })
      .then((csv) => {
        const result = buildFlavorData(csv);
        if (!result.initialId)
          throw new Error(
            "有効な味タグが見つかりません。CSVの配置とカラムを確認してください。",
          );
        setData(result);
        setSelectedIds([result.initialId]);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, []);
  const network = useMemo(
    () => data && buildFlavorNetwork(data, selectedIds, allThree),
    [data, selectedIds, allThree],
  );
  return (
    <main className="flavor-explorer">
      <header className="flavor-header">
        <div>
          <span className="flavor-eyebrow">コーヒー研究室</span>
          <h1>味からつながる、コーヒー。</h1>
        </div>
        <a href="#">地図に戻る ↗</a>
      </header>
      {error ? (
        <div role="alert" className="flavor-card">
          <h2>データを読み込めませんでした</h2>
          <p>{error}</p>
          <p>
            data/private/roasterdb/2026.10/roasterdb_export.csv を配置し、npm
            run dev または npm run preview で開いてください。
          </p>
        </div>
      ) : !network ? (
        <p role="status">CSVを読み込んで味の階層を構築しています…</p>
      ) : (
        <>
          <div className="flavor-overview">
            <span>
              <b>{data.beans.length.toLocaleString()}</b> タグ付き豆
            </span>
            <span>
              <b>{data.nodes.size - 1}</b> 階層ノード
            </span>
            <span>
              {data.totalProducts.toLocaleString()} 商品 /{" "}
              {data.totalRows.toLocaleString()} CSV行
            </span>
            <span>焙煎所データ · 2026年10月</span>
          </div>
          <div className="flavor-panels-viewport">
            <div
              className={`flavor-panels-track ${
                isListOpen ? "is-list-open" : ""
              }`}
            >
              {/* パネル1: 味の階層（サンバースト図） */}
              <section className="flavor-card flavor-panel-sunburst flavor-sunburst-card">
                <div className="flavor-section-heading">
                  <h2>味の全体像</h2>
                  <p>
                    内側から大分類 → 中分類 → 末端タグ。好きな区画をクリック。
                  </p>
                </div>
                <SunburstFlavorChart
                  data={data}
                  selectedIds={selectedIds}
                  onSelect={selectFlavor}
                />
              </section>

              {/* パネル2: 味と豆のつながり（ネットワーク図） */}
              <section className="flavor-card flavor-panel-network">
                <div className="flavor-section-heading flavor-network-heading">
                  <div>
                    <h2>味と豆を探索</h2>
                  </div>
                  <button
                    type="button"
                    className="flavor-view-toggle-btn"
                    onClick={() => setIsListOpen((prev) => !prev)}
                    title={
                      isListOpen
                        ? "味の階層（サンバースト図）に戻る"
                        : "豆リストを右側に並べて表示"
                    }
                  >
                    {isListOpen ? "≪ 味の階層を表示" : "リストを表示 ≫"}
                  </button>
                </div>
                <div className="flavor-selection-controls">
                  {network.selectedFlavors.map((node) => (
                    <button
                      type="button"
                      className="flavor-selection-chip"
                      key={node.id}
                      style={{ borderColor: data.color(node.path) }}
                      onClick={() => selectFlavor(node.id)}
                      aria-label={`${flavorPath(node.path)}の選択解除`}
                    >
                      {flavorPath(node.path)} ×
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={!selectedIds.length}
                    onClick={() => {
                      setSelectedIds([]);
                      setSelectedBeanId(null);
                      setAllThree(false);
                      setNotice("");
                    }}
                  >
                    全選択解除
                  </button>
                  {selectedIds.length === 3 && (
                    <label>
                      <input
                        type="checkbox"
                        checked={allThree}
                        onChange={(e) => setAllThree(e.target.checked)}
                      />
                      3つすべて一致のみ
                    </label>
                  )}
                  <span role="status">{notice}</span>
                  <small>
                    最大3つ。親子の味は後から選んだ味に置き換えます。未選択時は左の図から選択してください。
                  </small>
                </div>
                <div className="flavor-stats">
                  <div>
                    <b>{network.matchedCount.toLocaleString()}</b>
                    <span>該当豆数</span>
                  </div>
                  <div>
                    <b>{network.cooccurrenceCount}</b>
                    <span>共起味数</span>
                  </div>
                  <div>
                    <b>{network.beans.length}</b>
                    <span>表示中の豆</span>
                  </div>
                </div>
                <div className="flavor-network-key">
                  <span>● 味ノード</span>
                  <span>◦ 豆ノード</span>
                  <span>ドラッグで移動 / スクロールでズーム</span>
                </div>
                <FlavorNetworkDetail
                  network={network}
                  color={data.color}
                  onSelect={(id) => {
                    selectFlavor(id);
                    setSelectedBeanId(null);
                  }}
                  selectedBeanId={selectedBeanId}
                  onSelectBean={(b) => setSelectedBeanId(b?.id ?? null)}
                  hoveredBeanId={hoveredBeanId}
                  onHoverBean={setHoveredBeanId}
                />
                <p className="flavor-note">
                  {network.beans.length} /{" "}
                  {network.matchedCount.toLocaleString()}件表示 · 上限
                  {MAX_BEANS}件 · 関連味{MAX_FLAVORS}件
                </p>
              </section>

              {/* パネル3: 豆の一覧（豆リスト） */}
              <section className="flavor-card flavor-panel-beans">
                <FlavorBeanList
                  beans={network.beans}
                  color={data.color}
                  onSelectFlavor={(id) => {
                    selectFlavor(id);
                    setSelectedBeanId(null);
                  }}
                  selectedBeanId={selectedBeanId}
                  onSelectBean={(b) => setSelectedBeanId(b?.id ?? null)}
                  hoveredBeanId={hoveredBeanId}
                  onHoverBean={setHoveredBeanId}
                  selectedFlavorPaths={network.selectedFlavors.map(
                    (n) => n.path,
                  )}
                  onClose={() => setIsListOpen(false)}
                />
              </section>
            </div>
          </div>
          <footer className="flavor-footer">
            分類参考：SCAフレーバーホイール ·
            データ：焙煎所データベース（2026年10月） ·
            ローカル検討用プロトタイプ
          </footer>
        </>
      )}
    </main>
  );
}
