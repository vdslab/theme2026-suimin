import { useEffect, useId, useRef, useState } from "react";
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
  const [readMore, setReadMore] = useState(false);
  const descriptionRef = useRef(null);
  const [descriptionOverflows, setDescriptionOverflows] = useState(false);
  useEffect(() => {
    const element = descriptionRef.current;
    if (!element || readMore || !bean.tasting_notes_raw) return;
    const observer = new ResizeObserver(() => {
      setDescriptionOverflows(element.scrollHeight > element.clientHeight + 1);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [readMore, bean.tasting_notes_raw]);
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
  ].filter(([, value]) => present(value));
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
  ].filter(([, value]) => present(value));
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
        if (!e.target.closest("button, a")) onToggle();
      }}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          onToggle();
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
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls={detailId}
          >
            {bean.title}
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
              <span className="flavor-bean-detail-value">{value}</span>
            </div>
          ))}
        </div>
      )}
      {paths.length > 0 && (
        <div className="flavor-bean-tag-chips">
          {tags(compactPaths)}
          {remaining > 0 && (
            <span
              role="img"
              className="flavor-bean-tag-more"
              aria-label={`ほか${remaining}件の味タグ。詳細で確認できます`}
            >
              +{remaining}
            </span>
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
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {paths.length > 0 && (
              <div>
                <h5>すべての味タグ</h5>
                <div className="flavor-bean-tag-chips">{tags(paths)}</div>
              </div>
            )}
            {present(bean.tasting_notes_raw) && (
              <div>
                <h5>販売元の味の説明</h5>
                <p
                  ref={descriptionRef}
                  className={`flavor-bean-description ${readMore ? "" : "is-clamped"}`}
                >
                  {bean.tasting_notes_raw}
                </p>
                {(readMore || descriptionOverflows) && (
                  <button
                    type="button"
                    className="flavor-bean-read-more"
                    aria-expanded={readMore}
                    onClick={() => setReadMore(!readMore)}
                  >
                    {readMore ? "折りたたむ" : "続きを読む"}
                  </button>
                )}
              </div>
            )}
            {confidence != null && (
              <p className="flavor-bean-confidence">
                味タグ抽出の信頼度：{Math.round(Number(confidence) * 100)}%
                <small>
                  味タグの抽出に関する指標です。豆の品質評価ではありません。
                </small>
              </p>
            )}
            {url && (
              <a
                className="flavor-bean-external-link"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                商品ページを開く ↗
              </a>
            )}
          </div>
        </div>
      </section>
    </article>
  );
}
