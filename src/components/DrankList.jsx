import { Sparkles, X } from "lucide-react";
import { clusterColor } from "../lib/clusters";
import { coffeeData } from "../lib/coffeeData";
import { translateCountry } from "../lib/countryNames";

// id から豆ノードを引くための索引（coffeeData は不変なのでモジュール読込時に一度だけ作る）。
// drankCoffees のキーはオブジェクトのため常に文字列化される。数値idと突き合わせるためキーも文字列に揃える。
const nodeById = new Map(coffeeData.map((c) => [String(c.id), c]));

// 飲んだ豆の一覧を左側に常設し、その場で選択・解除できるようにするパネル。
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
  // 追加順(drankOrder)で並べる＝新しく飲んだ豆ほど下に来る。
  // 万一 order に載っていないidがあっても取りこぼさないよう補完する。
  const orderedIds = [
    ...drankOrder.filter((id) => id in drankCoffees),
    ...Object.keys(drankCoffees).filter((id) => !drankOrder.includes(id)),
  ];
  const entries = orderedIds.map((id) => [id, drankCoffees[id]]);

  return (
    <div className="absolute top-40 left-6 z-20 flex max-h-[calc(100vh-22rem)] w-[260px] flex-col rounded-2xl border border-base-200 bg-base-100 shadow-lg pointer-events-auto">
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
