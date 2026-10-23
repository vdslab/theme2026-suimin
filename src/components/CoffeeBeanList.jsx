import {
  ArrowRight,
  ArrowUpDown,
  Building2,
  ChevronRight,
  Compass,
  Droplet,
  ExternalLink,
  Flame,
  Globe2,
  MapPin,
  Mountain,
  Search,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

// ─── Exploration Guide shown while in step mode before outermost tier ─────────
function ExplorationGuide({ selectedFlavor }) {
  const step = selectedFlavor
    ? (selectedFlavor.depth ?? selectedFlavor.level ?? 1)
    : 0;

  // Step-specific content
  const steps = [
    {
      number: 1,
      label: "大カテゴリを選択",
      sublabel: "左のホイールから気になるフレーバー系統をクリック",
      icon: "🎯",
      done: step >= 1,
      active: step === 0,
    },
    {
      number: 2,
      label: "中カテゴリで絞り込む",
      sublabel: "さらに詳しいフレーバー特性を選択",
      icon: "🔍",
      done: step >= 2,
      active: step === 1,
    },
    {
      number: 3,
      label: "フレーバーを確定・豆を発見！",
      sublabel: "最外端タグを選ぶとコーヒー豆が表示されます",
      icon: "☕",
      done: false,
      active: step >= 2,
    },
  ];

  // Category-level tips
  const categoryTips = {
    Fruity: {
      emoji: "🍓",
      ja: "フルーティ",
      desc: "ベリー、シトラス、熱帯果実など果実系フレーバー。エチオピアやケニア産に多く見られます。",
      tags: ["Berry", "Citrus Fruit", "Dried Fruit", "Other Fruit"],
      tagsJa: ["ベリー系", "柑橘系", "ドライフルーツ", "その他フルーツ"],
    },
    Floral: {
      emoji: "🌸",
      ja: "フローラル",
      desc: "花のような香りが特徴。エチオピア・イエメン産の高品質豆に多く見られます。",
      tags: ["Black Tea", "Floral"],
      tagsJa: ["紅茶", "フラワー系"],
    },
    "Sweet (甘み)": {
      emoji: "🍯",
      ja: "スウィート",
      desc: "甘い風味。チョコレートやバニラのような柔らかな甘さ。ブラジル・コロンビア産に多い。",
      tags: ["Brown Sugar", "Vanilla", "Vanilla", "Overall Sweet"],
      tagsJa: ["ブラウンシュガー", "バニラ", "甘さ全般"],
    },
    "ナッツ／コア": {
      emoji: "🌰",
      ja: "ナッツ・コア",
      desc: "ナッツ、チョコレート、キャラメルなど安定した風味。幅広い産地で見られます。",
      tags: ["Nutty / Cocoa", "Spices", "Overall"],
      tagsJa: ["ナッツ/ココア", "スパイス", "全般的風味"],
    },
  };

  const selectedCat = selectedFlavor
    ? categoryTips[selectedFlavor.name] || categoryTips[selectedFlavor.nameJa]
    : null;

  return (
    <div className="flex flex-col h-full gap-4 animate-fade-up-in">
      {/* Header badge */}
      <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-gradient-to-r from-primary/10 to-amber-500/10 border border-primary/20">
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-amber-600 flex items-center justify-center text-white shadow-md">
            <Compass size={20} className="animate-float-y" />
          </div>
          <div className="absolute inset-0 rounded-xl bg-primary/30 animate-pulse-ring pointer-events-none" />
        </div>
        <div>
          <div className="font-extrabold text-sm text-base-content">
            フレーバー探索モード
          </div>
          <div className="text-xs text-base-content/60 mt-0.5">
            左のホイールをクリックして絞り込もう
          </div>
        </div>
      </div>

      {/* Step progress indicator */}
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-bold text-base-content/50 uppercase tracking-widest px-1">
          探索ステップ
        </div>
        {steps.map((s, i) => (
          <div
            key={s.number}
            className={`flex items-start gap-3 p-3 rounded-xl transition-all duration-300 ${
              s.active
                ? "bg-primary/10 border border-primary/30 shadow-sm"
                : s.done
                  ? "bg-success/8 border border-success/20 opacity-75"
                  : "bg-base-200/50 border border-transparent opacity-50"
            }`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {/* Step circle */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                s.active
                  ? "bg-primary text-primary-content shadow-md scale-110"
                  : s.done
                    ? "bg-success text-success-content"
                    : "bg-base-300 text-base-content/40"
              }`}
            >
              {s.done && !s.active ? "✓" : s.icon}
            </div>

            <div className="min-w-0 flex-1">
              <div
                className={`text-sm font-bold ${
                  s.active
                    ? "text-primary"
                    : s.done
                      ? "text-success"
                      : "text-base-content/40"
                }`}
              >
                {s.label}
              </div>
              <div className="text-xs text-base-content/55 mt-0.5 leading-relaxed">
                {s.sublabel}
              </div>
            </div>

            {s.active && (
              <ChevronRight
                size={16}
                className="text-primary shrink-0 mt-1 animate-pulse"
              />
            )}
          </div>
        ))}
      </div>

      {/* If a category is already selected, show tips for that category */}
      {selectedFlavor && (
        <div
          className="rounded-2xl overflow-hidden border border-base-300/60 shadow-sm animate-fade-up-in"
          style={{ animationDelay: "120ms" }}
        >
          {/* Category header */}
          <div
            className="p-3.5 flex items-center gap-2.5"
            style={{
              background: selectedFlavor.color
                ? `linear-gradient(135deg, ${selectedFlavor.color}e0, ${selectedFlavor.color}99)`
                : "linear-gradient(135deg, #6f4e37e0, #6f4e3799)",
            }}
          >
            <span className="text-2xl">{selectedCat?.emoji ?? "☕"}</span>
            <div>
              <div className="font-extrabold text-white text-sm">
                {selectedFlavor.nameJa || selectedFlavor.name}
              </div>
              <div className="text-white/75 text-xs">{selectedFlavor.name}</div>
            </div>
            <div className="ml-auto">
              <span className="bg-white/25 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                {selectedFlavor.beanCount ?? "–"} 銘柄
              </span>
            </div>
          </div>

          {/* Category description */}
          {selectedCat?.desc && (
            <div className="px-3.5 pt-3 pb-2 text-xs text-base-content/70 leading-relaxed bg-base-100">
              {selectedCat.desc}
            </div>
          )}

          {/* Sub-tags hint */}
          {selectedCat?.tagsJa && (
            <div className="px-3.5 pb-3.5 bg-base-100">
              <div className="text-[10px] font-bold text-base-content/45 mb-1.5 uppercase tracking-wide">
                この中から選べるフレーバー系統:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedCat.tagsJa.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-base-200 text-base-content/70 font-medium flex items-center gap-1"
                  >
                    <ArrowRight size={9} />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generic tip when nothing is selected */}
      {!selectedFlavor && (
        <div
          className="rounded-2xl p-4 bg-base-200/60 border border-base-300/50 animate-fade-up-in"
          style={{ animationDelay: "150ms" }}
        >
          <div className="text-xs font-bold text-base-content/60 mb-3 flex items-center gap-1.5">
            <Sparkles size={12} className="text-amber-500" />
            フレーバーカテゴリ一覧
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                emoji: "🍓",
                ja: "フルーティ",
                en: "Fruity",
                color: "#e54a4a",
                count: 73,
              },
              {
                emoji: "🌸",
                ja: "フローラル",
                en: "Floral",
                color: "#c97ba5",
                count: 13,
              },
              {
                emoji: "🍯",
                ja: "スウィート",
                en: "Sweet",
                color: "#d49a3a",
                count: 31,
              },
              {
                emoji: "🌰",
                ja: "ナッツ/コア",
                en: "Nutty/Cocoa",
                color: "#7a5c3e",
                count: 50,
              },
              {
                emoji: "🌶",
                ja: "スパイス",
                en: "Spices",
                color: "#b85c3a",
                count: 9,
              },
              {
                emoji: "🔥",
                ja: "ロースト",
                en: "Roasted",
                color: "#5a3d28",
                count: 4,
              },
            ].map((cat) => (
              <div
                key={cat.en}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-base-100 border border-base-200 shadow-xs"
              >
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ backgroundColor: `${cat.color}22` }}
                >
                  {cat.emoji}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-base-content truncate">
                    {cat.ja}
                  </div>
                  <div className="text-[10px] text-base-content/50">
                    {cat.count} 銘柄
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom hint */}
      <div className="mt-auto text-center text-[11px] text-base-content/40 flex items-center justify-center gap-1.5 py-2">
        <MapPin size={12} />
        <span>最外端のフレーバーを選択するとコーヒー豆が表示されます</span>
      </div>
    </div>
  );
}

// ─── Main CoffeeBeanList component ───────────────────────────────────────────
export default function CoffeeBeanList({
  beans,
  selectedFlavor,
  onClearFlavor,
  onSelectFlavorPath,
  onSelectCoffee,
  selectedCoffee,
  explorationMode = "step",
  activeView = "gravity",
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoast, setSelectedRoast] = useState("all");
  const [selectedProcess, setSelectedProcess] = useState("all");
  const [sortBy, setSortBy] = useState("default");

  // Determine if we're in step mode and NOT yet at outermost tier (only for wheel view)
  const selectedDepth = selectedFlavor
    ? (selectedFlavor.depth ?? selectedFlavor.level ?? 0)
    : 0;
  const isExplorationGuideVisible =
    activeView === "wheel" && explorationMode === "step" && selectedDepth < 2;

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
      {/* ── Exploration Guide (step mode, before outermost tier) ── */}
      {isExplorationGuideVisible ? (
        <ExplorationGuide
          selectedFlavor={selectedFlavor}
          explorationMode={explorationMode}
        />
      ) : (
        <>
          {/* Active Flavor Badge Banner */}
          {selectedFlavor && (
            <div
              className="mb-3 p-3 rounded-2xl flex items-center justify-between gap-3 text-white shadow-md transition-all animate-fade-in"
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
              sortedBeans.map((bean, beanIdx) => {
                const isSelected =
                  selectedCoffee && selectedCoffee.id === bean.id;

                return (
                  <div
                    key={bean.id}
                    className={`w-full group text-left p-3.5 rounded-2xl transition-all border animate-fade-up-in ${
                      isSelected
                        ? "bg-base-200 border-primary shadow-md ring-2 ring-primary/30"
                        : "bg-base-100 hover:bg-base-200/80 border-base-200 hover:border-base-300 shadow-xs hover:shadow-sm"
                    }`}
                    style={{
                      animationDelay: `${Math.min(beanIdx * 40, 400)}ms`,
                    }}
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
                            note.fullPath.startsWith(
                              `${selectedFlavor.path} >`,
                            ) ||
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
                        {bean.priceCurrency === "USD"
                          ? "$"
                          : bean.priceCurrency}{" "}
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
        </>
      )}
    </div>
  );
}
