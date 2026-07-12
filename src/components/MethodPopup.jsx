import { clusterColor, shortName } from "../lib/clusters";
export default function MethodPopup({
  popupInfo,
  setPopupInfo,
  nodes,
  selectedCoffee,
  onSelectCoffee,
  sliderValues,
  handleSliderChange,
  drankCoffees,
  onRemoveDrank,
  onUpdateDrank,
}) {
  if (!popupInfo || !nodes) return null;

  // ラジオボタン等で選択中のノードが、このポップアップの国（nodes）に含まれているか確認
  const isSelectedValid =
    selectedCoffee && nodes.some((n) => n.id === selectedCoffee.id);
  const score = isSelectedValid
    ? (sliderValues[selectedCoffee.id] ?? drankCoffees[selectedCoffee.id] ?? 3)
    : 3;

  const closePopup = () => {
    setPopupInfo(null);
    onSelectCoffee(null);
  };

  const handleDragStart = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = popupInfo.x;
    const startTop = popupInfo.y;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      setPopupInfo((prev) => ({
        ...prev,
        x: startLeft + deltaX,
        y: startTop + deltaY,
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Absorbs click events to prevent bubbling to the map
    <div
      role="presentation"
      className="absolute z-[60] flex gap-3 items-start animate-in fade-in zoom-in-95 pointer-events-auto"
      style={{ left: popupInfo.x, top: popupInfo.y }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* ウィンドウ1: 好み度入力（左側） */}
      <div className="bg-base-100 rounded-xl shadow-2xl border border-base-300 p-4 w-[280px] flex flex-col relative h-max">
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-circle absolute top-2 right-2"
          onClick={closePopup}
        >
          ✕
        </button>
        <h3
          className="font-bold text-lg leading-tight pr-6 mb-1 text-base-content/80 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleDragStart}
        >
          {popupInfo.regionName}
        </h3>
        {isSelectedValid ? (
          <>
            <div className="font-bold text-lg text-primary mb-5">
              - {selectedCoffee.method}
            </div>

            <p className="text-xs font-semibold text-base-content/60 mb-2">
              好み度を入力：
            </p>
            <div className="flex flex-col gap-1 mb-2">
              <div className="flex justify-between text-[10px] px-1 text-base-content/60 font-medium">
                <span>苦手</span>
                <span>普通</span>
                <span>好み</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={score}
                onChange={(e) =>
                  handleSliderChange(selectedCoffee.id, Number(e.target.value))
                }
                className="range range-sm range-primary"
                step="1"
              />
            </div>

            {drankCoffees[selectedCoffee.id] !== undefined ? (
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline btn-error flex-1"
                  onClick={() => {
                    onRemoveDrank(selectedCoffee.id);
                    closePopup();
                  }}
                >
                  解除
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary flex-1"
                  onClick={() => {
                    onUpdateDrank(selectedCoffee.id, score);
                    closePopup();
                  }}
                >
                  更新
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-sm btn-primary w-full mt-3"
                onClick={() => {
                  onUpdateDrank(selectedCoffee.id, score);
                  closePopup();
                }}
              >
                飲んだ！
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-base-content/60 mt-2">
            右側から精製方法を選択してください。
          </p>
        )}
      </div>

      {/* ウィンドウ2: 精製方法ラジオボタン（右側） */}
      <div className="bg-base-100 rounded-xl shadow-2xl border border-base-300 p-4 w-[240px] flex flex-col">
        <h3
          className="font-bold mb-3 text-sm text-base-content/70 border-b border-base-200 pb-2 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleDragStart}
        >
          精製方法を選択
        </h3>
        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
          {nodes.map((node) => {
            const isSelected = selectedCoffee?.id === node.id;
            return (
              <label
                key={node.id}
                className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${isSelected ? "bg-primary/10 border-primary" : "border-base-200 hover:bg-base-200"}`}
              >
                <input
                  type="radio"
                  name={`method-${popupInfo.geoName}`}
                  className="radio radio-primary radio-sm"
                  checked={isSelected}
                  onChange={() => onSelectCoffee(node)}
                />
                <div className="flex flex-col">
                  <span className="font-semibold text-sm leading-tight">
                    {node.method}
                  </span>
                  <div className="text-[10px] text-base-content/60 flex items-center gap-1 mt-0.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: clusterColor(node.clusterName),
                      }}
                    />
                    <span className="truncate max-w-[120px]">
                      {shortName(node.clusterName)}
                    </span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
