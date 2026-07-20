import { Sparkles, X } from "lucide-react";
import { clusterColor } from "../lib/clusters";
import { coffeeData } from "../lib/coffeeData";
import { translateCountry } from "../lib/countryNames";

// drankCoffees のキーは文字列化されるため、突き合わせ用にキーも文字列で持つ。
const nodeById = new Map(coffeeData.map((c) => [String(c.id), c]));

export default function DrankList({
  drankCoffees,
  drankOrder = [],
  onRemoveDrank,
  onClearDrank,
  onSelectCoffee,
  selectedCoffee,
  onRecommend,
  isRecommendedActive,
  onClearRecommendation,
}) {
  // 追加順で並べ（新しい豆ほど下）、order 漏れの id は末尾に補完する。
  const orderedIds = [
    ...drankOrder.filter((id) => id in drankCoffees),
    ...Object.keys(drankCoffees).filter((id) => !drankOrder.includes(id)),
  ];
  const entries = orderedIds.map((id) => [id, drankCoffees[id]]);

  return (
    <div className="absolute top-28 left-3 sm:top-40 sm:left-6 z-20 flex max-h-[calc(100vh-16rem)] sm:max-h-[calc(100vh-22rem)] w-[220px] sm:w-[260px] flex-col rounded-2xl border border-base-200 bg-base-100 shadow-lg pointer-events-auto">
      <div className="flex items-center justify-between gap-2 border-b border-base-200 px-4 pt-3 pb-2">
        <span className="text-sm font-semibold text-base-content/70">
          飲んだ豆（{entries.length}）
        </span>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("飲んだ豆をすべて解除しますか？")) {
                onClearDrank();
              }
            }}
            className="btn btn-ghost btn-xs text-error"
            title="すべて解除"
          >
            全解除
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto p-2">
        {entries.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-base-content/40">
            まだ飲んだ豆がありません
          </p>
        )}
        {entries.map(([id, score]) => {
          const c = nodeById.get(id);
          if (!c) return null;
          const isSelected = String(selectedCoffee?.id) === id;
          return (
            <div
              key={id}
              className={`flex items-center gap-1 rounded-lg p-1.5 transition-colors ${
                isSelected ? "bg-primary/10" : "hover:bg-base-200"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectCoffee?.(c)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: clusterColor(c.clusterName) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {translateCountry(c.country)}
                  </span>
                  <span className="block truncate text-[11px] text-base-content/50">
                    {c.admin1} ・ 好み {score}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onRemoveDrank(id)}
                className="btn btn-ghost btn-xs btn-circle shrink-0 text-error"
                aria-label={`${translateCountry(c.country)}を解除`}
                title="解除"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {entries.length > 0 && (
        <div className="border-t border-base-200 p-2">
          {isRecommendedActive ? (
            <button
              type="button"
              onClick={onClearRecommendation}
              className="btn btn-outline btn-sm w-full bg-base-100"
            >
              <X size={16} />
              おすすめを解除
            </button>
          ) : (
            <button
              type="button"
              onClick={onRecommend}
              className="btn btn-primary btn-sm w-full text-white"
            >
              <Sparkles size={16} />
              おすすめを計算する
            </button>
          )}
        </div>
      )}
    </div>
  );
}
