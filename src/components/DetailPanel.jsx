import { clusterColor, shortName, TASTE_AXES } from "../lib/clusters";
import { nearestByTaste } from "../lib/coffeeData";
import { translateCountry } from "../lib/countryNames";

function DetailPanel({ selectedCoffee, onClose, onSelectCoffee }) {
  if (!selectedCoffee) {
    return (
      <aside className="bg-base-100 p-6 h-full flex flex-col justify-center items-center">
        <div className="rounded-box border border-dashed border-base-300 bg-base-200/50 p-6 text-center">
          <p className="text-sm text-base-content/60">
            マップ上の国をクリックして
            <br />
            精製方法を選ぶと、
            <br />
            ここに詳細が表示されます。
          </p>
        </div>
      </aside>
    );
  }

  const c = selectedCoffee;
  const color = clusterColor(c.clusterName);

  const devs = TASTE_AXES.map((a) => ({
    ...a,
    dev: c.deviation?.[`${a.en}_dev`] ?? 0,
    score: c.scores?.[a.en] ?? 0,
  })).sort((a, b) => b.dev - a.dev);
  const maxAbs = Math.max(...devs.map((d) => Math.abs(d.dev)), 0.001);

  const probs = Object.entries(c.probs)
    .filter(([, p]) => p >= 0.01)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const neighbors = nearestByTaste(c, 3);

  return (
    <aside className="bg-base-100 h-full flex flex-col relative overflow-hidden">
      {/* 閉じるボタン */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 btn btn-circle btn-sm btn-ghost bg-base-200 hover:bg-base-300 z-10"
      >
        ✕
      </button>

      <div className="p-6 overflow-y-auto flex-1">
        <div className="rounded-box border border-base-300 bg-base-200 p-4 space-y-4 mt-8">
          <div>
            <span
              className="inline-block rounded-lg px-2.5 py-1 text-xs font-semibold text-white leading-snug mb-2"
              style={{ backgroundColor: color }}
            >
              {shortName(c.clusterName)}
            </span>
            <h2 className="text-xl font-bold leading-tight">{c.region}</h2>
            <div className="text-sm font-semibold text-base-content/60 mt-1 mb-2">
              {translateCountry(c.country)}
            </div>
            <p className="text-sm text-base-content/60">精製方法：{c.method}</p>
            <p className="text-xs text-base-content/50 mt-1">
              参考にした豆の数：{c.sampleCount} 件
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">
              味わいの特徴（この産地の傾向）
            </h3>
            <div className="space-y-2">
              {devs.map((d) => {
                const pct = (Math.abs(d.dev) / maxAbs) * 50;
                const positive = d.dev >= 0;
                return (
                  <div key={d.key} className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 text-base-content/70">
                      {d.label}
                    </span>
                    <div className="relative flex-1 h-3 rounded bg-base-300/40">
                      <div className="absolute inset-y-0 left-1/2 w-px bg-base-content/20" />
                      <div
                        className="absolute inset-y-0 rounded"
                        style={{
                          left: positive ? "50%" : `${50 - pct}%`,
                          width: `${pct}%`,
                          backgroundColor: positive ? color : "#cbd5e1",
                        }}
                      />
                    </div>
                    <span
                      className={`w-12 shrink-0 text-right font-semibold ${
                        positive ? "" : "text-base-content/40"
                      }`}
                    >
                      {d.dev >= 0 ? "+" : ""}
                      {d.dev.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-base-content/40 mt-2">
              右にいくほど、この産地で強く感じられる味です
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">
              含まれる主な品種
            </h3>
            {c.varieties?.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {c.varieties.map((v) => (
                  <span
                    key={v}
                    className="badge badge-ghost badge-sm font-normal"
                  >
                    {v}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-base-content/40">品種情報なし</p>
            )}
          </div>

          {probs.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">
                味わいのタイプ（近さ）
              </h3>
              <div className="space-y-1.5">
                {probs.map(([name, p]) => {
                  const isNoiseRow = name === "noise";
                  const rowColor = isNoiseRow ? "#9ca3af" : clusterColor(name);
                  return (
                    <div key={name} className="text-xs">
                      <div className="flex justify-between mb-0.5">
                        <span className="truncate max-w-[200px] text-base-content/80">
                          {isNoiseRow
                            ? "個性派（独自の味わい）"
                            : shortName(name)}
                        </span>
                        <span className="font-semibold">
                          {(p * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-base-300/40 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${p * 100}%`,
                            backgroundColor: rowColor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {neighbors.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">
                味が近い豆
              </h3>
              <div className="space-y-1.5">
                {neighbors.map((n, i) => {
                  const nColor = clusterColor(n.clusterName);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => onSelectCoffee?.(n)}
                      className="flex w-full items-center gap-2.5 rounded-lg bg-base-100 p-2 text-left hover:bg-base-300/40 transition-colors"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-base-300/60 text-[10px] font-bold text-base-content/60">
                        {i + 1}
                      </span>
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: nColor }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {n.region} - {translateCountry(n.country)}
                        </span>
                        <span className="block truncate text-[11px] text-base-content/50">
                          {n.method} ・ {shortName(n.clusterName)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export default DetailPanel;
