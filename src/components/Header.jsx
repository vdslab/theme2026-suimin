import { useMemo, useState } from "react";
import { coffeeData } from "../lib/coffeeData";
import { translateCountry } from "../lib/countryNames";

// 並べ替えモードの説明。トグルの真下に出して、2つの図の関係を1行で伝える。
const VIEW_CAPTION = {
  taste: "味の近さで並べた図。6つのクラスタがはっきり分かれる",
  map: "同じ豆を産地に並べ替えた図。クラスタは産地ごとに混ざる",
};

export default function Header({
  searchQuery,
  setSearchQuery,
  onOpenGuide,
  viewMode,
  setViewMode,
}) {
  // 候補をクリック（選択）したら閉じる。再度入力があれば開き直す。
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);

  const searchSuggestions = useMemo(() => {
    const values = coffeeData.flatMap((item) => [
      translateCountry(item.country),
      item.admin1,
      item.variety,
    ]);

    return [...new Set(values)]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, []);

  const filteredSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return [];

    return searchSuggestions
      .filter((suggestion) => suggestion.toLowerCase().includes(query))
      .slice(0, 8);
  }, [searchQuery, searchSuggestions]);

  return (
    <div className="absolute top-3 left-3 sm:top-6 sm:left-6 z-30 flex flex-col gap-4 pointer-events-none">
      <div className="flex gap-4 items-start pointer-events-auto">
        <div className="bg-base-100 p-3 sm:p-4 rounded-2xl shadow-lg border border-base-200">
          <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
            <h1 className="text-lg sm:text-2xl font-bold text-primary">
              Coffee Taste Map
            </h1>
            <button
              type="button"
              onClick={onOpenGuide}
              className="btn btn-sm btn-circle btn-ghost text-base-content/60 hover:text-base-content"
              title="使い方を見る"
              aria-label="使い方を見る"
            >
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
            </button>
          </div>

          {/* 並べ替えモードの切り替え。同じ1206点を味覚空間↔産地でモーフさせる。 */}
          <div className="mb-2 sm:mb-3">
            <div className="inline-flex rounded-lg bg-base-200 p-0.5">
              {[
                ["taste", "味覚空間"],
                ["map", "地図"],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={viewMode === mode}
                  onClick={() => setViewMode(mode)}
                  className={`rounded-md px-3 py-1 text-xs sm:text-sm font-semibold transition-colors ${
                    viewMode === mode
                      ? "bg-base-100 text-primary shadow-sm"
                      : "text-base-content/60 hover:text-base-content"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 max-w-[16rem] sm:max-w-xs text-[11px] leading-snug text-base-content/60">
              {VIEW_CAPTION[viewMode]}
            </p>
          </div>

          <div className="relative">
            <input
              type="text"
              className="input input-bordered input-sm sm:input-md w-full max-w-[16rem] sm:max-w-xs"
              placeholder="産地・品種で検索"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSuggestionsDismissed(false);
              }}
            />
            {!suggestionsDismissed && filteredSuggestions.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-box border border-base-300 bg-base-100 shadow-xl overflow-hidden">
                {filteredSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-base-200"
                    onClick={() => {
                      setSearchQuery(suggestion);
                      setSuggestionsDismissed(true);
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
