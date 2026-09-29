import {
  ArrowUpDown,
  Building2,
  Droplet,
  ExternalLink,
  Flame,
  Globe2,
  Mountain,
  Search,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

export default function CoffeeBeanList({
  beans,
  selectedFlavor,
  onClearFlavor,
  onSelectFlavorPath,
  onSelectCoffee,
  selectedCoffee,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoast, setSelectedRoast] = useState("all");
  const [selectedProcess, setSelectedProcess] = useState("all");
  const [sortBy, setSortBy] = useState("default");

  // Extract unique roast levels and process methods for filter options
  const roastOptions = useMemo(() => {
    const set = new Set(beans.map((b) => b.roastLevel).filter(Boolean));
    return Array.from(set).sort();
  }, [beans]);

  const processOptions = useMemo(() => {
    const set = new Set(beans.map((b) => b.process).filter(Boolean));
    return Array.from(set).sort();
  }, [beans]);

  // Filter beans by flavor hierarchy, search query, roast level, and process
  const filteredBeans = useMemo(() => {
    return beans.filter((bean) => {
      // 1. Flavor Matching (hierarchical inclusion)
      if (selectedFlavor?.path) {
        const targetPath = selectedFlavor.path;
        const matchesFlavor = bean.tastingNotes.some((tn) => {
          return (
            tn.fullPath === targetPath ||
            tn.fullPath.startsWith(`${targetPath} >`) ||
            tn.category === targetPath ||
            `${tn.category} > ${tn.subcategory}` === targetPath
          );
        });
        if (!matchesFlavor) return false;
      }

      // 2. Search Query Matching (title, roaster, country, region, descriptor)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = bean.title.toLowerCase().includes(q);
        const matchRoaster = bean.roaster.toLowerCase().includes(q);
        const matchCountry = bean.country.toLowerCase().includes(q);
        const matchRegion = bean.region?.toLowerCase().includes(q);
        const matchNotes = bean.tastingNotes.some(
          (tn) =>
            tn.descriptor.toLowerCase().includes(q) ||
            tn.nameJa.toLowerCase().includes(q),
        );
        if (
          !matchTitle &&
          !matchRoaster &&
          !matchCountry &&
          !matchRegion &&
          !matchNotes
        ) {
          return false;
        }
      }

      // 3. Roast Level
      if (selectedRoast !== "all" && bean.roastLevel !== selectedRoast) {
        return false;
      }

      // 4. Process Method
      if (selectedProcess !== "all" && bean.process !== selectedProcess) {
        return false;
      }

      return true;
    });
  }, [beans, selectedFlavor, searchQuery, selectedRoast, selectedProcess]);

  // Sorted list
  const sortedBeans = useMemo(() => {
    const list = [...filteredBeans];
    if (sortBy === "price-asc") {
      list.sort((a, b) => a.priceValue - b.priceValue);
    } else if (sortBy === "price-desc") {
      list.sort((a, b) => b.priceValue - a.priceValue);
    } else if (sortBy === "confidence") {
      list.sort((a, b) => b.confidence - a.confidence);
    }
    return list;
  }, [filteredBeans, sortBy]);

  return (
    <div className="flex flex-col h-full bg-base-100/90 rounded-3xl p-4 shadow-sm border border-base-300/60 backdrop-blur-md overflow-hidden">
      {/* Active Flavor Badge Banner */}
      {selectedFlavor && (
        <div
          className="mb-3 p-3 rounded-2xl flex items-center justify-between gap-3 text-white shadow-md transition-all"
          style={{
            backgroundColor:
              selectedFlavor.color || "var(--color-primary, #6f4e37)",
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles
              size={18}
              className="shrink-0 animate-pulse text-yellow-200"
            />
            <div className="min-w-0">
              <div className="text-[11px] opacity-85 font-medium tracking-wide">
                絞り込み中のフレーバー
              </div>
              <div className="font-bold text-sm sm:text-base truncate flex items-baseline gap-1.5">
                <span>{selectedFlavor.nameJa || selectedFlavor.name}</span>
                <span className="text-xs opacity-80 font-normal">
                  ({selectedFlavor.name})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-bold">
              {filteredBeans.length} 銘柄
            </span>
            <button
              type="button"
              onClick={onClearFlavor}
              className="btn btn-circle btn-xs bg-white/25 hover:bg-white/40 border-none text-white"
              title="フレーバー条件を解除"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Search Bar & Filter Controls */}
      <div className="flex flex-col gap-2 pb-3 border-b border-base-200">
        <div className="relative w-full">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/50"
          />
          <input
            type="text"
            placeholder="豆の名前・ロースター・原産国・フレーバーで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input input-sm w-full pl-9 pr-8 bg-base-200/70 border-base-300 rounded-xl focus:bg-base-100 text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
              aria-label="検索ワードを消去"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters Row */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Roast Filter */}
          <select
            value={selectedRoast}
            onChange={(e) => setSelectedRoast(e.target.value)}
            className="select select-xs bg-base-200/70 rounded-lg text-xs"
            aria-label="焙煎度フィルター"
          >
            <option value="all">すべての焙煎度</option>
            {roastOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} Roast
              </option>
            ))}
          </select>

          {/* Process Filter */}
          <select
            value={selectedProcess}
            onChange={(e) => setSelectedProcess(e.target.value)}
            className="select select-xs bg-base-200/70 rounded-lg text-xs"
            aria-label="精製法フィルター"
          >
            <option value="all">すべての精製法</option>
            {processOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} Process
              </option>
            ))}
          </select>

          {/* Sort Selector */}
          <div className="ml-auto flex items-center gap-1 text-base-content/70">
            <ArrowUpDown size={12} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="select select-xs bg-base-200/70 rounded-lg text-xs"
              aria-label="並び替え順"
            >
              <option value="default">おすすめ順</option>
              <option value="price-asc">価格の安い順</option>
              <option value="price-desc">価格の高い順</option>
              <option value="confidence">フレーバー確信度順</option>
            </select>
          </div>
        </div>
      </div>

      {/* Result Count Status */}
      <div className="flex items-center justify-between py-2 text-xs text-base-content/70 font-medium">
        <span>
          該当コーヒー豆:{" "}
          <strong className="text-primary">{sortedBeans.length}</strong> /{" "}
          {beans.length} 銘柄
        </span>
        {(searchQuery ||
          selectedRoast !== "all" ||
          selectedProcess !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedRoast("all");
              setSelectedProcess("all");
            }}
            className="text-xs text-primary hover:underline"
          >
            フィルターをリセット
          </button>
        )}
      </div>

      {/* Beans Card List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 -mr-1 custom-scrollbar">
        {sortedBeans.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-base-200/40 rounded-2xl border border-dashed border-base-300">
            <Tag size={32} className="text-base-content/30 mb-2" />
            <div className="font-bold text-base-content/80 text-sm">
              該当するコーヒー豆が見つかりませんでした
            </div>
            <p className="text-xs text-base-content/60 mt-1 max-w-xs">
              検索ワードを変更するか、左側のフレーバーホイールから他のカテゴリを選択してみてください。
            </p>
            {selectedFlavor && (
              <button
                type="button"
                onClick={onClearFlavor}
                className="btn btn-xs btn-primary mt-3 rounded-full"
              >
                フレーバー選択を解除
              </button>
            )}
          </div>
        ) : (
          sortedBeans.map((bean) => {
            const isSelected = selectedCoffee && selectedCoffee.id === bean.id;

            return (
              <div
                key={bean.id}
                className={`w-full group text-left p-3.5 rounded-2xl transition-all border ${
                  isSelected
                    ? "bg-base-200 border-primary shadow-md ring-2 ring-primary/30"
                    : "bg-base-100 hover:bg-base-200/80 border-base-200 hover:border-base-300 shadow-xs hover:shadow-sm"
                }`}
              >
                {/* Header Meta: Roaster & Origin */}
                <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-primary truncate">
                    <Building2 size={13} className="shrink-0" />
                    <span className="truncate">{bean.roaster}</span>
                  </div>
                  <div className="flex items-center gap-1 text-base-content/70 shrink-0 bg-base-200/80 px-2 py-0.5 rounded-md font-medium text-[11px]">
                    <Globe2 size={11} />
                    <span>{bean.country}</span>
                    {bean.region && (
                      <span className="opacity-70">({bean.region})</span>
                    )}
                  </div>
                </div>

                {/* Title (Clickable) */}
                <button
                  type="button"
                  onClick={() => onSelectCoffee(bean)}
                  className="w-full text-left font-bold text-sm sm:text-base text-base-content group-hover:text-primary transition-colors line-clamp-2"
                >
                  {bean.title}
                </button>

                {/* Tags / Process / Roast */}
                <div className="flex items-center flex-wrap gap-1.5 mt-2">
                  <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100/80 text-amber-900 px-2 py-0.5 rounded-full font-medium">
                    <Flame size={10} />
                    {bean.roastLevel}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] bg-blue-100/80 text-blue-900 px-2 py-0.5 rounded-full font-medium">
                    <Droplet size={10} />
                    {bean.process}
                  </span>
                  {bean.altitude && bean.altitude !== "標高情報なし" && (
                    <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100/80 text-emerald-900 px-2 py-0.5 rounded-full font-medium">
                      <Mountain size={10} />
                      {bean.altitude}
                    </span>
                  )}
                </div>

                {/* Tasting Notes Chips */}
                <div className="mt-2.5 pt-2 border-t border-base-200/60 flex flex-wrap gap-1">
                  {bean.tastingNotes.map((note) => {
                    const isMatched =
                      selectedFlavor &&
                      (note.fullPath === selectedFlavor.path ||
                        note.fullPath.startsWith(`${selectedFlavor.path} >`) ||
                        note.category === selectedFlavor.path ||
                        `${note.category} > ${note.subcategory}` ===
                          selectedFlavor.path);

                    return (
                      <button
                        key={note.fullPath}
                        type="button"
                        onClick={() => {
                          if (onSelectFlavorPath) {
                            onSelectFlavorPath(note);
                          }
                        }}
                        className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition-all ${
                          isMatched
                            ? "bg-primary text-primary-content font-bold shadow-xs scale-105"
                            : "bg-base-200/70 hover:bg-base-300 text-base-content/80"
                        }`}
                        title={`${note.fullPath} (クリックしてホイールをジャンプ)`}
                      >
                        {note.nameJa || note.descriptor}
                      </button>
                    );
                  })}
                </div>

                {/* Footer Price & Details Trigger */}
                <div className="mt-2.5 flex items-center justify-between text-xs pt-1">
                  <div className="font-bold text-base-content">
                    {bean.priceCurrency === "USD" ? "$" : bean.priceCurrency}{" "}
                    {bean.priceValue > 0
                      ? bean.priceValue.toFixed(2)
                      : "要確認"}
                    <span className="text-[10px] text-base-content/60 font-normal ml-1">
                      / {bean.weightGrams}g
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectCoffee(bean)}
                    className="flex items-center gap-1 text-primary text-xs font-semibold hover:underline"
                  >
                    <span>詳細を見る</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
