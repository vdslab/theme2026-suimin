import { useState, useMemo } from "react";

import Sidebar from "./components/Sidebar";
import CoffeeMap from "./components/CoffeeMap";
import DetailPanel from "./components/DetailPanel";
import rawData from "./data/coffee_data.json";

function App() {
  const [selectedCoffee, setSelectedCoffee] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const searchSuggestions = useMemo(() => {
    const values = rawData.flatMap((item) => [
      item.country,
      item.method,
      ...(item.varieties || []),
    ]);

    return [...new Set(values)]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, []);

  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      <div className="grid min-h-screen grid-cols-[240px_1fr_380px]">
        <Sidebar />

        <main className="border-x border-base-300 p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">味覚マップ</h1>
            <p className="mt-2 text-sm text-base-content/70">
              コーヒーの味わいの特徴をもとにしたマップです
            </p>

            <div className="mt-4">
              <input
                type="text"
                list="coffee-search-suggestions"
                className="input input-bordered w-full max-w-md"
                placeholder="産地・精製方法・品種で検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <datalist id="coffee-search-suggestions">
                {searchSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </div>
          </div>

          <CoffeeMap
            selectedCoffee={selectedCoffee}
            onSelectCoffee={setSelectedCoffee}
            searchQuery={searchQuery}
          />
        </main>

        <DetailPanel selectedCoffee={selectedCoffee} />
      </div>
    </div>
  );
}

export default App;
