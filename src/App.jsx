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

  const [selectedCoffee, setSelectedCoffee] = useState(null);
  const [selectedCountryNodes, setSelectedCountryNodes] = useState([]);

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

      {/* 3. Detail Panel (Slide-in) */}
      <div
        className={`absolute top-0 right-0 h-full w-96 bg-base-100 shadow-2xl z-30 transition-transform duration-300 transform ${
          selectedCoffee ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <DetailPanel
          selectedCoffee={selectedCoffee}
          countryNodes={selectedCountryNodes}
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
