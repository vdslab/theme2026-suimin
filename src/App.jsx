import { useMemo, useState } from "react";
import CoffeeMap, { coffeeData } from "./components/CoffeeMap";
import DetailPanel from "./components/DetailPanel";
import Sidebar from "./components/Sidebar";
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

  const filteredSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return [];

    return searchSuggestions
      .filter((suggestion) => suggestion.toLowerCase().includes(query))
      .slice(0, 8);
  }, [searchQuery, searchSuggestions]);
  const [drankCoffees, setDrankCoffees] = useState({}); // { [id]: score }
  const [recommendedCoffee, setRecommendedCoffee] = useState(null);

  const handleRecommend = () => {
    const drankIds = Object.keys(drankCoffees);
    if (drankIds.length === 0) {
      alert("まずは豆を選んで「飲んだ」と入力してください。");
      return;
    }

    // 1. Initial position = average of drank coffees
    let sumX = 0,
      sumY = 0;
    const drankNodes = coffeeData.filter(
      (d) => drankCoffees[d.id] !== undefined,
    );
    drankNodes.forEach((d) => {
      sumX += d.x;
      sumY += d.y;
    });
    const initX = sumX / drankNodes.length;
    const initY = sumY / drankNodes.length;

    // 2. Apply spring forces
    let deltaX = 0,
      deltaY = 0;
    let totalWeightMag = 0;
    drankNodes.forEach((d) => {
      const score = drankCoffees[d.id];
      const weight = score - 3; // 1->-2, 5->+2
      deltaX += weight * (d.x - initX);
      deltaY += weight * (d.y - initY);
      totalWeightMag += Math.abs(weight);
    });

    // 動きすぎ（画面外への吹っ飛び）を防ぐため、シフト量を合計ウェイトで正規化します。
    // スコア3（ウェイト0）ばかりの場合は移動しません。
    // 少しだけおすすめ度を強めるため、正規化した距離に微小な乗数(1.2)をかけます。
    const multiplier = 1.2;
    const shiftX =
      totalWeightMag === 0 ? 0 : (deltaX / totalWeightMag) * multiplier;
    const shiftY =
      totalWeightMag === 0 ? 0 : (deltaY / totalWeightMag) * multiplier;

    const finalX = initX + shiftX;
    const finalY = initY + shiftY;

    // 3. Find closest node (excluding drank ones)
    let closestNode = null;
    let minDistance = Infinity;

    coffeeData.forEach((d) => {
      if (drankCoffees[d.id] !== undefined) return; // skip drank coffees
      const dist = Math.sqrt((d.x - finalX) ** 2 + (d.y - finalY) ** 2);
      if (dist < minDistance) {
        minDistance = dist;
        closestNode = d;
      }
    });

    if (closestNode) {
      setRecommendedCoffee(closestNode);
      setSelectedCoffee(closestNode); // Select it to show details
    } else {
      alert("すべての豆を飲み尽くしました！");
    }
  };

  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      <div className="grid min-h-screen grid-cols-[240px_1fr_380px]">
        <Sidebar />

        <main className="border-x border-base-300 p-8 flex flex-col">
          <div className="mb-6 flex justify-between items-end">
            <div className="flex-1">
              <h1 className="text-3xl font-bold">味覚マップ</h1>
              <p className="mt-2 text-sm text-base-content/70">
                コーヒーの味わいの特徴をもとにしたマップです
              </p>

              <div className="mt-4 relative">
                <input
                  type="text"
                  list="coffee-search-suggestions"
                  className="input input-bordered w-full max-w-md"
                  placeholder="産地・精製方法・品種で検索"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                {filteredSuggestions.length > 0 && (
                  <div className="absolute z-50 mt-2 w-full max-w-md rounded-box border border-base-300 bg-base-100 shadow-lg overflow-hidden">
                    {filteredSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-base-200"
                        onClick={() => setSearchQuery(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleRecommend}
              className="btn btn-primary text-white shadow-sm hover:scale-105 transition-transform shrink-0 ml-4 mb-1"
            >
              おすすめを計算する
            </button>
          </div>

          <CoffeeMap
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
        </main>

        <DetailPanel
          selectedCoffee={selectedCoffee}
          isRecommended={
            selectedCoffee &&
            recommendedCoffee &&
            selectedCoffee.id === recommendedCoffee.id
          }
        />
      </div>
    </div>
  );
}

export default App;
