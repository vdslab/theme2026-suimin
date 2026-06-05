import React, { useState, useMemo, useEffect } from "react";
import CoffeeChart from "./components/CoffeeChart";
import TasteRadarChart from "./components/TasteRadarChart";
import PreferenceSelector from "./components/PreferenceSelector";

// Import precomputed data
import groupedData from "./data/coffee_data_grouped.json";
import varietyData from "./data/coffee_data_variety.json";

function App() {
  const [mode, setMode] = useState("grouped"); // "grouped" or "variety"
  const [selectedIds, setSelectedIds] = useState([]);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [clickedNode, setClickedNode] = useState(null);
  const [theme, setTheme] = useState("coffee");

  // Reset selections when changing aggregation mode
  useEffect(() => {
    setSelectedIds([]);
    setClickedNode(null);
    setHoveredNode(null);
  }, [mode]);

  // Dynamically load selected data source
  const currentData = useMemo(() => {
    return mode === "grouped" ? groupedData : varietyData;
  }, [mode]);

  // Toggle dark/light theme
  const toggleTheme = () => {
    const nextTheme = theme === "coffee" ? "cupcake" : "coffee";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  // Setup theme on mount
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  // Compute preference profile based on selected nodes
  const preferenceProfile = useMemo(() => {
    if (selectedIds.length === 0) return null;
    const selectedNodes = currentData.nodes.filter((node) =>
      selectedIds.includes(node.id)
    );
    
    const tasteCols = ["Aroma", "Flavor", "Aftertaste", "Acidity", "Body", "Balance"];
    const profile = {};
    
    tasteCols.forEach((col) => {
      const sum = selectedNodes.reduce((acc, node) => acc + node.taste[col], 0);
      profile[col] = sum / selectedNodes.length;
    });
    
    return profile;
  }, [selectedIds, currentData]);

  // Compute recommendations
  const recommendations = useMemo(() => {
    if (!preferenceProfile) return [];
    
    const tasteCols = ["Aroma", "Flavor", "Aftertaste", "Acidity", "Body", "Balance"];
    
    const candidates = currentData.nodes
      .filter((node) => !selectedIds.includes(node.id))
      .map((node) => {
        // Calculate Euclidean distance in taste space
        let sumSquaredDiffs = 0;
        tasteCols.forEach((col) => {
          const diff = node.taste[col] - preferenceProfile[col];
          sumSquaredDiffs += diff * diff;
        });
        const distance = Math.sqrt(sumSquaredDiffs);
        
        // Map distance to a similarity score (0% to 100%)
        // Typically, difference in taste averages falls within 0 to 2.
        const similarity = Math.max(0, Math.min(100, 100 * (1 - distance / 2.2)));
        
        return {
          ...node,
          distance,
          similarity
        };
      });
      
    // Sort by similarity descending
    return candidates.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }, [preferenceProfile, currentData, selectedIds]);

  const recommendedIds = useMemo(() => {
    return recommendations.map((r) => r.id);
  }, [recommendations]);

  // Select handlers
  const handleSelectNode = (id) => {
    if (!selectedIds.includes(id)) {
      setSelectedIds((prev) => [...prev, id]);
    }
  };

  const handleDeselectNode = (id) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleNodeClick = (node) => {
    setClickedNode(node);
  };

  // Node details display prioritizes hover, then clicked node, then first recommendation/selection
  const detailNode = useMemo(() => {
    if (hoveredNode) return hoveredNode;
    if (clickedNode) {
      // Find latest data for this node (in case mode changed)
      const found = currentData.nodes.find((n) => n.id === clickedNode.id);
      if (found) return found;
    }
    if (recommendations.length > 0) return recommendations[0];
    if (selectedIds.length > 0) {
      return currentData.nodes.find((n) => n.id === selectedIds[0]);
    }
    return null;
  }, [hoveredNode, clickedNode, recommendations, selectedIds, currentData]);

  return (
    <div className="min-h-screen bg-base-200 transition-colors duration-300 font-sans flex flex-col">
      {/* Header navbar */}
      <header className="navbar bg-base-100 border-b border-base-300 px-6 py-3 shadow-md flex justify-between items-center z-15">
        <div className="flex items-center gap-3">
          <div className="avatar placeholder">
            <div className="bg-primary text-primary-content rounded-xl w-10 h-10 flex items-center justify-center font-bold text-lg shadow-inner select-none">
              ☕
            </div>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider text-base-content/95 leading-none">
              COFFEE FLAVOR PROFILER
            </h1>
            <p className="text-[10px] text-base-content/50 mt-1">
              UMAP次元削減 & HDBSCANクラスタリングによるコーヒー風味マップ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Mode Tabs */}
          <div className="tabs tabs-box bg-base-200 p-1 rounded-xl shadow-inner flex gap-1">
            <button
              onClick={() => setMode("grouped")}
              className={`tab tab-xs rounded-lg px-3 py-1.5 font-bold transition-all text-[11px] ${
                mode === "grouped"
                  ? "tab-active bg-primary text-primary-content shadow-md"
                  : "text-base-content/60 hover:text-base-content"
              }`}
            >
              産地・精製方法で集約
            </button>
            <button
              onClick={() => setMode("variety")}
              className={`tab tab-xs rounded-lg px-3 py-1.5 font-bold transition-all text-[11px] ${
                mode === "variety"
                  ? "tab-active bg-primary text-primary-content shadow-md"
                  : "text-base-content/60 hover:text-base-content"
              }`}
            >
              産地・精製方法・品種で集約
            </button>
          </div>

          {/* Theme toggler */}
          <button
            onClick={toggleTheme}
            className="btn btn-ghost btn-circle btn-sm shadow-sm border border-base-300 bg-base-200 text-lg hover:bg-base-300"
            title="テーマ切り替え"
          >
            {theme === "coffee" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {/* Main dashboard body */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-hidden max-w-7xl mx-auto w-full">
        {/* Left Column: Input and Recommendations */}
        <section className="lg:col-span-5 flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-140px)] pr-2 scrollbar-thin">
          
          {/* Preference Selection Card */}
          <div className="card bg-base-100 border border-base-300 shadow-xl p-5 rounded-3xl flex flex-col gap-4">
            <h2 className="text-sm font-extrabold text-base-content/85 flex items-center gap-2">
              🧭 あなたのコーヒー体験を入力
            </h2>
            <PreferenceSelector
              nodes={currentData.nodes}
              selectedIds={selectedIds}
              onSelect={handleSelectNode}
              onDeselect={handleDeselectNode}
              onClear={handleClearSelection}
            />
          </div>

          {/* Recommendations List Card */}
          {selectedIds.length > 0 && (
            <div className="card bg-base-100 border border-base-300 shadow-xl p-5 rounded-3xl flex flex-col gap-4">
              <h2 className="text-sm font-extrabold text-base-content/85 flex items-center gap-2">
                ✨ あなたにオススメのコーヒー豆
              </h2>
              <div className="flex flex-col gap-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between p-3 border border-base-200 rounded-2xl hover:bg-base-200/50 hover:border-base-300 transition-all shadow-sm cursor-pointer"
                    onClick={() => handleNodeClick(rec)}
                  >
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs leading-none truncate text-base-content/95">
                          {rec.label}
                        </span>
                        <span
                          className="badge text-[8px] font-bold h-4 border-none"
                          style={{
                            backgroundColor: rec.color,
                            color: "#fff",
                            textShadow: "0 1px 1px rgba(0,0,0,0.15)"
                          }}
                        >
                          {rec.dominant_cluster.split(" ")[1] || "独自"}
                        </span>
                      </div>
                      <span className="text-[9px] text-base-content/50 truncate">
                        品種: {rec.varieties.length > 0 ? rec.varieties.join(", ") : "未指定"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Match Score */}
                      <div className="text-right mr-1">
                        <div className="text-xs font-black text-primary leading-none">
                          {rec.similarity.toFixed(0)}%
                        </div>
                        <div className="text-[8px] text-base-content/40 mt-0.5">match</div>
                      </div>
                      
                      {/* Action buttons */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectNode(rec.id);
                        }}
                        className="btn btn-primary btn-xs rounded-xl py-0 px-2.5 h-7 min-h-0 text-[10px] font-bold"
                        title="飲んだリストに追加"
                      >
                        ＋ 追加
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Details Card (Hover/Select) */}
          {detailNode && (
            <div className="card bg-base-100 border border-base-300 shadow-xl p-5 rounded-3xl flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">
                      詳細情報
                    </span>
                    {selectedIds.includes(detailNode.id) && (
                      <span className="badge badge-primary badge-xs py-1.5 text-[8px] font-bold">
                        選択中
                      </span>
                    )}
                    {recommendedIds.includes(detailNode.id) && (
                      <span className="badge badge-accent badge-xs py-1.5 text-[8px] font-bold">
                        オススメ
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-black text-base-content mt-1 leading-tight">
                    {detailNode.label}
                  </h2>
                </div>
                <div
                  className="px-2 py-1 rounded-xl text-[9px] font-bold text-white border-none flex items-center justify-center shadow-sm"
                  style={{
                    backgroundColor: detailNode.color,
                    textShadow: "0 1px 1.5px rgba(0,0,0,0.15)"
                  }}
                >
                  {detailNode.dominant_cluster}
                </div>
              </div>

              {/* Specific metadata */}
              <div className="flex flex-col gap-1.5 text-xs text-base-content/75 bg-base-200/50 p-3 rounded-2xl border border-base-200/40">
                <div>
                  <span className="font-semibold opacity-70">国名:</span> {detailNode.country}
                </div>
                <div>
                  <span className="font-semibold opacity-70">精製方法:</span> {detailNode.method}
                </div>
                {detailNode.varieties && detailNode.varieties.length > 0 && (
                  <div>
                    <span className="font-semibold opacity-70">品種:</span> {detailNode.varieties.join(", ")}
                  </div>
                )}
                <div className="flex justify-between items-center text-[10px] opacity-70 mt-1 pt-1 border-t border-base-300/40">
                  <span>データ内のサンプル数:</span>
                  <span className="font-bold">{detailNode.sample_count}件</span>
                </div>
              </div>

              {/* Radar Chart Visual */}
              <div className="flex justify-center border-t border-base-200/50 pt-2">
                <TasteRadarChart
                  taste={detailNode.taste}
                  color={detailNode.color}
                  size={210}
                />
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Visualization Chart */}
        <section className="lg:col-span-7 flex flex-col h-[calc(100vh-140px)] min-h-[500px]">
          <CoffeeChart
            nodes={currentData.nodes}
            clusters={currentData.clusters}
            selectedIds={selectedIds}
            recommendedIds={recommendedIds}
            onNodeClick={handleNodeClick}
            hoveredNode={hoveredNode}
            setHoveredNode={setHoveredNode}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
