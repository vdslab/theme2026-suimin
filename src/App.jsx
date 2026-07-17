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

  const handleRemoveDrank = (id) => {
    setDrankCoffees((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
    setRecommendedCoffee(null);
  };

  const handleClearDrank = () => {
    setDrankCoffees({});
    setRecommendedCoffee(null);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#e0f2fe] text-base-content font-sans">
      {/* 1. Map Layer (Full Screen) */}
      <WorldMap
        selectedCoffee={selectedCoffee}
        onSelectCoffee={setSelectedCoffee}
        searchQuery={searchQuery}
        drankCoffees={drankCoffees}
        onUpdateDrank={(id, score) => {
          setDrankCoffees((prev) => ({ ...prev, [id]: score }));
          setRecommendedCoffee(null);
        }}
        onRemoveDrank={handleRemoveDrank}
        recommendedCoffee={recommendedCoffee}
      />

      {/* 2. Floating Header (Search & Recommend) */}
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onRecommend={recommend}
        isRecommendedActive={recommendedCoffee != null}
        onClearRecommendation={() => setRecommendedCoffee(null)}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* 飲んだ豆の一覧（左側・その場で解除できる） */}
      <DrankList
        drankCoffees={drankCoffees}
        onRemoveDrank={handleRemoveDrank}
        onClearDrank={handleClearDrank}
        onSelectCoffee={setSelectedCoffee}
        selectedCoffee={selectedCoffee}
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
