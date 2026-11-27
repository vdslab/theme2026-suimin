import { ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import FlavorDetail from "./components/FlavorDetail";
import FlavorWorldMap, { SIGNAL_COLORS } from "./components/FlavorWorldMap";
import SunburstFlavorChart from "./components/SunburstFlavorChart";
import { datasetLabel, LoadError } from "./FlavorExplorerPage";
import { useFlavorData } from "./hooks/useFlavorData";
import { flavorName } from "./lib/flavorJapanese";
import { shareBy } from "./lib/flavorStats";
import "./flavor-explorer.css";

// Prototype (#flavor-map): the root map's layout with the flavor data. The
// world map fills the screen, the flavor wheel floats on the left and the
// selected flavor's detail slides in on the right (bottom sheet on phones).
function useWindowSize() {
  const [size, setSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  useEffect(() => {
    const update = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

function MapLegend({ base, name }) {
  return (
    <div className="rounded-2xl border border-[#dccbb5] bg-[#fffbf3]/95 px-4 py-3 text-[11px] text-[#624833] shadow-lg">
      <p className="mb-2 font-semibold text-[#493426]">
        円の大きさ＝{name}の味が書かれた豆が10袋中何袋か
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {[
          ["hi", "平均より多い"],
          ["lo", "平均より少ない"],
          ["none", "平均と差がない"],
        ].map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <i
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: SIGNAL_COLORS[key] }}
            />
            {label}
          </span>
        ))}
        <span className="opacity-60">薄い円は件数が少なく確かでない</span>
      </div>
      <p className="mt-1">全体の平均は10袋中{(base * 10).toFixed(1)}袋</p>
    </div>
  );
}

export default function FlavorMapPage() {
  const { data, attributes, error } = useFlavorData();
  const [selectedId, setSelectedId] = useState(null);
  const [sheetMinimized, setSheetMinimized] = useState(false);
  const { width, height } = useWindowSize();
  const mobile = width < 640;
  useEffect(() => {
    if (data && !selectedId) setSelectedId(data.initialId);
  }, [data, selectedId]);
  const node = data && selectedId ? data.nodes.get(selectedId) : null;
  const origin = useMemo(
    () => (node ? shareBy(data, attributes, node, "origin") : null),
    [data, attributes, node],
  );
  const select = (id) => {
    if (data?.nodes.get(id)?.path.length) {
      setSelectedId(id);
      setSheetMinimized(false);
    }
  };
  const inset = useMemo(
    () =>
      mobile
        ? { left: 16, right: 16, top: 330, bottom: height * 0.4 + 16 }
        : { left: 440, right: 470, top: 60, bottom: 150 },
    [mobile, height],
  );
  if (error)
    return (
      <main className="flavor-explorer">
        <LoadError error={error} />
      </main>
    );
  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[#f2e8da] font-sans text-[#493426]">
      {origin && (
        <FlavorWorldMap
          width={width}
          height={height}
          inset={inset}
          rows={origin.rows}
          base={origin.base}
        />
      )}

      {/* 左上: タイトルと味の選択（最初の画面のヘッダーの位置） */}
      <div className="flavor-map-picker absolute top-3 left-3 z-30 w-[calc(100vw-24px)] rounded-2xl border border-[#dccbb5] bg-[#fffbf3]/95 p-3 shadow-lg sm:top-6 sm:left-6 sm:w-[24rem] sm:p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-lg font-bold sm:text-2xl">
            味から選ぶ産地と焙煎
          </h1>
          <a href="#map" className="text-xs whitespace-nowrap text-[#79502f]">
            地図に戻る ↗
          </a>
        </div>
        {data ? (
          <SunburstFlavorChart
            data={data}
            selectedIds={selectedId ? [selectedId] : []}
            onSelect={select}
          />
        ) : (
          <p role="status" className="py-8 text-sm">
            データを読み込んでいます…
          </p>
        )}
        {data && (
          <p className="mt-1 text-[10px] text-[#79634f]">
            {data.beans.length.toLocaleString()}件の豆 ·{" "}
            {attributes.origins.length}産地 · 焙煎所データ{" "}
            {datasetLabel(data.datasetVersion)}
          </p>
        )}
      </div>

      {/* 左下: 地図の凡例 */}
      {origin && !mobile && (
        <div className="absolute bottom-6 left-6 z-20 max-w-[24rem]">
          <MapLegend base={origin.base} name={flavorName(node.name)} />
        </div>
      )}

      {/* 右: 選んだ味の詳細（スマホでは下から出るシート） */}
      <div
        className={`absolute z-30 flex flex-col bg-[#fffbf3] shadow-2xl transition-transform duration-300 inset-x-0 bottom-0 h-[40dvh] rounded-t-2xl sm:inset-x-auto sm:top-0 sm:right-0 sm:bottom-auto sm:h-full sm:w-[28rem] sm:rounded-none ${
          !node
            ? "translate-y-full sm:translate-x-full sm:translate-y-0"
            : sheetMinimized
              ? "translate-y-[calc(40dvh-3rem)] sm:translate-y-0"
              : "translate-y-0"
        }`}
      >
        <button
          type="button"
          onClick={() => setSheetMinimized((m) => !m)}
          className="flex h-12 shrink-0 flex-col items-center justify-center gap-1 border-b border-[#eadcc9] sm:hidden"
          aria-label={sheetMinimized ? "詳細を展開" : "詳細を最小化"}
        >
          <span className="h-1.5 w-10 rounded-full bg-[#dccbb5]" />
          {sheetMinimized && node && (
            <span className="flex items-center gap-1 text-xs font-semibold">
              {flavorName(node.name)}
              <ChevronUp size={14} />
            </span>
          )}
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <span className="text-[11px] tracking-[0.2em] text-[#79634f]">
            選んだ味
          </span>
          {data && (
            <FlavorDetail
              data={data}
              attributes={attributes}
              node={node}
              showOriginMap={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
