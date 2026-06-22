import { clusterColor, shortName, TASTE_AXES } from "../lib/clusters";

function DetailPanel({ selectedCoffee }) {
  if (!selectedCoffee) {
    return (
      <aside className="bg-base-100 p-6">
        <div className="rounded-box border border-dashed border-base-300 bg-base-200/50 p-6 text-center">
          <p className="text-sm text-base-content/60">
            マップ上の点をクリックすると、
            <br />
            ここに詳細が表示されます。
          </p>
        </div>
      </aside>
    );
  }

  const c = selectedCoffee;
  const color = clusterColor(c.clusterName);

  // 偏差6軸を「強い順」に並べる（味の形）。最大絶対値でバー幅を正規化。
  const devs = TASTE_AXES.map((a) => ({
    ...a,
    dev: c.deviation?.[`${a.en}_dev`] ?? 0,
    score: c.scores?.[a.en] ?? 0,
  })).sort((a, b) => b.dev - a.dev);
  const maxAbs = Math.max(...devs.map((d) => Math.abs(d.dev)), 0.001);

  // 所属確率（降順、1%以上）
  const probs = Object.entries(c.probs)
    .filter(([, p]) => p >= 0.01)
    .sort(([, a], [, b]) => b - a);

  return (
    <aside className="bg-base-100 p-6 overflow-y-auto">
      <div className="rounded-box border border-base-300 bg-base-200 p-5 space-y-5">
        {/* ヘッダー */}
        <div>
          <span
            className="inline-block rounded-lg px-2.5 py-1 text-xs font-semibold text-white leading-snug mb-2"
            style={{ backgroundColor: color }}
          >
            {shortName(c.clusterName)}
          </span>
          <h2 className="text-xl font-bold leading-tight">{c.country}</h2>
          <p className="text-sm text-base-content/60">製法: {c.method}</p>
          <p className="text-xs text-base-content/50 mt-1">
            このグループのサンプル数: {c.sampleCount} 件
          </p>
        </div>

        {/* 味の形（偏差） */}
        <div>
          <h3 className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">
            味の形（このグループ内での相対バランス）
          </h3>
          <div className="space-y-2">
            {devs.map((d) => {
              const pct = (Math.abs(d.dev) / maxAbs) * 50; // 半幅50%基準
              const positive = d.dev >= 0;
              return (
                <div key={d.key} className="flex items-center gap-2 text-xs">
                  <span className="w-16 shrink-0 text-base-content/70">
                    {d.label}
                  </span>
                  {/* 中央0の発散バー */}
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
            右（色付き）＝相対的に強い味、左（グレー）＝相対的に弱い味
          </p>
        </div>

        {/* 品種 */}
        {c.varieties?.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">
              含まれる品種
            </h3>
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
          </div>
        )}

        {/* 所属確率 */}
        {probs.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">
              クラスタ所属確率
            </h3>
            <div className="space-y-1.5">
              {probs.map(([name, p]) => {
                const isNoiseRow = name === "noise";
                const rowColor = isNoiseRow ? "#9ca3af" : clusterColor(name);
                return (
                  <div key={name} className="text-xs">
                    <div className="flex justify-between mb-0.5">
                      <span className="truncate max-w-[200px] text-base-content/80">
                        {isNoiseRow ? "ノイズ (独自路線)" : shortName(name)}
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
      </div>
    </aside>
  );
}

export default DetailPanel;
