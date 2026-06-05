import React, { useState, useRef, useEffect } from "react";

const PreferenceSelector = ({ nodes, selectedIds, onSelect, onDeselect, onClear }) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter nodes based on query, excluding already selected ones
  const filteredSuggestions = query.trim() === ""
    ? []
    : nodes.filter((node) => {
        const isAlreadySelected = selectedIds.includes(node.id);
        if (isAlreadySelected) return false;
        
        const labelLower = node.label.toLowerCase();
        const searchLower = query.toLowerCase();
        const countryLower = node.country.toLowerCase();
        const methodLower = node.method.toLowerCase();
        const varietiesJoined = node.varieties.join(" ").toLowerCase();

        return (
          labelLower.includes(searchLower) ||
          countryLower.includes(searchLower) ||
          methodLower.includes(searchLower) ||
          varietiesJoined.includes(searchLower)
        );
      }).slice(0, 10); // Limit to 10 suggestions

  const handleSelectSuggestion = (node) => {
    onSelect(node.id);
    setQuery("");
    setIsOpen(false);
  };

  // Get selected node objects
  const selectedNodes = nodes.filter((node) => selectedIds.includes(node.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="form-control w-full relative" ref={dropdownRef}>
        <label className="label py-1">
          <span className="label-text font-bold text-sm text-base-content/80">
            飲んだことのあるコーヒー豆を追加
          </span>
        </label>
        
        <div className="relative">
          <input
            type="text"
            placeholder="産地や精製方法、品種で検索..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="input input-bordered w-full pr-10 focus:outline-none focus:border-primary text-sm shadow-sm"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 btn btn-ghost btn-circle btn-xs text-base-content/40 hover:text-base-content"
            >
              ✕
            </button>
          )}
        </div>

        {/* Autocomplete Dropdown */}
        {isOpen && filteredSuggestions.length > 0 && (
          <ul className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto menu bg-base-100/95 backdrop-blur-md border border-base-200 rounded-box shadow-xl p-1 gap-0.5">
            {filteredSuggestions.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => handleSelectSuggestion(node)}
                  className="flex flex-col items-start gap-1 py-2 px-3 text-left hover:bg-primary hover:text-primary-content transition-all rounded-md"
                >
                  <span className="font-semibold text-xs leading-none">
                    {node.label}
                  </span>
                  <span className="text-[10px] opacity-70">
                    品種: {node.varieties.length > 0 ? node.varieties.join(", ") : "未指定"} | サンプル数: {node.sample_count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        
        {isOpen && query.trim() !== "" && filteredSuggestions.length === 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 p-3 text-center bg-base-100 border border-base-200 rounded-box shadow-lg text-xs text-base-content/50">
            一致するコーヒー豆が見つかりません
          </div>
        )}
      </div>

      {/* Selected Items List */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold text-base-content/70">
            選択中 ({selectedNodes.length})
          </span>
          {selectedNodes.length > 0 && (
            <button
              onClick={onClear}
              className="btn btn-ghost btn-xs text-[10px] text-error hover:bg-error/10 hover:text-error px-2 min-h-0 h-6"
            >
              すべてクリア
            </button>
          )}
        </div>

        {selectedNodes.length === 0 ? (
          <div className="border border-dashed border-base-300 rounded-xl p-6 text-center text-xs text-base-content/40 bg-base-200/30">
            飲んだことのある豆を検索して追加してください。
            <br />
            それらを元に、あなたの味覚に合った豆を推薦します！
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
            {selectedNodes.map((node) => (
              <div
                key={node.id}
                className="badge badge-lg gap-1 border border-primary/20 bg-primary/10 text-primary-content/90 hover:bg-primary/20 py-3 pr-1 text-xs select-none shadow-sm transition-all"
                style={{ color: node.color }}
              >
                <span className="font-semibold text-base-content mr-1">
                  {node.label}
                </span>
                <button
                  onClick={() => onDeselect(node.id)}
                  className="btn btn-ghost btn-circle btn-xs text-base-content/50 hover:bg-base-content/10 hover:text-base-content p-0 h-5 w-5 min-h-0"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PreferenceSelector;
