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
import { translateCountry } from "./lib/countryNames";
import { flavorName } from "./lib/flavorJapanese";
import { matrixHighlights } from "./lib/flavorMatrix";
import { formatBags, MIN_ORIGIN_BEANS } from "./lib/flavorStats";
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

export function MatrixHighlights({ matrix }) {
  const items = matrixHighlights(matrix);
  if (!items.length) return null;
  return (
    <ul className="flavor-matrix-highlights">
      {items.map((c) => (
        <li key={`${c.i}-${c.j}`}>
          <b>{translateCountry(matrix.origins[c.j])}</b>の豆は、
          <b>{flavorName(matrix.rows[c.i].name)}</b>
          の味が書かれた豆が平均の{c.ratio.toFixed(1)}倍（10袋中
          {formatBags(c.p)}袋）
        </li>
      ))}
    </ul>
  );
}

function MatrixSection({ data, attributes, selectedId, onSelect }) {
  const [level, setLevel] = useState("mid");
  const { matrix, orders, notes } = useFlavorMatrix(data, attributes, level);
  const [similar, setSimilar] = useState(true);
  const [vsup, setVsup] = useState(true);
  const [cell, setCell] = useState(null);
  return (
    <section className="flavor-card flavor-matrix-card">
      <div className="flavor-section-heading flavor-network-heading">
        <div>
          <span>味 × 産地の早見表</span>
          <h2>どの産地でどの味に出会えるか</h2>
          <p>
            茶色が濃いほど、その産地の豆に、その味が平均より多く書かれています（青緑は少ない）。件数が少なく確かでないマスは、薄い色にまとめています。行を押すと上の詳細に切り替わります。
          </p>
        </div>
        <div className="flavor-toggle-row">
          <Toggle
            pressed={level === "mid"}
            onClick={() => setLevel((v) => (v === "mid" ? "leaf" : "mid"))}
          >
            {level === "mid" ? "味をまとめて表示" : "味を細かく表示"}
          </Toggle>
          <Toggle pressed={similar} onClick={() => setSimilar((v) => !v)}>
            {similar ? "似ている順" : "ホイール順"}
          </Toggle>
          <Toggle pressed={vsup} onClick={() => setVsup((v) => !v)}>
            {vsup ? "不確かさを込めた配色" : "普通の配色"}
          </Toggle>
        </div>
      </div>
      <MatrixHighlights matrix={matrix} />
      <div className="flavor-matrix-scroll">
        <FlavorMatrix
          matrix={matrix}
          orders={orders}
          notes={notes}
          level={level}
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
            ? "行と列は、出方の似ているものが隣に来るように並べています（階層クラスタリング＋最適葉順序）。すき間はまとまりの区切りで、右と下にそのまとまりの特徴を書いています。"
            : "行は SCA フレーバーホイールの順、列は豆の件数の多い順。"}
          {vsup
            ? "確かさは、割合の95%区間の幅で4段階に分けています（VSUP）。"
            : "件数0のマスは最も濃い青になります。"}
          焙煎度は豆の一部でしか分からないため、列には入れていません。
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
          <h1>味から選ぶ産地と焙煎</h1>
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
                    {view === "sunburst"
                      ? "味の全体像"
                      : "焙煎の味？産地の味？"}
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
                    焙煎か産地か
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
