import {
  Building2,
  Droplet,
  ExternalLink,
  Flame,
  Globe2,
  Mountain,
  Sparkles,
  TreeDeciduous,
  X,
} from "lucide-react";

export default function CoffeeDetailModal({
  coffee,
  onClose,
  onSelectFlavorPath,
}) {
  if (!coffee) return null;

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
        className="relative w-full max-w-xl max-h-[90vh] bg-base-100 rounded-3xl shadow-2xl border border-base-300 flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="document"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-base-200 flex items-start justify-between gap-4 bg-base-200/40">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-1">
              <Building2 size={14} />
              <span>{coffee.roaster}</span>
              {coffee.sourcePlatform && (
                <span className="badge badge-xs badge-neutral opacity-70">
                  {coffee.sourcePlatform}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-base-content leading-snug">
              {coffee.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-base-content/70 mt-1 font-medium">
              <Globe2 size={13} className="text-secondary" />
              <span>{coffee.country}</span>
              {coffee.region && <span>/ {coffee.region}</span>}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-circle btn-sm btn-ghost text-base-content/60 hover:text-base-content shrink-0"
            aria-label="閉じる"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Price & Specs Quick Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-3 rounded-2xl bg-base-200/60 border border-base-300/40 text-center">
              <div className="text-[11px] text-base-content/60 font-medium">
                価格・内容量
              </div>
              <div className="font-bold text-sm sm:text-base text-base-content mt-0.5">
                {coffee.priceCurrency === "USD" ? "$" : coffee.priceCurrency}{" "}
                {coffee.priceValue > 0
                  ? coffee.priceValue.toFixed(2)
                  : "要確認"}
              </div>
              <div className="text-[10px] text-base-content/50">
                {coffee.weightGrams}g
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 text-center">
              <div className="text-[11px] text-amber-800 dark:text-amber-300 font-medium flex items-center justify-center gap-1">
                <Flame size={12} />
                焙煎度
              </div>
              <div className="font-bold text-sm text-amber-900 dark:text-amber-200 mt-0.5">
                {coffee.roastLevel}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200/60 text-center">
              <div className="text-[11px] text-blue-800 dark:text-blue-300 font-medium flex items-center justify-center gap-1">
                <Droplet size={12} />
                精製方法
              </div>
              <div className="font-bold text-sm text-blue-900 dark:text-blue-200 mt-0.5">
                {coffee.process}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 text-center">
              <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium flex items-center justify-center gap-1">
                <Mountain size={12} />
                栽培標高
              </div>
              <div className="font-bold text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 mt-0.5 truncate">
                {coffee.altitude}
              </div>
            </div>
          </div>

          {/* Tasting Notes Section */}
          <div className="p-4 rounded-2xl bg-base-200/40 border border-base-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sm text-base-content flex items-center gap-1.5">
                <Sparkles size={16} className="text-warning" />
                <span>SCAA フレーバーノート</span>
              </div>
              <span className="text-xs text-base-content/60 font-medium">
                確信度: {Math.round(coffee.confidence * 100)}%
              </span>
            </div>

            <div className="space-y-2">
              {coffee.tastingNotes.map((note) => (
                <button
                  type="button"
                  key={note.fullPath}
                  onClick={() => {
                    if (onSelectFlavorPath) {
                      onSelectFlavorPath(note);
                      onClose();
                    }
                  }}
                  className="w-full text-left flex items-center justify-between p-2.5 rounded-xl bg-base-100 hover:bg-base-300/60 transition-all cursor-pointer border border-base-200 group"
                  title="クリックしてこのフレーバーをホイールで絞り込む"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-base-content group-hover:text-primary">
                        {note.nameJa || note.descriptor}
                        <span className="text-xs font-normal text-base-content/60 ml-1.5">
                          ({note.descriptor})
                        </span>
                      </div>
                      <div className="text-[10px] text-base-content/50">
                        {note.fullPath}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] text-primary font-semibold group-hover:underline">
                    ホイールで探索 &rarr;
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Varietals & Farm Info */}
          <div className="p-4 rounded-2xl bg-base-200/40 border border-base-200 space-y-2 text-xs">
            <div className="font-bold text-sm text-base-content flex items-center gap-1.5">
              <TreeDeciduous size={15} className="text-success" />
              <span>品種・生産情報</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-base-content/80 pt-1">
              <div>
                <span className="text-base-content/50">品種 (Varietal):</span>{" "}
                <span className="font-semibold">
                  {coffee.varietals || "未記載 / 不明"}
                </span>
              </div>
              <div>
                <span className="text-base-content/50">品質フラグ:</span>{" "}
                <span className="font-semibold uppercase">
                  {coffee.qualityFlag}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-base-200 bg-base-200/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-ghost rounded-full"
          >
            閉じる
          </button>

          {coffee.sourceUrl ? (
            <a
              href={coffee.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-primary rounded-full gap-1.5 shadow-sm"
            >
              <span>ロースター公式ページへ</span>
              <ExternalLink size={14} />
            </a>
          ) : (
            <span className="text-xs text-base-content/50">
              公式URL情報なし
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
