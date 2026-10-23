import {
  Coffee,
  Compass,
  HelpCircle,
  Languages,
  Layers,
  Sparkles,
} from "lucide-react";

export default function Header({
  activeView = "gravity",
  setActiveView,
  languageMode,
  setLanguageMode,
  explorationMode = "step",
  setExplorationMode,
  onOpenGuide,
  totalBeansCount = 100,
}) {
  return (
    <header className="w-full bg-base-100/80 border-b border-base-300/70 backdrop-blur-md sticky top-0 z-40 px-3 sm:px-6 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Title & Branding */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-amber-700 via-primary to-amber-500 flex items-center justify-center text-white shadow-md shadow-primary/20 shrink-0">
            <Coffee size={20} className="animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm sm:text-base md:text-lg text-base-content tracking-tight">
                Coffee Flavor Explorer
              </h1>
              <span className="hidden sm:inline-flex badge badge-xs badge-primary font-semibold">
                SCAA / WCR
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-base-content/60 font-medium hidden md:block">
              {activeView === "gravity"
                ? "多極引力モデル：複数タグ（マルチラベル）のブレンド度合いをフォースネットワークで表現"
                : "WCR Sensory Lexicon の味覚階層から好みのスペシャルティコーヒー豆を発見"}
            </p>
          </div>
        </div>

        {/* Center: View Switcher Tabs */}
        {setActiveView && (
          <div className="bg-base-200/90 p-1 rounded-2xl border border-base-300/60 flex items-center gap-1 text-xs font-bold shadow-xs">
            <button
              type="button"
              onClick={() => setActiveView("gravity")}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeView === "gravity"
                  ? "bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-sm"
                  : "text-base-content/70 hover:text-base-content hover:bg-base-300/40"
              }`}
            >
              <span className="text-sm">🧲</span>
              <span>引力モデル</span>
              <span className="hidden lg:inline text-[10px] opacity-80">
                (多極フォース)
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView("wheel")}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeView === "wheel"
                  ? "bg-primary text-primary-content shadow-sm"
                  : "text-base-content/70 hover:text-base-content hover:bg-base-300/40"
              }`}
            >
              <span className="text-sm">🎡</span>
              <span>ホイール</span>
              <span className="hidden lg:inline text-[10px] opacity-80">
                (サンバースト)
              </span>
            </button>
          </div>
        )}

        {/* Right Actions & Utilities */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Exploration Mode Toggle Switch (Only for Wheel view) */}
          {activeView === "wheel" && (
            <div className="bg-base-200/90 p-1 rounded-full border border-base-300/60 flex items-center gap-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setExplorationMode("step")}
                className={`px-2.5 sm:px-3 py-1 rounded-full transition-all flex items-center gap-1.5 ${
                  explorationMode === "step"
                    ? "bg-primary text-primary-content shadow-xs"
                    : "text-base-content/70 hover:text-base-content"
                }`}
                title="1階層ずつ選択・探索するモード"
              >
                <Compass size={13} />
                <span className="text-[11px] sm:text-xs">探索</span>
              </button>
              <button
                type="button"
                onClick={() => setExplorationMode("all")}
                className={`px-2.5 sm:px-3 py-1 rounded-full transition-all flex items-center gap-1.5 ${
                  explorationMode === "all"
                    ? "bg-primary text-primary-content shadow-xs"
                    : "text-base-content/70 hover:text-base-content"
                }`}
                title="すべての階層を常時見渡す全体俯瞰モード"
              >
                <Layers size={13} />
                <span className="text-[11px] sm:text-xs">全体</span>
              </button>
            </div>
          )}

          {/* Dataset Count Badge (Hidden on mobile) */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-base-200/80 text-xs text-base-content/80 font-medium border border-base-300/40">
            <Sparkles size={13} className="text-amber-600" />
            <span>{totalBeansCount} 銘柄</span>
          </div>

          {/* Language Toggle Dropdown */}
          <div className="dropdown dropdown-end">
            <button
              type="button"
              className="btn btn-sm btn-ghost gap-1 rounded-full border border-base-300/60 bg-base-200/50 hover:bg-base-200 px-2 sm:px-3"
            >
              <Languages size={14} className="text-primary" />
              <span className="text-xs font-semibold hidden sm:inline">
                {languageMode === "both"
                  ? "日英併記"
                  : languageMode === "ja"
                    ? "日本語"
                    : "English"}
              </span>
            </button>
            <ul className="dropdown-content z-50 menu p-1.5 shadow-xl bg-base-100 rounded-2xl w-36 border border-base-200 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => setLanguageMode("both")}
                  className={languageMode === "both" ? "active font-bold" : ""}
                >
                  日英併記 (Both)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setLanguageMode("ja")}
                  className={languageMode === "ja" ? "active font-bold" : ""}
                >
                  日本語のみ
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setLanguageMode("en")}
                  className={languageMode === "en" ? "active font-bold" : ""}
                >
                  English only
                </button>
              </li>
            </ul>
          </div>

          {/* Guide Button */}
          <button
            type="button"
            onClick={onOpenGuide}
            className="btn btn-sm btn-circle btn-ghost text-base-content/70 hover:text-primary"
            title="使い方ガイドを見る"
            aria-label="使い方ガイド"
          >
            <HelpCircle size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
