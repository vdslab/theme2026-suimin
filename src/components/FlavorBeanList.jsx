import { useEffect, useMemo, useRef, useState } from "react";
import { translateCountry } from "../lib/countryNames";
import {
  flavorName,
  flavorPath,
  formatConfidence,
  formatPrice,
  processName,
  roastName,
} from "../lib/flavorJapanese";
import { compareFlavorMatch, pathId } from "../lib/flavorData";

export default function FlavorBeanList({
  beans = [],
  color,
  onSelectFlavor,
  selectedBeanId,
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
    const container = scrollRef.current;
    if (!container) return;
    const card = selectedBeanId && itemRefs.current[selectedBeanId];
    if (!card) {
      container.style.paddingBottom = "0px";
      return;
    }
    const top =
      container.scrollTop +
      card.getBoundingClientRect().top -
      container.getBoundingClientRect().top -
      container.clientTop;
    const contentHeight =
      container.scrollHeight - (parseFloat(container.style.paddingBottom) || 0);
    container.style.paddingBottom = `${Math.max(0, top + container.clientHeight - contentHeight)}px`;
    container.scrollTo({ top, behavior: "smooth" });
  }, [selectedBeanId, sorted]);

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
          グラフに表示中のすべての豆です。クリックで詳細確認・ネットワーク図と連動します。
          一致度は選択した味との一致数で判定し、同じ場合は味タグの抽出信頼度順です。
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
            {sorted.map((bean) => {
              const isSelected = selectedBeanId === bean.id;
              const isHovered = hoveredBeanId === bean.id;
              const country = translateCountry(bean.origin_country);
              const region = bean.origin_region;
              const originDisplay =
                [country, region].filter(Boolean).join(" · ") || "産地情報なし";
              const priceDisplay = formatPrice(
                bean.price_value,
                bean.price_currency,
              );
              const confidenceDisplay = formatConfidence(bean.confidence);
              const sourceUrl =
                bean.source_url && /^https?:\/\//i.test(bean.source_url)
                  ? bean.source_url
                  : bean.product_url && /^https?:\/\//i.test(bean.product_url)
                    ? bean.product_url
                    : null;

              // 信頼度スコアに応じたバッジのクラス
              const confVal = Number(bean.confidence) || 0;
              let confLevelClass = "conf-low";
              if (confVal >= 0.8) confLevelClass = "conf-high";
              else if (confVal >= 0.5) confLevelClass = "conf-mid";

              return (
                <div
                  key={bean.id}
                  ref={(el) => (itemRefs.current[bean.id] = el)}
                  className={`flavor-bean-card ${
                    isSelected ? "is-selected" : ""
                  } ${isHovered ? "is-hovered" : ""}`}
                  onClick={() => onSelectBean?.(bean)}
                  onMouseEnter={() => onHoverBean?.(bean.id)}
                  onMouseLeave={() => onHoverBean?.(null)}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectBean?.(bean);
                    }
                  }}
                >
                  <div className="flavor-bean-card-top">
                    <span className="flavor-bean-name-label">豆の名前</span>
                    <div className="flavor-bean-meta-badges">
                      <span
                        className="flavor-bean-badge"
                        title="選択した味のうち、この豆が一致する味の数"
                      >
                        味の一致: {bean.matchCount} / {bean.selectedCount}
                      </span>
                      <span
                        className={`flavor-bean-badge confidence-badge ${confLevelClass}`}
                        title={`味タグの抽出信頼度: ${bean.confidence}`}
                      >
                        信頼度: {confidenceDisplay}
                      </span>
                    </div>
                    <h4 className="flavor-bean-card-title">{bean.title}</h4>
                  </div>

                  <div className="flavor-bean-card-details">
                    <div className="flavor-bean-detail-row">
                      <span className="flavor-bean-detail-label">産地</span>
                      <span className="flavor-bean-detail-value">
                        {originDisplay}
                      </span>
                    </div>
                    <div className="flavor-bean-detail-row">
                      <span className="flavor-bean-detail-label">特徴</span>
                      <span className="flavor-bean-detail-value">
                        {processName(bean.process_method)} ·{" "}
                        {roastName(bean.roast_level)}
                      </span>
                    </div>
                    <div className="flavor-bean-detail-row">
                      <span className="flavor-bean-detail-label">価格</span>
                      <span className="flavor-bean-detail-value">
                        {priceDisplay}
                      </span>
                    </div>
                  </div>

                  {bean.paths && bean.paths.length > 0 && (
                    <div className="flavor-bean-card-tags">
                      <span className="flavor-bean-tags-label">味タグ:</span>
                      <div className="flavor-bean-tag-chips">
                        {bean.paths.map((p) => {
                          const id = pathId(p);
                          const isTargetFlavor = selectedFlavorPaths.some(
                            (path) => path.every((v, i) => p[i] === v),
                          );
                          return (
                            <button
                              key={id}
                              type="button"
                              className={`flavor-bean-tag-chip ${
                                isTargetFlavor ? "is-active-flavor" : ""
                              }`}
                              style={{
                                borderColor: color?.(p) || "#94704d",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectFlavor?.(id);
                              }}
                              title="この味を中心に探索"
                            >
                              <i
                                className="flavor-tag-dot"
                                style={{
                                  backgroundColor: color?.(p) || "#94704d",
                                }}
                              />
                              {flavorName(p[p.length - 1])}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flavor-bean-card-footer">
                    <button
                      type="button"
                      className="flavor-bean-select-action"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectBean?.(bean);
                      }}
                    >
                      {isSelected ? "選択中 ✓" : "ネットワーク図で確認"}
                    </button>
                    {sourceUrl && (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flavor-bean-external-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        商品ページ ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
