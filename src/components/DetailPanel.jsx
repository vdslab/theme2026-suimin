import { ChevronDown, MapPin, X } from "lucide-react";
import { useState } from "react";
import { clusterColor, shortName, TASTE_AXES } from "../lib/clusters";
import { coffeeData, nearestByTaste } from "../lib/coffeeData";
import { translateCountry } from "../lib/countryNames";

// 見出しクリックで開閉できるセクション。デフォルトは開いた状態。
function Section({ id, title, collapsed, onToggle, children }) {
  const open = !collapsed[id];
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between mb-2"
      >
        <h3 className="text-xs font-bold text-base-content/50 uppercase tracking-wider">
          {title}
        </h3>
        <ChevronDown
          size={16}
          className={`text-base-content/40 transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
      </button>
      {open && children}
    </div>
  );
}

function DetailPanel({
  selectedCoffee,
  onClose,
  onSelectCoffee,
  drankCoffees = {},
  onUpdateDrank,
  onRemoveDrank,
}) {
  // 好み度スライダーの一時値（id ごと）。未操作なら記録値、それも無ければ 3。
  const [scoreDraft, setScoreDraft] = useState({});
  // 折りたたみ状態（id: true で閉じる）。空 = 全て開いている。
  const [collapsed, setCollapsed] = useState({});
  const toggleSection = (id) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  if (!selectedCoffee) {
    return (
      <aside className="bg-base-100 p-6 h-full flex flex-col justify-center items-center">
        <div className="rounded-box border border-dashed border-base-300 bg-base-200/50 p-6 text-center">
          <p className="text-sm text-base-content/60">
            マップ上の豆(点)をクリックすると、
            <br />
            ここに詳細が表示されます。
          </p>
        </div>
      </aside>
    );
  }

  const c = selectedCoffee;
  const color = clusterColor(c.clusterName);

  const isDrank = drankCoffees[c.id] !== undefined;
  const score = scoreDraft[c.id] ?? drankCoffees[c.id] ?? 3;

  // 同じ国の豆一覧（1豆=1ノードなので同じ地域の豆も別々に並ぶ）。
  // 産地の多い国では数百件になるため、地域名順に並べて表示件数を絞る。
  const SAME_COUNTRY_LIMIT = 50;
  const sameCountryBeans = coffeeData
    .filter((n) => n.country === c.country)
    .sort((a, b) => a.admin1.localeCompare(b.admin1) || a.id - b.id);
  const sameCountryShown = sameCountryBeans.slice(0, SAME_COUNTRY_LIMIT);

  const devs = TASTE_AXES.map((a) => ({
    ...a,
    dev: c.deviation?.[`${a.en}_dev`] ?? 0,
    score: c.scores?.[a.en] ?? 0,
  }));
  const maxAbs = Math.max(...devs.map((d) => Math.abs(d.dev)), 0.001);

  const probs = Object.entries(c.probs)
    .filter(([, p]) => p >= 0.01)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const neighbors = nearestByTaste(c, 3);

  return (
    <aside className="bg-base-100 h-full flex flex-col overflow-hidden">
      <div className="p-4 overflow-y-auto flex-1">
        <div className="rounded-box border border-base-300 bg-base-200 p-4 space-y-4">
          <div>
            {/* クラスタバッジと閉じるボタンを1行に並べ、専用バーの隙間をなくす */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <span
                className="inline-block rounded-lg px-2.5 py-1 text-xs font-semibold text-white leading-snug"
                style={{ backgroundColor: color }}
              >
                {shortName(c.clusterName)}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost btn-xs btn-circle shrink-0 -mr-1 -mt-1"
                title="閉じる"
                aria-label="閉じる"
              >
                <X size={18} />
              </button>
            </div>
            <h2 className="text-xl font-bold leading-tight">
              {translateCountry(c.country)}
            </h2>
            <p className="flex items-center gap-1 text-sm text-base-content/60">
              <MapPin size={13} className="shrink-0" />
              {c.admin1}
            </p>
            <p className="text-xs text-base-content/50 mt-1">
              {[c.variety, c.processingMethod].filter(Boolean).join(" ・ ") ||
                "品種・精製方法は不明"}
            </p>
          </div>

          <Section
            id="score"
            title="好み度を入力"
            collapsed={collapsed}
            onToggle={toggleSection}
          >
            <div className="flex justify-between text-[10px] px-1 text-base-content/60 font-medium mb-1">
              <span>苦手</span>
              <span>普通</span>
              <span>好み</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={score}
              onChange={(e) =>
                setScoreDraft((prev) => ({
                  ...prev,
                  [c.id]: Number(e.target.value),
                }))
              }
              className="range range-sm range-primary"
            />
            {isDrank ? (
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => onRemoveDrank?.(c.id)}
                  className="btn btn-sm btn-outline btn-error flex-1"
                >
                  解除
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateDrank?.(c.id, score)}
                  className="btn btn-sm btn-primary flex-1"
                >
                  更新
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onUpdateDrank?.(c.id, score)}
                className="btn btn-sm btn-primary w-full mt-3"
              >
                飲んだ！
              </button>
            )}
          </Section>

          {sameCountryBeans.length > 1 && (
            <Section
              id="regions"
              title={`同じ国の豆（${sameCountryBeans.length}件）`}
              collapsed={collapsed}
              onToggle={toggleSection}
            >
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                {sameCountryShown.map((n) => {
                  const active = n.id === c.id;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => onSelectCoffee?.(n)}
                      className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                        active
                          ? "border-primary bg-primary/10"
                          : "border-base-200 hover:bg-base-300/40"
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: clusterColor(n.clusterName) }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1 text-sm font-medium">
                          <MapPin
                            size={12}
                            className="shrink-0 text-base-content/40"
                          />
                          <span className="truncate">{n.admin1}</span>
                        </span>
                        <span className="block truncate text-[11px] text-base-content/50">
                          {[n.variety, shortName(n.clusterName)]
                            .filter(Boolean)
                            .join(" ・ ")}
                        </span>
                      </span>
                      {drankCoffees[n.id] !== undefined && (
                        <span className="badge badge-primary badge-sm shrink-0">
                          好み {drankCoffees[n.id]}
                        </span>
                      )}
                    </button>
                  );
                })}
                {sameCountryBeans.length > sameCountryShown.length && (
                  <p className="px-2 py-1 text-[11px] text-base-content/40">
                    ほか {sameCountryBeans.length - sameCountryShown.length}{" "}
                    件（地図上の点から選べます）
                  </p>
                )}
              </div>
            </Section>
          )}

          <Section
            id="taste"
            title="味わいの特徴（この豆）"
            collapsed={collapsed}
            onToggle={toggleSection}
          >
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
              右にいくほど、この豆で強く感じられる味です
            </p>
          </Section>

          <Section
            id="varieties"
            title="この豆の情報"
            collapsed={collapsed}
            onToggle={toggleSection}
          >
            <dl className="space-y-1 text-xs">
              {[
                ["品種", c.variety],
                ["精製方法", c.processingMethod],
                ["標高", c.altitude != null ? `${Math.round(c.altitude)} m` : null],
                [
                  "総合スコア",
                  c.totalCupPoints != null ? c.totalCupPoints.toFixed(2) : null,
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-base-content/50">{label}</dt>
                  <dd
                    className={`truncate text-right ${
                      value ? "font-medium" : "text-base-content/30"
                    }`}
                  >
                    {value ?? "不明"}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          {probs.length > 0 && (
            <Section
              id="types"
              title="味わいのタイプ（近さ）"
              collapsed={collapsed}
              onToggle={toggleSection}
            >
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
            </Section>
          )}

          {neighbors.length > 0 && (
            <Section
              id="neighbors"
              title="味が近い豆"
              collapsed={collapsed}
              onToggle={toggleSection}
            >
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
                          {translateCountry(n.country)}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-base-content/50">
                          <MapPin size={10} className="shrink-0" />
                          <span className="truncate">
                            {n.admin1} ・ {shortName(n.clusterName)}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      </div>
    </aside>
  );
}

export default DetailPanel;
