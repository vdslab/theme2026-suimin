import { useMemo } from "react";
import rawData from "../data/coffee_data.json";
import { translateCountry } from "../lib/countryNames";

export default function Header({ searchQuery, setSearchQuery, onRecommend }) {
  const searchSuggestions = useMemo(() => {
    const values = rawData.flatMap((item) => [
      translateCountry(item.country),
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

  return (
    <div className="absolute top-6 left-6 z-20 flex flex-col gap-4 pointer-events-none">
      <div className="flex gap-4 items-start pointer-events-auto">
        <div className="bg-base-100 p-4 rounded-2xl shadow-lg border border-base-200">
          <h1 className="text-2xl font-bold mb-3 text-primary">Coffee Taste Map</h1>
          
          <div className="relative">
            <input
              type="text"
              className="input input-bordered w-full max-w-xs"
              placeholder="産地・精製方法・品種で検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {filteredSuggestions.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-box border border-base-300 bg-base-100 shadow-xl overflow-hidden">
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
          type="button"
          onClick={onRecommend} 
          className="btn btn-primary btn-lg text-white shadow-lg hover:scale-105 transition-transform shrink-0"
        >
          ✨ おすすめを計算する
        </button>
      </div>
    </div>
  );
}
