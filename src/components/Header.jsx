import { Coffee, HelpCircle, Languages, Sparkles } from "lucide-react";

export default function Header({
  languageMode,
  setLanguageMode,
  onOpenGuide,
  totalBeansCount = 100,
}) {
  return (
    <header className="w-full bg-base-100/80 border-b border-base-300/70 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left Title & Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-amber-600 flex items-center justify-center text-white shadow-md shadow-primary/20 shrink-0">
            <Coffee size={22} className="animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-lg text-base-content tracking-tight">
                Coffee Flavor Wheel Explorer
              </h1>
              <span className="hidden sm:inline-flex badge badge-xs badge-primary font-semibold">
                SCAA / WCR
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-base-content/60 font-medium hidden xs:block">
              WCR Sensory Lexicon
              の味覚階層から好みのスペシャルティコーヒー豆を発見
            </p>
          </div>
        </div>

        {/* Right Actions & Utilities */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Dataset Count Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-base-200/80 text-xs text-base-content/80 font-medium border border-base-300/40">
            <Sparkles size={13} className="text-amber-600" />
            <span>{totalBeansCount} 銘柄の豆を収録</span>
          </div>

          {/* Language Toggle Dropdown */}
          <div className="dropdown dropdown-end">
            <button
              type="button"
              className="btn btn-sm btn-ghost gap-1.5 rounded-full border border-base-300/60 bg-base-200/50 hover:bg-base-200"
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
