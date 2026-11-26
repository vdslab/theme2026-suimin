import { useEffect, useState } from "react";
import FlavorCharacterMap from "./components/FlavorCharacterMap";
import FlavorDetail from "./components/FlavorDetail";
import FlavorMatrix, {
  describeCell,
  MatrixLegend,
  useFlavorMatrix,
} from "./components/FlavorMatrix";
import SunburstFlavorChart from "./components/SunburstFlavorChart";
import { useFlavorData } from "./hooks/useFlavorData";
import { MIN_ORIGIN_BEANS } from "./lib/flavorStats";
import "./flavor-explorer.css";

export const datasetLabel = (version) => {
  const [y, m] = String(version ?? "").split(".");
  return m ? `${y}年${Number(m)}月` : "";
};

export function FlavorCredits({ version }) {
  return (
    <footer className="flavor-footer">
      <p>
        Data: RoasterDB (DataEngineered)
        {datasetLabel(version) ? `, ${datasetLabel(version)}取得` : ""} ／
        Flavor taxonomy: SCA Coffee Taster's Flavor Wheel
      </p>
      <p>
        値は、店の説明文に書かれた味の傾向です。各焙煎所とは関係のない非公式の可視化です。
      </p>
    </footer>
  );
}

function LoadError({ error }) {
  return (
    <div role="alert" className="flavor-card">
      <h2>データを読み込めませんでした</h2>
      <p>{error}</p>
      <p>
        src/data/flavor_beans.json がない場合は、data/private
        に有料データを配置して npm run export:flavor-data を実行してください。
      </p>
    </div>
  );
}

function Toggle({ pressed, onClick, children }) {
  return (
    <button
      type="button"
      className="flavor-view-toggle-btn"
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MatrixSection({ data, attributes, selectedId, onSelect }) {
  const { matrix, orders } = useFlavorMatrix(data, attributes);
  const [similar, setSimilar] = useState(true);
  const [vsup, setVsup] = useState(true);
  const [cell, setCell] = useState(null);
  return (
    <section className="flavor-card flavor-matrix-card">
      <div className="flavor-section-heading flavor-network-heading">
        <div>
          <span>全体マップ</span>
          <h2>どの産地で、どの味に出会いやすいか</h2>
          <p>
            色は、その産地の豆で全体平均より出やすいか（茶）、出にくいか（青緑）。件数が少なく確かでないマスほど、色が薄くまとまります。行を押すと上の詳細に切り替わります。
          </p>
        </div>
        <div className="flavor-toggle-row">
          <Toggle pressed={similar} onClick={() => setSimilar((v) => !v)}>
            {similar ? "似ている順" : "ホイール順"}
          </Toggle>
          <Toggle pressed={vsup} onClick={() => setVsup((v) => !v)}>
            {vsup ? "不確かさを込めた配色" : "普通の配色"}
          </Toggle>
        </div>
      </div>
      <div className="flavor-matrix-scroll">
        <FlavorMatrix
          matrix={matrix}
          orders={orders}
          order={similar ? "similar" : "wheel"}
          color={vsup ? "vsup" : "plain"}
          selectedId={selectedId}
          onSelectRow={onSelect}
          onHover={setCell}
        />
      </div>
      <p className="flavor-matrix-readout" aria-live="polite">
        {cell
          ? describeCell(matrix, cell[0], cell[1])
          : "マスにカーソルを合わせると、件数と10袋中何袋かが出ます。"}
      </p>
      <div className="flavor-matrix-key">
        <MatrixLegend color={vsup ? "vsup" : "plain"} />
        <p className="flavor-note">
          {similar
            ? "行と列は出方の似ている順（階層クラスタリング＋最適葉順序）。端の線は、近くでつながるほど出方が似ていることを表す。列のすき間は産地を4つのまとまりに分けた位置。"
            : "行は SCA フレーバーホイールの順、列は豆の件数の多い順。"}
          {vsup
            ? "不確かさは、割合の95%区間の幅で4段階に分けた（VSUP）。"
            : "件数0のマスは最も濃い青になる。"}
          焙煎度は豆の一部でしか分からないため、列には入れていない。
        </p>
      </div>
    </section>
  );
}

export default function FlavorExplorerPage() {
  const { data, attributes, error } = useFlavorData();
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("sunburst");
  useEffect(() => {
    if (data && !selectedId) setSelectedId(data.initialId);
  }, [data, selectedId]);
  const node = data && selectedId ? data.nodes.get(selectedId) : null;
  // One flavor at a time: choosing the selected flavor again keeps it.
  const select = (id) => {
    if (data?.nodes.get(id)?.path.length) setSelectedId(id);
  };
  return (
    <main className="flavor-explorer">
      <header className="flavor-header">
        <div>
          <span className="flavor-eyebrow">コーヒー研究室</span>
          <h1>味から選ぶ、産地と焙煎。</h1>
        </div>
        <a href="#map">地図に戻る ↗</a>
      </header>
      {error ? (
        <LoadError error={error} />
      ) : !data ? (
        <p role="status">データを読み込んで味の階層を構築しています…</p>
      ) : (
        <>
          <div className="flavor-overview">
            <span>
              <b>{data.beans.length.toLocaleString()}</b> タグ付き豆
            </span>
            <span>
              <b>{attributes.origins.length}</b> 産地（{MIN_ORIGIN_BEANS}
              件以上）
            </span>
            <span>
              {data.totalProducts.toLocaleString()} 商品 /{" "}
              {data.totalRows.toLocaleString()} CSV行
            </span>
            <span>焙煎所データ · {datasetLabel(data.datasetVersion)}</span>
          </div>
          <div className="flavor-main">
            <section className="flavor-card flavor-sunburst-card">
              <div className="flavor-section-heading flavor-network-heading">
                <div>
                  <h2>
                    {view === "sunburst" ? "味の全体像" : "味の性格マップ"}
                  </h2>
                  <p>
                    {view === "sunburst"
                      ? "内側から大分類 → 中分類 → 末端タグ。好きな区画をクリック。"
                      : "焙煎で決まる味か、産地で決まる味か。点をクリック。"}
                  </p>
                </div>
                <div className="flavor-toggle-row">
                  <Toggle
                    pressed={view === "sunburst"}
                    onClick={() => setView("sunburst")}
                  >
                    全体像
                  </Toggle>
                  <Toggle
                    pressed={view === "character"}
                    onClick={() => setView("character")}
                  >
                    性格マップ
                  </Toggle>
                </div>
              </div>
              {view === "sunburst" ? (
                <SunburstFlavorChart
                  data={data}
                  selectedIds={selectedId ? [selectedId] : []}
                  onSelect={select}
                />
              ) : (
                <FlavorCharacterMap
                  data={data}
                  selectedId={selectedId}
                  onSelect={select}
                />
              )}
            </section>
            <section
              className="flavor-card flavor-detail-card"
              aria-live="polite"
            >
              <div className="flavor-section-heading">
                <span>選んだ味</span>
              </div>
              <FlavorDetail data={data} attributes={attributes} node={node} />
            </section>
          </div>
          <MatrixSection
            data={data}
            attributes={attributes}
            selectedId={selectedId}
            onSelect={(id) => {
              select(id);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
          <FlavorCredits version={data.datasetVersion} />
        </>
      )}
    </main>
  );
}

export { LoadError };
