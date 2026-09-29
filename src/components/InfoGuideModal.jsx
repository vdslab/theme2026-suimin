import { Compass, Filter, RotateCcw, X, ZoomIn } from "lucide-react";

export default function InfoGuideModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      tabIndex={-1}
    >
      <div
        className="relative w-full max-w-lg bg-base-100 rounded-3xl shadow-2xl border border-base-300 flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="p-5 border-b border-base-200 flex items-center justify-between bg-base-200/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary text-primary-content flex items-center justify-center">
              <Compass size={18} />
            </div>
            <h2 className="font-extrabold text-base sm:text-lg text-base-content">
              フレーバーホイールの使い方
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-circle btn-sm btn-ghost"
            aria-label="閉じる"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs sm:text-sm text-base-content/85 overflow-y-auto max-h-[70vh]">
          <div className="p-3.5 rounded-2xl bg-base-200/60 border border-base-300/40 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0 font-bold">
              1
            </div>
            <div>
              <div className="font-bold text-base-content text-sm flex items-center gap-1.5">
                <ZoomIn size={14} className="text-primary" />
                スライスをクリックしてドリルダウン
              </div>
              <p className="mt-1 text-xs text-base-content/70 leading-relaxed">
                中央から外側へ「大カテゴリ（Fruity）→ 中カテゴリ（Berry）→
                小分類（Blackberry）」へと直感的に深掘り（ズームイン）できます。
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-base-200/60 border border-base-300/40 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-bold">
              2
            </div>
            <div>
              <div className="font-bold text-base-content text-sm flex items-center gap-1.5">
                <RotateCcw size={14} className="text-secondary" />
                中央円またはパンくずをクリックして戻る
              </div>
              <p className="mt-1 text-xs text-base-content/70 leading-relaxed">
                ホイールの中央円、または上部のパンくずリスト（階層ナビ）をクリックすると、いつでも上位の階層や全体に戻ることができます。
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-base-200/60 border border-base-300/40 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 font-bold">
              3
            </div>
            <div>
              <div className="font-bold text-base-content text-sm flex items-center gap-1.5">
                <Filter size={14} className="text-success" />
                右側パネルで該当する豆をチェック
              </div>
              <p className="mt-1 text-xs text-base-content/70 leading-relaxed">
                選択したフレーバーを持つスペシャルティコーヒーがリアルタイムに抽出されます。焙煎度・精製法フィルターやキーワード検索も併用可能です。
              </p>
            </div>
          </div>

          <div className="text-[11px] text-base-content/60 bg-primary/5 p-3 rounded-xl border border-primary/20">
            <strong>💡 WCR Sensory Lexicon (SCAA Flavor Wheel) とは？</strong>
            <br />
            World Coffee
            ResearchとSCAA（スペシャルティコーヒー協会）が科学的に定めた世界標準のコーヒー風味語彙体系です。
          </div>
        </div>

        <div className="p-4 border-t border-base-200 bg-base-200/40 text-right">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-primary rounded-full px-5"
          >
            探索をはじめる
          </button>
        </div>
      </div>
    </div>
  );
}
