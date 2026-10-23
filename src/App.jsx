import { useEffect, useState } from "react";
import CoffeeBeanList from "./components/CoffeeBeanList";
import CoffeeDetailModal from "./components/CoffeeDetailModal";
import FlavorWheel from "./components/FlavorWheel";
import GravityNetwork from "./components/GravityNetwork";
import Header from "./components/Header";
import InfoGuideModal from "./components/InfoGuideModal";
import coffeeBeansData from "./data/coffee_beans.json";
import flavorTreeData from "./data/flavor_wheel_data.json";
import gravityData from "./data/gravity_network_data.json";

function App() {
  const [activeView, setActiveView] = useState("gravity"); // "gravity" | "wheel"
  const [selectedFlavor, setSelectedFlavor] = useState(null);
  const [selectedCoffee, setSelectedCoffee] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [languageMode, setLanguageMode] = useState("both"); // "both" | "ja" | "en"
  const [explorationMode, setExplorationMode] = useState("step"); // "step" | "all"
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Show guide on first visit
  useEffect(() => {
    const hasSeenGuide = localStorage.getItem("hasSeenFlavorGuide_v1");
    if (!hasSeenGuide) {
      setIsGuideOpen(true);
      localStorage.setItem("hasSeenFlavorGuide_v1", "true");
    }
  }, []);

  // Handle clicking a flavor note badge from a coffee card to navigate the wheel
  const handleSelectFlavorPath = (note) => {
    if (!note) return;
    const targetPath = note.fullPath || note.path;
    // Find matching flavor node in tree
    const findNode = (node) => {
      if (node.path === targetPath) return node;
      if (node.children) {
        for (const child of node.children) {
          const res = findNode(child);
          if (res) return res;
        }
      }
      return null;
    };

    const found = findNode(flavorTreeData);
    if (found) {
      setSelectedFlavor(found);
    } else {
      setSelectedFlavor({
        name: note.descriptor || note.name,
        nameJa: note.nameJa || note.descriptor,
        path: targetPath,
        color: "var(--color-primary, #6f4e37)",
      });
    }
  };

  const handleOpenDetailModal = (coffee) => {
    setSelectedCoffee(coffee);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen w-screen bg-[#fcf9f5] text-base-content font-sans overflow-x-hidden">
      {/* Header */}
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        languageMode={languageMode}
        setLanguageMode={setLanguageMode}
        explorationMode={explorationMode}
        setExplorationMode={setExplorationMode}
        onOpenGuide={() => setIsGuideOpen(true)}
        totalBeansCount={coffeeBeansData.length}
      />

      {/* Main Split-View Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 overflow-hidden">
        {/* Left / Center Visualizer */}
        <section className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-[540px] lg:min-h-0 lg:h-[calc(100vh-6.5rem)]">
          {activeView === "gravity" ? (
            <GravityNetwork
              data={gravityData}
              selectedCoffee={selectedCoffee}
              onSelectCoffee={(coffee) => {
                setSelectedCoffee(coffee);
              }}
              languageMode={languageMode}
              onOpenDetail={handleOpenDetailModal}
            />
          ) : (
            <FlavorWheel
              flavorTree={flavorTreeData}
              beans={coffeeBeansData}
              selectedFlavor={selectedFlavor}
              onSelectFlavor={setSelectedFlavor}
              onSelectCoffee={setSelectedCoffee}
              explorationMode={explorationMode}
              languageMode={languageMode}
            />
          )}
        </section>

        {/* Right: Coffee Bean Recommendations & Filters */}
        <section className="lg:col-span-5 xl:col-span-4 flex flex-col min-h-[500px] lg:min-h-0 lg:h-[calc(100vh-6.5rem)]">
          <CoffeeBeanList
            beans={coffeeBeansData}
            selectedFlavor={selectedFlavor}
            onClearFlavor={() => setSelectedFlavor(null)}
            onSelectFlavorPath={handleSelectFlavorPath}
            onSelectCoffee={setSelectedCoffee}
            selectedCoffee={selectedCoffee}
            explorationMode={explorationMode}
            activeView={activeView}
          />
        </section>
      </main>

      {/* Coffee Details Modal */}
      <CoffeeDetailModal
        coffee={isDetailModalOpen ? selectedCoffee : null}
        onClose={() => setIsDetailModalOpen(false)}
        onSelectFlavorPath={handleSelectFlavorPath}
      />

      {/* Startup & Help Guide Modal */}
      <InfoGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}

export default App;
