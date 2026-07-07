import { useEffect, useState } from "react";
import DetailPanel from "./components/DetailPanel";
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
        onRemoveDrank={(id) => {
          setDrankCoffees((prev) => {
            const newState = { ...prev };
            delete newState[id];
            return newState;
          });
          setRecommendedCoffee(null);
        }}
        recommendedCoffee={recommendedCoffee}
      />

      {/* 2. Floating Header (Search & Recommend) */}
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onRecommend={recommend}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Startup Guide Modal */}
      <StartupGuide
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* 3. Detail Panel (Slide-in / Bottom Sheet) */}
      <div
        className={`absolute bg-base-100 z-30 transition-transform duration-300 transform 
          bottom-0 left-0 right-0 h-[55vh] rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)]
          lg:top-0 lg:bottom-auto lg:left-auto lg:right-0 lg:h-full lg:w-96 lg:rounded-none lg:shadow-2xl
          ${
            selectedCoffee
              ? "translate-y-0 lg:translate-x-0"
              : "translate-y-full lg:translate-y-0 lg:translate-x-full"
          }
        `}
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
