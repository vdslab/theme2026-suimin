import { useState } from "react";

const PAGES = [
  {
    title: "Coffee Taste Map へようこそ",
    text: "世界中のコーヒー豆の味覚データから、あなたにぴったりのコーヒーを探せる直感的なマップです。\n国ごとの縞模様は、その産地で提供されているコーヒーの「味の傾向（クラスタ）」とその割合を表しています。",
    image: "/images/image_map_concept.png",
  },
  {
    title: "産地を探検しよう",
    text: "地図上の国をクリックすると、その国で生産されている精製方法のリストが表示されます。\nさらに精製方法を選ぶと、右側のパネルに「酸味」や「コク」などの味のバランスや、所属する味覚クラスタの詳細が表示されます。",
    image: "/images/image_detail_panel.png",
  },
  {
    title: "次の一杯を見つける",
    text: "「飲んだ」ボタンから、過去に飲んだコーヒーの「好み度」を5段階で記録してみましょう。\n記録後に左上の「おすすめを計算する」ボタンを押すと、あなたの好みに最も近いコーヒーをAIが分析してハイライトします。",
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
          <div className="flex-1 min-h-0 w-full bg-base-200 flex items-center justify-center p-6 lg:p-12 relative">
            {/* biome-ignore lint/a11y/useAltText: Startup guide decorative images */}
            <img
              src={page.image}
              key={page.image}
              className="h-full w-full object-contain rounded-xl shadow-lg animate-in fade-in zoom-in duration-500"
            />
          </div>

          <div className="shrink-0 h-[35%] min-h-[200px] p-8 lg:px-16 flex flex-col items-center justify-center text-center bg-base-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold mb-4 text-primary">
              {page.title}
            </h2>
            <p className="text-base-content/80 leading-relaxed whitespace-pre-wrap max-w-2xl">
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
                さっそく始める
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
