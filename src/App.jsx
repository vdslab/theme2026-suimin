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
  // オブジェクトのキーは数値idで昇順に並ぶため、追加順は別途配列で保持する。
  const [drankOrder, setDrankOrder] = useState([]);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

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
          drankCoffees={drankCoffees}
          onUpdateDrank={handleUpdateDrank}
          onRemoveDrank={handleRemoveDrank}
        />
      </div>
    </div>
  );
}

export default App;
