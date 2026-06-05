import React, { useState, useMemo, useEffect } from "react";
import CoffeeChart from "./components/CoffeeChart";
import PreferenceSelector from "./components/PreferenceSelector";

// Import precomputed datasets
import groupedData from "./data/coffee_data_grouped.json";
import varietyData from "./data/coffee_data_variety.json";

// Country Flag helper
const getCountryFlag = (country) => {
  const flags = {
    "Ethiopia": "🇪🇹",
    "Kenya": "🇰🇪",
    "Brazil": "🇧🇷",
    "Colombia": "🇨🇴",
    "Guatemala": "🇬🇹",
    "Costa Rica": "🇨🇷",
    "Mexico": "🇲🇽",
    "Panama": "🇵🇦",
    "China": "🇨🇳",
    "Taiwan": "🇹🇼",
    "Tanzania": "🇹🇿",
    "El Salvador": "🇸🇻",
    "Indonesia": "🇮🇩",
    "United States": "🇺🇸",
    "Uganda": "🇺🇬",
    "Honduras": "🇭🇳",
    "Nicaragua": "🇳🇮",
    "Papua New Guinea": "🇵🇬",
    "Thailand": "🇹🇭",
    "Peru": "🇵🇪"
  };
  return flags[country] || "☕";
};

// Japanese translation for countries
const getCountryJp = (country) => {
  const translations = {
    "Ethiopia": "エチオピア",
    "Kenya": "ケニア",
    "Brazil": "ブラジル",
    "Colombia": "コロンビア",
    "Guatemala": "グアテマラ",
    "Costa Rica": "コスタリカ",
    "Mexico": "メキシコ",
    "Panama": "パナマ",
    "China": "中国",
    "Taiwan": "台湾",
    "Tanzania": "タンザニア",
    "El Salvador": "エルサルバドル",
    "Indonesia": "インドネシア",
    "United States": "アメリカ",
    "Uganda": "ウガンダ",
    "Honduras": "ホンジュラス",
    "Nicaragua": "ニカラグア",
    "Papua New Guinea": "パプアニューギニア",
    "Thailand": "タイ",
    "Peru": "ペルー"
  };
  return translations[country] || country;
};

// Processing Method Translation
const getMethodJp = (method) => {
  if (!method) return "";
  const cleaned = method.split("/")[0].trim().toLowerCase();
  if (cleaned.includes("washed") || cleaned.includes("wet")) return "ウォッシュド";
  if (cleaned.includes("natural") || cleaned.includes("dry")) return "ナチュラル";
  if (cleaned.includes("pulped") || cleaned.includes("honey")) return "ハニー / パルプド";
  if (cleaned.includes("semi")) return "セミウォッシュド";
  return method.split("/")[0].trim();
};

function App() {
  const [mode, setMode] = useState("grouped"); // "grouped" or "variety"
  const [selectedIds, setSelectedIds] = useState([]); // Selected = Drank (星マーク)
  const [likedIds, setLikedIds] = useState([]); // Favorites (ハートマーク)
  const [hoveredNode, setHoveredNode] = useState(null);
  const [clickedNode, setClickedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("map"); // "map", "recommend", "drank", "favorite", "compare"

  // Reset states when mode changes
  useEffect(() => {
    setSelectedIds([]);
    setLikedIds([]);
    setClickedNode(null);
    setHoveredNode(null);
  }, [mode]);

  // Load current dataset
  const currentData = useMemo(() => {
    return mode === "grouped" ? groupedData : varietyData;
  }, [mode]);

  // Toggle node selection (Drank list)
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Toggle node like (Favorites list)
  const handleToggleLike = (id) => {
    setLikedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Preference Profile
  const preferenceProfile = useMemo(() => {
    if (selectedIds.length === 0) return null;
    const selectedNodes = currentData.nodes.filter((node) =>
      selectedIds.includes(node.id)
    );
    const tasteCols = ["Aroma", "Flavor", "Aftertaste", "Acidity", "Body", "Balance"];
    const profile = {};
    tasteCols.forEach((col) => {
      const sum = selectedNodes.reduce((acc, n) => acc + n.taste[col], 0);
      profile[col] = sum / selectedNodes.length;
    });
    return profile;
  }, [selectedIds, currentData]);

  // Recommendations
  const recommendations = useMemo(() => {
    if (!preferenceProfile) return [];
    const tasteCols = ["Aroma", "Flavor", "Aftertaste", "Acidity", "Body", "Balance"];
    const candidates = currentData.nodes
      .filter((node) => !selectedIds.includes(node.id))
      .map((node) => {
        let sumSquaredDiffs = 0;
        tasteCols.forEach((col) => {
          const diff = node.taste[col] - preferenceProfile[col];
          sumSquaredDiffs += diff * diff;
        });
        const distance = Math.sqrt(sumSquaredDiffs);
        const similarity = Math.max(0, Math.min(100, 100 * (1 - distance / 2.0)));
        return { ...node, similarity };
      });
    return candidates.sort((a, b) => b.similarity - a.similarity).slice(0, 6);
  }, [preferenceProfile, currentData, selectedIds]);

  const recommendedIds = useMemo(() => {
    return recommendations.map((r) => r.id);
  }, [recommendations]);

  // Filter nodes matching search query
  const searchedNodes = useMemo(() => {
    if (!searchQuery.trim()) return currentData.nodes;
    const query = searchQuery.toLowerCase();
    return currentData.nodes.filter(
      (n) =>
        n.label.toLowerCase().includes(query) ||
        n.country.toLowerCase().includes(query) ||
        n.method.toLowerCase().includes(query)
    );
  }, [searchQuery, currentData]);

  // Handle clicking a node
  const handleNodeClick = (node) => {
    setClickedNode(node);
  };

  // Active detail node prioritizes hover, clicked, first recommendation, or first selection
  const detailNode = useMemo(() => {
    if (hoveredNode) return hoveredNode;
    if (clickedNode) {
      const found = currentData.nodes.find((n) => n.id === clickedNode.id);
      if (found) return found;
    }
    if (recommendations.length > 0) return recommendations[0];
    if (selectedIds.length > 0) {
      return currentData.nodes.find((n) => n.id === selectedIds[0]);
    }
    return currentData.nodes[0]; // fallback
  }, [hoveredNode, clickedNode, recommendations, selectedIds, currentData]);

  // Calculate 3 Nearest Neighbors in 2D space
  const nearestNeighbors = useMemo(() => {
    if (!detailNode) return [];
    const list = currentData.nodes
      .filter((n) => n.id !== detailNode.id)
      .map((n) => {
        const dx = n.x - detailNode.x;
        const dy = n.y - detailNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return { ...n, mapDistance: dist };
      });
    return list.sort((a, b) => a.mapDistance - b.mapDistance).slice(0, 3);
  }, [detailNode, currentData]);

  // Handle search select
  const handleSearchSelect = (nodeId) => {
    const node = currentData.nodes.find((n) => n.id === nodeId);
    if (node) {
      setClickedNode(node);
      handleToggleSelect(nodeId);
    }
  };

  return (
    <div className="flex h-screen bg-brand-beige text-brand-text font-sans antialiased overflow-hidden">
      
      {/* 1. Left Sidebar Navigation */}
      <aside className="w-[240px] bg-brand-sidebar border-r border-brand-border flex flex-col justify-between p-5 shrink-0">
        <div className="flex flex-col gap-8">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white border border-brand-border flex items-center justify-center shadow-sm select-none">
              <svg className="w-6 h-6 text-brand-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 8h1a3 3 0 0 1 0 6h-1" strokeLinecap="round" />
                <path d="M2 8h16v6a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                <path d="M6 3v2M10 3v2M14 3v2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-left">
              <h1 className="font-extrabold text-sm tracking-wider leading-none">Bean Voyage</h1>
              <p className="text-[10px] text-brand-text/50 mt-1">Find your favorite coffee</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {[
              { id: "map", label: "味覚マップ", icon: "🗺️" },
              { id: "recommend", label: "おすすめ", icon: "⭐️" },
              { id: "drank", label: "飲んだ豆", icon: "☕" },
              { id: "favorite", label: "お気に入り", icon: "❤️" },
              { id: "compare", label: "比較リスト", icon: "📋" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left ${
                  activeTab === item.id
                    ? "bg-brand-primary/10 text-brand-primary border-none"
                    : "text-brand-text/60 hover:bg-black/5 hover:text-brand-text"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* User Profile Block */}
        <div className="p-4 rounded-3xl bg-[#EBE7DF]/60 border border-brand-border/40 text-left">
          <h4 className="text-[11px] font-extrabold text-brand-text/80">あなたのプロフィール</h4>
          <div className="mt-2.5 flex flex-col gap-1 text-[11px] text-brand-text/60">
            <div className="flex justify-between">
              <span>飲んだ豆</span>
              <span className="font-bold text-brand-text">{selectedIds.length} 種類</span>
            </div>
            <div className="flex justify-between">
              <span>お気に入り</span>
              <span className="font-bold text-brand-text">{likedIds.length} 種類</span>
            </div>
          </div>
          <button className="btn btn-block bg-white border border-brand-border hover:bg-white hover:border-brand-primary btn-xs rounded-xl text-[10px] font-bold py-1.5 h-auto min-h-0 mt-3 text-brand-text/80">
            プロフィール編集
          </button>
        </div>
      </aside>

      {/* 2. Central Area (Header, Map, Recommendations) */}
      <section className="flex-1 flex flex-col h-full overflow-hidden p-6 gap-6">
        
        {/* Central Header */}
        <header className="flex justify-between items-center w-full">
          <div className="text-left">
            <h2 className="text-lg font-black text-brand-text flex items-center gap-1.5 leading-none">
              味覚マップ
              <span className="text-xs text-brand-text/30 cursor-pointer font-normal hover:text-brand-primary" title="説明を表示">
                ⓘ
              </span>
            </h2>
            <p className="text-[11px] text-brand-text/40 mt-1.5 font-medium">
              コーヒーの味わいの特徴をもとにしたマップです
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode selection dropdown */}
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-sm bg-white border border-brand-border hover:bg-brand-primary-light hover:border-brand-primary rounded-xl text-[11px] font-bold min-h-0 h-9 px-3">
                {mode === "grouped" ? "すべての豆 (産地・精製)" : "すべての豆 (品種詳細)"} <span className="opacity-50 ml-1">∨</span>
              </div>
              <ul tabIndex={0} className="dropdown-content z-20 menu p-1.5 shadow-lg bg-white border border-brand-border rounded-2xl w-60 mt-1">
                <li>
                  <button onClick={() => setMode("grouped")} className={`text-xs py-2 px-3 rounded-xl ${mode === "grouped" ? "bg-brand-primary/10 text-brand-primary font-bold" : ""}`}>
                    産地・精製方法で集約
                  </button>
                </li>
                <li>
                  <button onClick={() => setMode("variety")} className={`text-xs py-2 px-3 rounded-xl ${mode === "variety" ? "bg-brand-primary/10 text-brand-primary font-bold" : ""}`}>
                    産地・精製方法・品種で集約
                  </button>
                </li>
              </ul>
            </div>

            {/* Filter button */}
            <button className="btn btn-sm bg-white border border-brand-border hover:bg-brand-primary-light hover:border-brand-primary rounded-xl text-[11px] font-bold min-h-0 h-9 px-3.5">
              ⚙️ 絞り込み
            </button>

            {/* Search bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="豆名・産地で検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input input-sm input-bordered bg-white border border-brand-border w-48 rounded-xl focus:outline-none focus:border-brand-primary text-[11px] h-9 pl-8 pr-3"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-35 text-[10px]">🔍</span>
            </div>

            {/* Avatar */}
            <div className="avatar placeholder">
              <div className="bg-brand-primary text-white rounded-full w-9 h-9 flex items-center justify-center font-bold text-xs shadow-inner">
                MK
              </div>
            </div>
          </div>
        </header>

        {/* Central Map */}
        <div className="flex-1 min-h-0 relative">
          <CoffeeChart
            nodes={searchedNodes}
            clusters={currentData.clusters}
            selectedIds={selectedIds}
            recommendedIds={recommendedIds}
            onNodeClick={handleNodeClick}
            hoveredNode={hoveredNode}
            setHoveredNode={setHoveredNode}
          />
        </div>

        {/* Bottom Recommendation Panel */}
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-brand-text/90">あなたへのオススメ</h3>
            <button className="text-[10px] font-bold text-brand-primary hover:underline flex items-center gap-1">
              すべて見る →
            </button>
          </div>

          {selectedIds.length === 0 ? (
            <div className="border border-dashed border-brand-border rounded-2xl p-6 text-center text-[11px] text-brand-text/40 bg-white/40">
              マップ上であなたが飲んだことのある豆をダブルクリック、または右側パネルで「飲んだ豆に追加」すると、お好みの豆が自動推薦されます。
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-1.5 scrollbar-thin">
              {recommendations.map((rec) => {
                const isLiked = likedIds.includes(rec.id);
                const firstVar = rec.varieties[0] || "";
                const cleanMethod = getMethodJp(rec.method);
                return (
                  <div
                    key={rec.id}
                    className="card bg-white border border-brand-border/60 hover:border-brand-primary/40 p-4 rounded-2xl flex flex-col justify-between w-[210px] shrink-0 text-left cursor-pointer transition-all shadow-sm shadow-brand-shadow"
                    onClick={() => handleNodeClick(rec)}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        {/* Country tag */}
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-brand-text/50">
                          <span>{getCountryFlag(rec.country)}</span>
                          <span>{getCountryJp(rec.country)}</span>
                        </div>
                        {/* Title */}
                        <h4 className="font-extrabold text-xs text-brand-text truncate leading-none mt-1">
                          {firstVar ? `${getCountryJp(rec.country)} ${firstVar}` : rec.label.split(" - ")[0]}
                        </h4>
                        {/* Method */}
                        <span className="text-[9px] text-brand-text/40 font-medium">
                          {cleanMethod}
                        </span>
                      </div>
                      
                      {/* Favorite button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleLike(rec.id);
                        }}
                        className={`btn btn-ghost btn-circle btn-xs hover:bg-brand-primary-light/50 ${
                          isLiked ? "text-error" : "text-brand-text/30"
                        }`}
                      >
                        ❤️
                      </button>
                    </div>

                    {/* Badges footer */}
                    <div className="flex flex-wrap gap-1 mt-3.5">
                      <span className="px-2 py-0.5 rounded-lg bg-brand-primary-light/50 text-brand-primary font-bold text-[8px]">
                        {rec.dominant_cluster.split(" ")[1] || "マイルド"}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-neutral-content/40 text-brand-text/60 font-bold text-[8px]">
                        {rec.similarity.toFixed(0)}% マッチ
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 3. Right Sidebar Details Panel */}
      <aside className="w-[320px] bg-white border-l border-brand-border flex flex-col max-h-screen overflow-y-auto shrink-0 select-none pb-6">
        
        {/* Landscape Image at the top */}
        <div className="w-full h-36 relative overflow-hidden bg-brand-primary/10 shrink-0">
          <img
            src="/coffee_farm.png"
            alt="Coffee Farm scenery"
            className="w-full h-full object-cover"
          />
          {/* Subtle overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-white/30 to-transparent"></div>
        </div>

        {/* Detailed Info Card */}
        {detailNode && (
          <div className="p-5 flex flex-col gap-6 text-left">
            
            {/* Header info */}
            <div className="flex justify-between items-start gap-1">
              <div>
                <h3 className="text-md font-black text-brand-text leading-tight">
                  {getCountryJp(detailNode.country)} {detailNode.varieties[0] || ""}
                </h3>
                <span className="text-xs text-brand-text/50 font-semibold leading-normal mt-1 block">
                  {getMethodJp(detailNode.method)}
                </span>
              </div>
              <button
                onClick={() => handleToggleLike(detailNode.id)}
                className={`btn btn-ghost btn-circle btn-sm hover:bg-black/5 ${
                  likedIds.includes(detailNode.id) ? "text-error" : "text-brand-text/25"
                }`}
              >
                <span className="text-base">❤️</span>
              </button>
            </div>

            {/* Drank / Selection status badge button */}
            <button
              onClick={() => handleToggleSelect(detailNode.id)}
              className={`btn btn-block btn-sm rounded-2xl font-extrabold text-[11px] h-9 min-h-0 flex items-center justify-center gap-1.5 shadow-sm transition-all border ${
                selectedIds.includes(detailNode.id)
                  ? "bg-brand-primary-light border-brand-primary/30 text-brand-primary hover:bg-brand-primary-light"
                  : "bg-white border-brand-border text-brand-text/70 hover:bg-brand-beige"
              }`}
            >
              <span>{selectedIds.includes(detailNode.id) ? "★" : "☆"}</span>
              <span>{selectedIds.includes(detailNode.id) ? "あなたが飲んだ豆" : "飲んだ豆に追加する"}</span>
            </button>

            {/* Progress taste scores */}
            <div className="flex flex-col gap-3">
              <h4 className="text-[11px] font-black text-brand-text/50 uppercase tracking-wider">
                味わいの特徴
              </h4>
              <div className="flex flex-col gap-2.5">
                {[
                  {
                    label: "酸味",
                    score: detailNode.taste.Acidity,
                    colorClass: "bg-[#FF7A9E]" // Pink
                  },
                  {
                    label: "甘み",
                    score: detailNode.taste.Balance, // Using Balance as Sweetness proxy
                    colorClass: "bg-[#FFA55A]" // Orange
                  },
                  {
                    label: "苦味",
                    // Custom proxy representing bitterness (higher body & balance, lower acidity)
                    score: Math.min(10.0, Math.max(0, detailNode.taste.Body * 0.8 + (10 - detailNode.taste.Acidity) * 0.2)),
                    colorClass: "bg-[#8C6239]" // Brown
                  },
                  {
                    label: "コク",
                    score: detailNode.taste.Body,
                    colorClass: "bg-[#80B86F]" // Green
                  },
                  {
                    label: "香り",
                    score: detailNode.taste.Aroma,
                    colorClass: "bg-[#AB86FA]" // Purple
                  }
                ].map((bar) => (
                  <div key={bar.label} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[11px] font-bold">
                      <span className="text-brand-text/80">{bar.label}</span>
                      <span className="text-brand-text/90">{bar.score.toFixed(1)}</span>
                    </div>
                    {/* Background track */}
                    <div className="w-full h-1.5 bg-brand-beige rounded-full overflow-hidden">
                      <div
                        className={`h-full ${bar.colorClass} rounded-full transition-all duration-500`}
                        style={{ width: `${bar.score * 10}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Basic Metadata Info */}
            <div className="flex flex-col gap-3">
              <h4 className="text-[11px] font-black text-brand-text/50 uppercase tracking-wider">
                基本情報
              </h4>
              <div className="grid grid-cols-1 gap-2 text-xs border border-brand-border/60 p-3.5 rounded-2xl bg-brand-beige/30">
                <div className="flex justify-between border-b border-brand-border/30 pb-1.5">
                  <span className="text-brand-text/50 font-medium">産地</span>
                  <span className="font-bold text-brand-text/80">{getCountryJp(detailNode.country)}</span>
                </div>
                <div className="flex justify-between border-b border-brand-border/30 pb-1.5">
                  <span className="text-brand-text/50 font-medium">精製方法</span>
                  <span className="font-bold text-brand-text/80">{getMethodJp(detailNode.method)}</span>
                </div>
                <div className="flex justify-between border-b border-brand-border/30 pb-1.5">
                  <span className="text-brand-text/50 font-medium">標高</span>
                  <span className="font-bold text-brand-text/80">{detailNode.altitude}</span>
                </div>
                <div className="flex justify-between pt-0.5">
                  <span className="text-brand-text/50 font-medium">品種</span>
                  <span className="font-bold text-brand-text/80 text-right max-w-[150px] truncate" title={detailNode.varieties.join(", ") || "在来種"}>
                    {detailNode.varieties.join(", ") || "在来種"}
                  </span>
                </div>
              </div>
            </div>

            {/* Neighbors ("近くにある豆") */}
            <div className="flex flex-col gap-3">
              <h4 className="text-[11px] font-black text-brand-text/50 uppercase tracking-wider">
                この豆の近くにある豆
              </h4>
              <div className="flex flex-col gap-2">
                {nearestNeighbors.map((nb) => {
                  const nbVar = nb.varieties[0] || "在来種";
                  return (
                    <div
                      key={nb.id}
                      className="flex items-center gap-3 p-2 border border-brand-border/40 hover:border-brand-primary/30 rounded-2xl cursor-pointer hover:bg-brand-beige/20 transition-all"
                      onClick={() => handleNodeClick(nb)}
                    >
                      {/* Round placeholder coffee icon */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[14px]"
                        style={{ backgroundColor: nb.color + "15", color: nb.color }}
                      >
                        ☕
                      </div>
                      <div className="flex flex-col text-left min-w-0 flex-1">
                        <span className="font-bold text-xs text-brand-text truncate leading-tight">
                          {getCountryJp(nb.country)} {nbVar}
                        </span>
                        <span className="text-[9px] text-brand-text/45 font-medium mt-0.5">
                          {getMethodJp(nb.method)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action button at the bottom */}
            <button className="btn btn-block bg-white border border-brand-border hover:bg-brand-primary-light hover:border-brand-primary text-brand-text/80 hover:text-brand-primary font-bold text-xs py-2.5 h-auto min-h-0 rounded-2xl shadow-sm mt-1 flex items-center justify-center gap-2">
              📋 比較リストに追加
            </button>

          </div>
        )}
      </aside>
    </div>
  );
}

export default App;
