import { useState } from "react";
import FlavorMatrix, {
  describeCell,
  MatrixLegend,
  useFlavorMatrix,
} from "./components/FlavorMatrix";
import { FlavorCredits, LoadError } from "./FlavorExplorerPage";
import { useFlavorData } from "./hooks/useFlavorData";
import "./flavor-explorer.css";

// Pages for the evaluation: the same data at the same cell size, either as
// the proposed map (#matrix: reordered, uncertainty palette) or a plain
// heatmap (#matrix-plain: wheel order, ordinary palette). No toggles, so
// participants cannot switch views.
export default function FlavorMatrixPage({ variant }) {
  const { data, attributes, error } = useFlavorData();
  const proposed = variant === "proposed";
  return (
    <main className="flavor-explorer">
      <header className="flavor-header">
        <div>
          <span className="flavor-eyebrow">コーヒー研究室</span>
          <h1>味と産地の早見表</h1>
        </div>
      </header>
      {error ? (
        <LoadError error={error} />
      ) : !data ? (
        <p role="status">データを読み込んでいます…</p>
      ) : (
        <MatrixOnly data={data} attributes={attributes} proposed={proposed} />
      )}
    </main>
  );
}

function MatrixOnly({ data, attributes, proposed }) {
  const { matrix, orders, notes } = useFlavorMatrix(data, attributes, "mid");
  const [cell, setCell] = useState(null);
  const color = proposed ? "vsup" : "plain";
  return (
    <>
      <section className="flavor-card flavor-matrix-card">
        <div className="flavor-section-heading">
          <h2>どの産地で、どの味に出会いやすいか</h2>
          <p>
            茶色が濃いほど、その産地の豆に、その味が平均より多く書かれています（青緑は少ない）。
            {proposed
              ? "件数が少なく確かでないマスほど、色が薄くまとまります。"
              : ""}
          </p>
        </div>
        <div className="flavor-matrix-scroll">
          <FlavorMatrix
            matrix={matrix}
            orders={orders}
            notes={notes}
            level="mid"
            order={proposed ? "similar" : "wheel"}
            color={color}
            onHover={setCell}
          />
        </div>
        <p className="flavor-matrix-readout" aria-live="polite">
          {cell
            ? describeCell(matrix, cell[0], cell[1])
            : "マスにカーソルを合わせると、件数と10袋中何袋かが出ます。"}
        </p>
        <div className="flavor-matrix-key">
          <MatrixLegend color={color} />
        </div>
      </section>
      <FlavorCredits version={data.datasetVersion} />
    </>
  );
}
