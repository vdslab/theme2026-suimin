import { flavorName, flavorPath } from "./lib/flavorJapanese";
import { useEffect, useMemo, useState } from "react";
import {
  buildFlavorData,
  buildFlavorNetwork,
  MAX_BEANS,
  MAX_FLAVORS,
} from "./lib/flavorData";
import SunburstFlavorChart from "./components/SunburstFlavorChart";
import FlavorNetworkDetail from "./components/FlavorNetworkDetail";
import "./flavor-explorer.css";

export default function FlavorExplorerPage() {
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");
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
        setSelectedId(result.initialId);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, []);
  const network = useMemo(
    () => data && buildFlavorNetwork(data, selectedId),
    [data, selectedId],
  );
  return (
    <main className="flavor-explorer">
      <header className="flavor-header">
        <div>
          <span className="flavor-eyebrow">コーヒー研究室 / 試作その１</span>
          <h1>味からつながる、コーヒー。</h1>
          <p>階層をひらく。豆をたどる。意外な味のつながりを探す。</p>
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
          <div className="flavor-grid">
            <section className="flavor-card flavor-sunburst-card">
              <div className="flavor-section-heading">
                <span>その１ / 味の階層</span>
                <h2>味の全体像</h2>
                <p>
                  内側から大分類 → 中分類 → 末端タグ。好きな区画をクリック。
                </p>
              </div>
              <SunburstFlavorChart
                data={data}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
              <p className="flavor-note">
                区画の角度は末端タグの種類数、件数はユニークな豆数です。区画に触れると味の階層パスを確認できます。
              </p>
            </section>
            <section className="flavor-card">
              <div className="flavor-section-heading">
                <span>その２ / 味と豆のつながり</span>
                <h2 style={{ color: data.color(network.selected.path) }}>
                  {flavorName(network.selected.name)}
                </h2>
                <p>{flavorPath(network.selected.path)}</p>
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
                onSelect={setSelectedId}
              />
              <p className="flavor-note">
                豆は味タグの信頼度上位{MAX_BEANS}
                件、共起味は全該当豆での頻度上位
                {MAX_FLAVORS}件。単一タグの豆も中心に接続。
              </p>
            </section>
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
