import { useEffect, useState } from "react";
import DetailPanel from "./components/DetailPanel";
import DrankList from "./components/DrankList";
import Header from "./components/Header";
import StartupGuide from "./components/StartupGuide";
import WorldMap from "./components/WorldMap";
import { useRecommendation } from "./hooks/useRecommendation";

function App() {
  const [selectedCoffee, setSelectedCoffee] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [drankCoffees, setDrankCoffees] = useState({}); // { [id]: score }
  // 飲んだ豆の追加順(id文字列の配列)。オブジェクトのキーは数値idで昇順に並ぶため、
  // 「新しく追加したものを下に溜める」には挿入順を別途保持する必要がある。
  const [drankOrder, setDrankOrder] = useState([]);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [popupRequest, setPopupRequest] = useState(0);

  useEffect(() => {
    const hasSeenGuide = localStorage.getItem("hasSeenGuide");
    if (!hasSeenGuide) {
      setIsGuideOpen(true);
      localStorage.setItem("hasSeenGuide", "true");
    }
  }, []);

  const { recommendedCoffee, setRecommendedCoffee, recommend } =
    useRecommendation(drankCoffees, setSelectedCoffee);

  const handleCloseDetail = () => {
    setSelectedCoffee(null);
  };

  const handleUpdateDrank = (id, score) => {
    const key = String(id);
    setDrankCoffees((prev) => ({ ...prev, [key]: score }));
    // 未登録なら末尾に追加（＝リストの下に溜まる）。既存の更新では順序を変えない。
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

  const handleSelectFromList = (coffee) => {
    setSelectedCoffee(coffee);
    setPopupRequest((n) => n + 1);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#e0f2fe] text-base-content font-sans">
      {/* 1. Map Layer (Full Screen) */}
      <WorldMap
        selectedCoffee={selectedCoffee}
        onSelectCoffee={setSelectedCoffee}
        searchQuery={searchQuery}
        drankCoffees={drankCoffees}
        onUpdateDrank={handleUpdateDrank}
        onRemoveDrank={handleRemoveDrank}
        recommendedCoffee={recommendedCoffee}
        popupRequest={popupRequest}
      />

      {/* 2. Floating Header (Search & Recommend) */}
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* 飲んだ豆の一覧（左側・その場で解除できる） */}
      <DrankList
        drankCoffees={drankCoffees}
        drankOrder={drankOrder}
        onRemoveDrank={handleRemoveDrank}
        onClearDrank={handleClearDrank}
        onSelectCoffee={handleSelectFromList}
        selectedCoffee={selectedCoffee}
        onRecommend={recommend}
        isRecommendedActive={recommendedCoffee != null}
        onClearRecommendation={() => setRecommendedCoffee(null)}
      />

      {/* Startup Guide Modal */}
      <StartupGuide
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* 3. Detail Panel (Slide-in) */}
      <div
        className={`absolute top-0 right-0 h-full w-96 bg-base-100 shadow-2xl z-30 transition-transform duration-300 transform ${
          selectedCoffee ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <DetailPanel
          selectedCoffee={selectedCoffee}
          isRecommended={
            selectedCoffee &&
            recommendedCoffee &&
            selectedCoffee.id === recommendedCoffee.id
          }
          onClose={handleCloseDetail}
          onSelectCoffee={setSelectedCoffee}
        />
      </div>
    </div>
  );
}

export default App;
