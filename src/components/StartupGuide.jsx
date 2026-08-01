import { useEffect, useState } from "react";

const PAGES = [
  {
    title: "地図の見かた",
    text: "世界のコーヒー豆の味覚データを、産地ごとに地図へ並べたサイトです。\n点が産地（国と地域）、点の色が味わいのタイプを表します。\n色が同じ産地は、味の傾向が似ています。\n横に伸びるオレンジの帯は、産地が集中している\nコーヒーベルト（南北の回帰線にはさまれた範囲）です。",
    image: "/images/image_map_concept.png",
  },
  {
    title: "産地の詳細を見る",
    text: "点をクリックすると、その産地の詳細が右側に開きます。\n酸味・コクなど6項目が全体の平均からどれだけ離れているか\n主な品種、味わいのタイプの内訳が並びます。\n「味が近い豆」に出てくる3件は、地図の上でも選んだ点から線でつながります。",
    image: "/images/image_detail_panel.png",
  },
  {
    title: "飲んだ豆から探す",
    text: "詳細パネルで好み度を5段階で選び、「飲んだ！」を押すと左のリストに残ります。\nいくつか記録したら「おすすめを計算する」を押してください。\n記録した好みに近い産地を1件選んで、地図の上で黄色く光らせます。",
    image: "/images/image_rating_recommend.png",
  },
];

const ChevronLeftIcon = () => (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export default function StartupGuide({ isOpen, onClose }) {
  const [currentPage, setCurrentPage] = useState(0);

  // 再表示のたびに最初のページから見せる（前回の閲覧位置を引き継がない）
  useEffect(() => {
    if (isOpen) setCurrentPage(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentPage < PAGES.length - 1) {
      setCurrentPage((p) => p + 1);
    }
  };

  const handlePrev = () => {
    if (currentPage > 0) {
      setCurrentPage((p) => p - 1);
    }
  };

  const page = PAGES[currentPage];
  const isLastPage = currentPage === PAGES.length - 1;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl w-11/12 h-[85vh] flex flex-col p-0 overflow-hidden relative bg-base-100 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4 z-20 bg-base-200/50 hover:bg-base-300"
        >
          ✕
        </button>

        <div className="flex-1 flex flex-col relative bg-base-200/30 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 w-full bg-base-200 flex items-center justify-center p-3 sm:p-6 lg:p-12 relative">
            {/* biome-ignore lint/a11y/useAltText: Startup guide decorative images */}
            <img
              src={page.image}
              key={page.image}
              className="h-full w-full object-contain rounded-xl shadow-lg animate-in fade-in zoom-in duration-500"
            />
          </div>

          <div className="shrink-0 h-[35%] min-h-[160px] sm:min-h-[200px] p-5 sm:p-8 lg:px-16 flex flex-col items-center justify-center text-center bg-base-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-lg sm:text-2xl font-bold mb-2 sm:mb-4 text-primary">
              {page.title}
            </h2>
            <p className="text-sm sm:text-base text-base-content/80 leading-relaxed whitespace-pre-wrap max-w-2xl">
              {page.text}
            </p>
          </div>

          {/* Navigation Arrows (Absolute inside content area so they float over edges) */}
          <div className="absolute inset-y-0 left-0 flex items-center px-4">
            <button
              type="button"
              className={`btn btn-circle btn-neutral shadow-lg ${currentPage === 0 ? "invisible" : ""}`}
              onClick={handlePrev}
            >
              <ChevronLeftIcon />
            </button>
          </div>
          <div className="absolute inset-y-0 right-0 flex items-center px-4">
            <button
              type="button"
              className={`btn btn-circle btn-neutral shadow-lg ${isLastPage ? "invisible" : ""}`}
              onClick={handleNext}
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>

        <div className="bg-base-100 p-4 border-t border-base-200 flex items-center justify-between z-10 shrink-0">
          <div className="w-24">{/* Empty space for flex balance */}</div>

          <div className="flex gap-2">
            {PAGES.map((_, idx) => (
              <button
                type="button"
                // biome-ignore lint/suspicious/noArrayIndexKey: Static array
                key={idx}
                onClick={() => setCurrentPage(idx)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  idx === currentPage
                    ? "bg-primary"
                    : "bg-base-300 hover:bg-base-content/30"
                }`}
                aria-label={`Go to page ${idx + 1}`}
              />
            ))}
          </div>

          <div className="w-24 flex justify-end">
            {isLastPage && (
              <button
                type="button"
                className="btn btn-primary animate-in fade-in duration-300"
                onClick={onClose}
              >
                はじめる
              </button>
            )}
          </div>
        </div>
      </div>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: Backdrop click to close */}
      <div
        className="modal-backdrop bg-base-300/80"
        onClick={onClose}
        onKeyDown={onClose}
        role="presentation"
      >
        <button type="button" className="cursor-default">
          close
        </button>
      </div>
    </div>
  );
}
