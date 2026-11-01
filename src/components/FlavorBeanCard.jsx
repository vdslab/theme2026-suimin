import SellerDescription from "./SellerDescription";
import { translateSellerDescription } from "../lib/descriptionTranslation";
import { useId, useState } from "react";
import { translateCountry } from "../lib/countryNames";
import { flavorName, processName, roastName } from "../lib/flavorJapanese";
import { pathId } from "../lib/flavorData";

const present = (value) =>
  value != null &&
  String(value).trim() !== "" &&
  (!Array.isArray(value) || value.length > 0);
const numeric = (value) => present(value) && Number.isFinite(Number(value));
const display = (value) =>
  Array.isArray(value) ? value.filter(present).join("、") : value;
const MISSING = "データなし";
const valueOrMissing = (value) =>
  present(value) &&
  !/^(unknown|unspecified|null|none|n\/a|不明|データなし)$/i.test(
    String(value).trim(),
  )
    ? value
    : MISSING;

export default function FlavorBeanCard({
  bean,
  cardRef,
  isSelected,
  isExpanded,
  isHovered,
  onToggle,
  onHoverBean,
  onSelectFlavor,
  selectedFlavorPaths,
  color,
}) {
  const detailId = useId();
  const triggerId = useId();
  const confidenceTipId = useId();
  const [confidenceTipOpen, setConfidenceTipOpen] = useState(false);
  const [confidenceTipHovered, setConfidenceTipHovered] = useState(false);
  const showConfidenceTip = confidenceTipOpen || confidenceTipHovered;
  const toggleCard = () => {
    if (!isExpanded && present(bean.tasting_notes_raw)) {
      // Start within the click/keyboard gesture, before React opens the card.
      translateSellerDescription(bean.tasting_notes_raw).catch(() => {});
    }
    onToggle();
  };
  const paths = bean.paths || [];
  // Preserve the existing hierarchical prefix match for the tag highlight.
  const matches = (p) =>
    selectedFlavorPaths.some((path) => path.every((v, i) => p[i] === v));
  const matched = paths.filter(matches);
  const unmatched = paths.filter((p) => !matches(p));
  const compactPaths = [...matched, ...unmatched.slice(0, 3)];
  const remaining = paths.length - compactPaths.length;
  const min = bean.altitude_min_meters;
  const max = bean.altitude_max_meters;
  const altitude =
    numeric(min) && numeric(max)
      ? Number(min) === Number(max)
        ? `${Number(min).toLocaleString()} m`
        : `${Number(min).toLocaleString()}〜${Number(max).toLocaleString()} m`
      : numeric(min)
        ? `${Number(min).toLocaleString()} m以上`
        : numeric(max)
          ? `${Number(max).toLocaleString()} m以下`
          : null;
  const facts = [
    ["焙煎所", bean.source_roaster],
    ["産地の地域", bean.origin_region],
    ["品種", display(bean.varietals)],
    ["焙煎度", present(bean.roast_level) ? roastName(bean.roast_level) : null],
    [
      "内容量",
      numeric(bean.weight_grams)
        ? `${Number(bean.weight_grams).toLocaleString()} g`
        : null,
    ],
    ["標高", altitude],
  ];
  const price = numeric(bean.price_value)
    ? [
        bean.price_currency?.trim().toUpperCase(),
        Number(bean.price_value).toFixed(2),
      ]
        .filter(Boolean)
        .join(" ")
    : null;
  const summary = [
    [
      "産地",
      present(bean.origin_country)
        ? translateCountry(bean.origin_country)
        : null,
    ],
    [
      "精製",
      present(bean.process_method) ? processName(bean.process_method) : null,
    ],
    ["価格", price],
  ];
  const url = [bean.product_url, bean.source_url].find(
    (value) => typeof value === "string" && /^https?:\/\//i.test(value),
  );
  const confidence = numeric(bean.tasting_notes_confidence)
    ? (bean.confidence ?? bean.tasting_notes_confidence)
    : null;
  const tags = (items) =>
    items.map((p) => (
      <button
        key={pathId(p)}
        type="button"
        className={`flavor-bean-tag-chip ${matches(p) ? "is-active-flavor" : ""}`}
        style={{ borderColor: color?.(p) || "#94704d" }}
        onClick={(e) => {
          e.stopPropagation();
          onSelectFlavor?.(pathId(p));
        }}
        title="この味を中心に探索"
      >
        <i
          className="flavor-tag-dot"
          style={{ backgroundColor: color?.(p) || "#94704d" }}
        />
        {flavorName(p[p.length - 1])}
      </button>
    ));
  return (
    <article
      ref={cardRef}
      className={`flavor-bean-card ${isSelected ? "is-selected" : ""} ${isHovered ? "is-hovered" : ""} ${isExpanded ? "is-expanded" : ""}`}
      onClick={(e) => {
        if (!e.target.closest("button, a, [data-card-interactive]"))
          toggleCard();
      }}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          toggleCard();
        }
      }}
      onMouseEnter={() => onHoverBean?.(bean.id)}
      onMouseLeave={() => onHoverBean?.(null)}
    >
      <div className="flavor-bean-card-top">
        <h4 className="flavor-bean-card-title">
          <span className="flavor-bean-name-label">豆の名前</span>
          <button
            id={triggerId}
            type="button"
            className="flavor-bean-toggle"
            onClick={toggleCard}
            aria-expanded={isExpanded}
            aria-controls={detailId}
          >
            {valueOrMissing(bean.title)}
          </button>
        </h4>
        <span className="flavor-bean-badge">
          一致 {bean.matchCount}/{bean.selectedCount}
        </span>
        <span className="flavor-bean-chevron" aria-hidden="true">
          ⌄
        </span>
      </div>
      {summary.length > 0 && (
        <div className="flavor-bean-card-details">
          {summary.map(([label, value]) => (
            <div key={label} className="flavor-bean-detail-row">
              <span className="flavor-bean-detail-label">{label}</span>
              <span className="flavor-bean-detail-value">
                {valueOrMissing(value)}
              </span>
            </div>
          ))}
        </div>
      )}
      {paths.length > 0 && (
        <div className="flavor-bean-tag-chips flavor-bean-summary-tags">
          {tags(compactPaths)}
          {remaining > 0 && !isExpanded && (
            <span
              role="img"
              className="flavor-bean-tag-more"
              aria-label={`ほか${remaining}件の味タグ。詳細で確認できます`}
            >
              +{remaining}
            </span>
          )}
          {remaining > 0 && (
            <div
              className="flavor-bean-accordion flavor-bean-extra-tags"
              data-open={isExpanded}
              inert={!isExpanded}
              aria-hidden={!isExpanded}
            >
              <div className="flavor-bean-accordion-clip">
                <div className="flavor-bean-tag-chips">
                  {tags(unmatched.slice(3))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <section
        className="flavor-bean-accordion"
        data-open={isExpanded}
        id={detailId}
        aria-labelledby={triggerId}
        inert={!isExpanded}
        aria-hidden={!isExpanded}
      >
        <div className="flavor-bean-accordion-clip">
          <div className="flavor-bean-expanded-content">
            {facts.length > 0 && (
              <dl className="flavor-bean-facts">
                {facts.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{valueOrMissing(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
            <SellerDescription
              text={bean.tasting_notes_raw}
              isExpanded={isExpanded}
            />
            <div className="flavor-bean-confidence" data-card-interactive>
              <span className="flavor-bean-confidence-label">
                味タグ抽出の信頼度
              </span>
              <span className="flavor-bean-confidence-value">
                {confidence != null
                  ? `${Math.round(Number(confidence) * 100)}%`
                  : MISSING}
              </span>
              <span
                className="flavor-bean-confidence-help"
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setConfidenceTipHovered(true);
                }}
                onPointerLeave={() => setConfidenceTipHovered(false)}
              >
                <button
                  type="button"
                  className="flavor-bean-info-button"
                  aria-label="味タグ抽出の信頼度について"
                  aria-expanded={showConfidenceTip}
                  aria-controls={confidenceTipId}
                  aria-describedby={
                    showConfidenceTip ? confidenceTipId : undefined
                  }
                  onClick={() => setConfidenceTipOpen(!confidenceTipOpen)}
                  onBlur={() => setConfidenceTipOpen(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setConfidenceTipOpen(false);
                      setConfidenceTipHovered(false);
                    }
                  }}
                >
                  ⓘ
                </button>
              </span>
              <span
                id={confidenceTipId}
                role="tooltip"
                className="flavor-bean-confidence-tip"
                hidden={!showConfidenceTip}
              >
                味タグの抽出に関する指標です。豆の品質評価ではありません。
              </span>
            </div>
            <div>
              <h5>商品ページ</h5>
              {url ? (
                <a
                  className="flavor-bean-external-link"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  商品ページを開く ↗
                </a>
              ) : (
                <span>{MISSING}</span>
              )}
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
