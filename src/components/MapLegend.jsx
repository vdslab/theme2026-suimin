import { clusterColor, shortName, isNoise, clusterIndex } from "../lib/clusters";
import { coffeeData } from "../lib/coffeeData";

const legendClusters = (() => {
  const set = new Set(coffeeData.map((d) => d.clusterName));
  return Array.from(set).sort((a, b) => {
    if (isNoise(a)) return 1;
    if (isNoise(b)) return -1;
    return (clusterIndex(a) ?? 0) - (clusterIndex(b) ?? 0);
  });
})();

export default function MapLegend({ activeCluster, toggleCluster, setActiveCluster }) {
  return (
    <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-2 p-4 bg-base-100 rounded-2xl shadow-lg border border-base-200 pointer-events-auto">
      <span className="text-sm font-semibold text-base-content/70">味覚クラスタ:</span>
      <div className="flex flex-wrap items-center gap-2 max-w-[400px]">
        {legendClusters.map((name) => {
          const color = clusterColor(name);
          const selected = activeCluster === name;
          const dimmed = activeCluster !== null && !selected;
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggleCluster(name)}
              className={`badge gap-1.5 cursor-pointer border transition ${dimmed ? "opacity-30" : "hover:scale-105"}`}
              style={{ backgroundColor: selected ? color : "transparent", borderColor: color, color: selected ? "#fff" : color }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selected ? "#fff" : color }} />
              {shortName(name)}
            </button>
          );
        })}
        {activeCluster && (
          <button type="button" onClick={() => setActiveCluster(null)} className="btn btn-ghost btn-xs">
            絞り込み解除
          </button>
        )}
      </div>
    </div>
  );
}
