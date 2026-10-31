import { useEffect, useId, useRef, useState } from "react";
import { translateSellerDescription } from "../lib/descriptionTranslation";

export default function SellerDescription({ text, isExpanded }) {
  const hasText = typeof text === "string" && text.trim() !== "";
  const descriptionId = useId();
  const descriptionRef = useRef(null);
  const requestRef = useRef(0);
  const [translation, setTranslation] = useState(null);
  const [status, setStatus] = useState("idle");
  const [showOriginal, setShowOriginal] = useState(false);
  const [readMore, setReadMore] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const translated = translation?.source === text ? translation.text : null;
  const shownText = hasText
    ? showOriginal
      ? text
      : translated || text
    : "データなし";

  useEffect(() => {
    if (!isExpanded) {
      setReadMore(false);
      setShowOriginal(false);
    }
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded || !hasText) return;
    let active = true;
    setStatus("loading");
    translateSellerDescription(text).then(
      (result) => {
        if (!active) return;
        setTranslation({ source: text, text: result });
        setStatus("ready");
      },
      (error) => {
        if (active)
          setStatus(
            error.message === "TRANSLATION_UNSUPPORTED"
              ? "unsupported"
              : "retry",
          );
      },
    );
    return () => {
      active = false;
      requestRef.current += 1;
    };
  }, [isExpanded, hasText, text]);

  useEffect(() => {
    const element = descriptionRef.current;
    if (!element || !isExpanded || readMore || !shownText) return;
    const measure = () =>
      setOverflows(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isExpanded, readMore, shownText]);

  const translate = () => {
    const request = ++requestRef.current;
    setStatus("loading");
    // Called directly by the button to retain browser user activation.
    translateSellerDescription(text).then(
      (result) => {
        if (request !== requestRef.current) return;
        setTranslation({ source: text, text: result });
        setShowOriginal(false);
        setReadMore(false);
        setStatus("ready");
      },
      (error) => {
        if (request === requestRef.current)
          setStatus(
            error.message === "TRANSLATION_UNSUPPORTED"
              ? "unsupported"
              : "retry",
          );
      },
    );
  };

  return (
    <div data-card-interactive>
      <h5>
        販売元による説明
        {translated && translated !== text && !showOriginal
          ? "（日本語訳）"
          : ""}
      </h5>
      <p
        id={descriptionId}
        ref={descriptionRef}
        className={`flavor-bean-description ${readMore ? "" : "is-clamped"}`}
        lang={translated && !showOriginal ? "ja" : undefined}
      >
        {shownText}
      </p>
      <div className="flavor-bean-description-actions">
        {hasText && (readMore || overflows) && (
          <button
            type="button"
            className="flavor-bean-read-more"
            aria-expanded={readMore}
            aria-controls={descriptionId}
            onClick={() => setReadMore((value) => !value)}
          >
            {readMore ? "閉じる" : "続きを読む"}
          </button>
        )}
        {hasText && translated && translated !== text && (
          <button
            type="button"
            className="flavor-bean-read-more"
            onClick={() => {
              setShowOriginal((value) => !value);
              setReadMore(false);
            }}
          >
            {showOriginal ? "日本語訳を表示" : "原文を表示"}
          </button>
        )}
        {hasText && status === "retry" && (
          <button
            type="button"
            className="flavor-bean-read-more"
            onClick={translate}
          >
            日本語に翻訳
          </button>
        )}
      </div>
      {hasText && (
        <p className="flavor-bean-translation-status" role="status">
          {status === "loading"
            ? "日本語に翻訳中… 初回は言語データのダウンロードに時間がかかる場合があります。"
            : status === "unsupported"
              ? "このブラウザは内蔵翻訳に対応していないため、原文を表示しています。対応するデスクトップ版Chromeでお試しください。"
              : status === "retry"
                ? "翻訳を開始できませんでした。「日本語に翻訳」で再試行できます。言語の対応状況やダウンロード設定もご確認ください。"
                : ""}
        </p>
      )}
    </div>
  );
}
