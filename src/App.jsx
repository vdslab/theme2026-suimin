import { ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import DetailPanel from "./components/DetailPanel";
import DrankList from "./components/DrankList";
import Header from "./components/Header";
import StartupGuide from "./components/StartupGuide";
import WorldMap from "./components/WorldMap";
import { useRecommendation } from "./hooks/useRecommendation";
import { translateCountry } from "./lib/countryNames";

function App() {
  const [selectedCoffee, setSelectedCoffee] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [drankCoffees, setDrankCoffees] = useState({}); // { [id]: score }
  // オブジェクトのキーは数値idで昇順に並ぶため、追加順は別途配列で保持する。
  const [drankOrder, setDrankOrder] = useState([]);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  // モバイルのボトムシートの最小化状態（デスクトップの右パネルでは未使用）
  const [sheetMinimized, setSheetMinimized] = useState(false);

  useEffect(() => {
    const hasSeenGuide = localStorage.getItem("hasSeenGuide");
    if (!hasSeenGuide) {
      setIsGuideOpen(true);
      localStorage.setItem("hasSeenGuide", "true");
    }
  }, []);

  // 別の豆を選び直したらシートは展開状態に戻す
  useEffect(() => {
    if (selectedCoffee) setSheetMinimized(false);
  }, [selectedCoffee]);

  const { recommendedCoffee, setRecommendedCoffee, recommend } =
    useRecommendation(drankCoffees, setSelectedCoffee);

  const handleCloseDetail = () => {
    setSelectedCoffee(null);
  };

  const handleUpdateDrank = (id, score) => {
    const key = String(id);
    setDrankCoffees((prev) => ({ ...prev, [key]: score }));
    setDrankOrder((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setRecommendedCoffee(null);
  };

  const handleRemoveDrank = (id) => {
    const key = String(id);
    setDrankCoffees((prev) => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
    setDrankOrder((prev) => prev.filter((k) => k !== key));
    setRecommendedCoffee(null);
  };

  const handleClearDrank = () => {
    setDrankCoffees({});
    setDrankOrder([]);
    setRecommendedCoffee(null);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#e0f2fe] text-base-content font-sans">
      <WorldMap
        selectedCoffee={selectedCoffee}
        onSelectCoffee={setSelectedCoffee}
        searchQuery={searchQuery}
        drankCoffees={drankCoffees}
        recommendedCoffee={recommendedCoffee}
      />

      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      <DrankList
        drankCoffees={drankCoffees}
        drankOrder={drankOrder}
        onRemoveDrank={handleRemoveDrank}
        onClearDrank={handleClearDrank}
        onSelectCoffee={setSelectedCoffee}
        selectedCoffee={selectedCoffee}
        onRecommend={recommend}
        isRecommendedActive={recommendedCoffee != null}
        onClearRecommendation={() => setRecommendedCoffee(null)}
      />

      <StartupGuide
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      <div
        className={`absolute z-30 flex flex-col bg-base-100 shadow-2xl transition-transform duration-300 transform inset-x-0 bottom-0 h-[30dvh] rounded-t-2xl sm:inset-x-auto sm:top-0 sm:right-0 sm:bottom-auto sm:h-full sm:w-96 sm:rounded-none ${
          !selectedCoffee
            ? "translate-y-full sm:translate-x-full sm:translate-y-0"
            : sheetMinimized
              ? "translate-y-[calc(30dvh-3rem)] sm:translate-x-0 sm:translate-y-0"
              : "translate-y-0 sm:translate-x-0"
        }`}
      >
        {/* モバイル専用: つまみ。タップで最小化/展開を切り替える */}
        <button
          type="button"
          onClick={() => setSheetMinimized((m) => !m)}
          className="sm:hidden flex h-12 shrink-0 flex-col items-center justify-center gap-1 border-b border-base-200"
          aria-label={sheetMinimized ? "詳細を展開" : "詳細を最小化"}
        >
          <span className="h-1.5 w-10 rounded-full bg-base-300" />
          {sheetMinimized && selectedCoffee && (
            <span className="flex items-center gap-1 text-xs font-semibold text-base-content/70">
              {translateCountry(selectedCoffee.country)}
              <ChevronUp size={14} />
            </span>
          )}
        </button>

        <div className="min-h-0 flex-1">
          <DetailPanel
            selectedCoffee={selectedCoffee}
            isRecommended={
              selectedCoffee &&
              recommendedCoffee &&
              selectedCoffee.id === recommendedCoffee.id
            }
            onClose={handleCloseDetail}
            onSelectCoffee={setSelectedCoffee}
            drankCoffees={drankCoffees}
            onUpdateDrank={handleUpdateDrank}
            onRemoveDrank={handleRemoveDrank}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
