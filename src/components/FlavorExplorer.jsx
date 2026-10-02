import { ArrowLeft, CircleDot, LayoutGrid, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { buildFlavorHierarchy } from "../lib/buildFlavorHierarchy";
import { buildFlavorIndexes } from "../lib/buildFlavorIndexes";
import { translateFlavor } from "../lib/flavorNames";
import { loadRoasterData } from "../lib/loadRoasterData";
import FlavorHierarchy from "./FlavorHierarchy";
import FlavorTreemap from "./FlavorTreemap";

export default function FlavorExplorer({ selectedCoffee, onSelectCoffee }) {
  const coffees = useMemo(() => loadRoasterData(), []);
  const indexes = useMemo(() => buildFlavorIndexes(coffees), [coffees]);
  const { root, nodesByPath } = useMemo(
    () => buildFlavorHierarchy(coffees, indexes.flavorToCoffeeIds),
    [coffees, indexes],
  );
  const [activePath, setActivePath] = useState("");
  const [expandedPaths, setExpandedPaths] = useState(() => new Set([""]));
  const [layout, setLayout] = useState("treemap");
  const activeNode = nodesByPath.get(activePath) ?? root;
  const crumbs = activePath ? activePath.split("/") : [];

  const handleSelectFlavor = (path) => {
    setActivePath(path);
    setExpandedPaths((previous) => {
      const next = new Set(previous);
      next.add(path);
      return next;
    });
  };

  const handleBack = () => {
    if (!activePath) return;
    const parentPath = crumbs.slice(0, -1).join("/");
    setExpandedPaths((previous) => {
      const next = new Set(previous);
      next.delete(activePath);
      return next;
    });
    setActivePath(parentPath);
  };

  if (!activeNode) return <LoaderCircle className="animate-spin" />;
  return (
    <main className="flex h-full flex-col gap-3 bg-[#f7f0e6] p-3 pt-20 sm:p-6 sm:pt-24">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e5d6c3] bg-[#fffaf3] px-4 py-2 shadow-sm">
        <nav
          aria-label="現在の味階層"
          className="flex min-w-0 flex-wrap items-center gap-1 text-sm"
        >
          <button
            type="button"
            className="font-bold text-primary hover:underline"
            onClick={() => setActivePath("")}
          >
            すべて
          </button>
          {crumbs.map((crumb, index) => {
            const path = crumbs.slice(0, index + 1).join("/");
            return (
              <span key={path} className="flex items-center gap-1">
                <span className="text-base-content/35">›</span>
                <button
                  type="button"
                  className={
                    index === crumbs.length - 1
                      ? "font-bold"
                      : "hover:underline"
                  }
                  onClick={() => setActivePath(path)}
                >
                  {translateFlavor(crumb)}
                </button>
              </span>
            );
          })}
        </nav>
        <div className="flex items-center gap-1">
          <fieldset className="join border-0 p-0" aria-label="表示形式">
            <button
              type="button"
              className={`btn btn-sm join-item ${layout === "treemap" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setLayout("treemap")}
            >
              <LayoutGrid size={14} /> ツリーマップ
            </button>
            <button
              type="button"
              className={`btn btn-sm join-item ${layout === "radial" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setLayout("radial")}
            >
              <CircleDot size={14} /> 円形
            </button>
          </fieldset>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={!activePath}
            onClick={handleBack}
          >
            <ArrowLeft size={15} /> Back
          </button>
        </div>
      </div>
      {layout === "treemap" ? (
        <FlavorTreemap
          root={root}
          activeNode={activeNode}
          expandedPaths={expandedPaths}
          indexes={indexes}
          selectedCoffee={selectedCoffee}
          onSelectFlavor={handleSelectFlavor}
          onSelectCoffee={onSelectCoffee}
        />
      ) : (
        <FlavorHierarchy
          root={root}
          activeNode={activeNode}
          expandedPaths={expandedPaths}
          indexes={indexes}
          selectedCoffee={selectedCoffee}
          onSelectFlavor={handleSelectFlavor}
          onSelectCoffee={onSelectCoffee}
        />
      )}
      <p className="text-center text-xs text-base-content/50">
        タグをクリックすると、その位置を保ったまま次の味階層が追加表示されます。
      </p>
    </main>
  );
}
