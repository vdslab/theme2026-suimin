import FlavorBeanCard from "./FlavorBeanCard";
import { useEffect, useMemo, useRef, useState } from "react";
import { translateCountry } from "../lib/countryNames";
import { flavorPath, processName, roastName } from "../lib/flavorJapanese";
import { compareFlavorMatch } from "../lib/flavorData";

export default function FlavorBeanList({
  beans = [],
  color,
  onSelectFlavor,
  selectedBeanId,
  expandedBeanId,
  graphSelection,
  onToggleBean,
  onSelectBean,
  hoveredBeanId,
  onHoverBean,
  selectedFlavorPaths = [],
  onClose,
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("match_desc");
  const itemRefs = useRef({});
  const scrollRef = useRef(null);

  // フィルタリング
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return beans;
    return beans.filter((b) => {
      const country = translateCountry(b.origin_country).toLowerCase();
      const origCountry = (b.origin_country || "").toLowerCase();
      const region = (b.origin_region || "").toLowerCase();
      const title = (b.title || "").toLowerCase();
      const roaster = (b.source_roaster || "").toLowerCase();
      const process = processName(b.process_method).toLowerCase();
      const roast = roastName(b.roast_level).toLowerCase();
      return (
        country.includes(q) ||
        origCountry.includes(q) ||
        region.includes(q) ||
        title.includes(q) ||
        roaster.includes(q) ||
        process.includes(q) ||
        roast.includes(q) ||
        b.paths.some((p) => flavorPath(p).toLowerCase().includes(q))
      );
    });
  }, [beans, search]);

  // ソート
  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortBy) {
      case "match_desc":
        return list.sort(compareFlavorMatch);
      case "confidence_desc":
        return list.sort(
          (a, b) =>
            (b.confidence || 0) - (a.confidence || 0) ||
            a.id.localeCompare(b.id),
        );
      case "confidence_asc":
        return list.sort(
          (a, b) =>
            (a.confidence || 0) - (b.confidence || 0) ||
            a.id.localeCompare(b.id),
        );
      case "title_asc":
        return list.sort((a, b) =>
          (a.title || "").localeCompare(b.title || ""),
        );
      default:
        return list;
    }
  }, [filtered, sortBy]);

  // リスト内だけをスクロールし、末尾のカードも上端にそろえられる余白を確保する。
  useEffect(() => {
    if (graphSelection) setSearch("");
  }, [graphSelection]);
  useEffect(() => {
    const container = scrollRef.current;
    const card =
      sorted.some((bean) => bean.id === graphSelection?.id) &&
      itemRefs.current[graphSelection.id];
    if (!container || !card) return;
    const timer = setTimeout(() => {
      const top =
        container.scrollTop +
        card.getBoundingClientRect().top -
        container.getBoundingClientRect().top -
        container.clientTop;
      container.scrollTo({
        top: Math.max(0, top - 3),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }, 220);
    return () => clearTimeout(timer);
  }, [graphSelection, sorted]);

  return (
    <div className="flavor-bean-list-container">
      <div className="flavor-bean-list-header">
        <div className="flavor-bean-list-top-bar">
          <div className="flavor-bean-list-title-wrap">
            <div className="flavor-bean-list-heading-row">
              <h2 className="flavor-bean-list-title">表示中の豆一覧</h2>
              <span className="flavor-bean-list-count">
                {sorted.length} / {beans.length}件
              </span>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flavor-bean-list-close-btn"
              aria-label="リストを閉じて階層図に戻る"
              title="味の階層に戻る"
            >
              ✕ 階層図に戻る
            </button>
          )}
        </div>
        <p className="flavor-bean-list-subtitle">
          豆を選ぶと、グラフで位置と詳細を確認できます。
        </p>

        <div className="flavor-bean-list-controls">
          <div className="flavor-bean-search-box">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="豆名・産地・焙煎所で絞り込み…"
              aria-label="豆一覧の絞り込み"
              className="flavor-bean-search-input"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="flavor-bean-search-clear"
                aria-label="検索条件をクリア"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flavor-bean-sort-box">
            <label htmlFor="bean-sort-select">並び順:</label>
            <select
              id="bean-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flavor-bean-sort-select"
            >
              <option value="match_desc">選択した味との一致度（高い順）</option>
              <option value="confidence_desc">信頼度（高い順）</option>
              <option value="confidence_asc">信頼度（低い順）</option>
              <option value="title_asc">豆名（五十音/アルファベット順）</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flavor-bean-items-scroll" ref={scrollRef}>
        {sorted.length === 0 ? (
          <div className="flavor-bean-empty">
            <p>条件に一致する豆が見つかりませんでした。</p>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="flavor-bean-reset-btn"
              >
                絞り込みを解除
              </button>
            )}
          </div>
        ) : (
          <div className="flavor-bean-items">
            {sorted.map((bean) => (
              <FlavorBeanCard
                key={bean.id}
                bean={bean}
                cardRef={(el) => {
                  itemRefs.current[bean.id] = el;
                }}
                isSelected={selectedBeanId === bean.id}
                isExpanded={expandedBeanId === bean.id}
                isHovered={hoveredBeanId === bean.id}
                onToggle={() => {
                  onSelectBean?.(bean);
                  onToggleBean(bean.id);
                }}
                onHoverBean={onHoverBean}
                onSelectFlavor={onSelectFlavor}
                selectedFlavorPaths={selectedFlavorPaths}
                color={color}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
