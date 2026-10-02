import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { buildFlavorHierarchy } from "../lib/buildFlavorHierarchy";
import { buildFlavorIndexes } from "../lib/buildFlavorIndexes";
import { translateFlavor } from "../lib/flavorNames";
import { loadRoasterData } from "../lib/loadRoasterData";
import FlavorHierarchy from "./FlavorHierarchy";

export default function FlavorExplorer({ selectedCoffee, onSelectCoffee }) {
  const coffees = useMemo(() => loadRoasterData(), []);
  const indexes = useMemo(() => buildFlavorIndexes(coffees), [coffees]);
  const { root, nodesByPath } = useMemo(
    () => buildFlavorHierarchy(coffees, indexes.flavorToCoffeeIds),
    [coffees, indexes],
  );
  const [focusPath, setFocusPath] = useState("");
  const focusNode = nodesByPath.get(focusPath) ?? root;
  const crumbs = focusPath ? focusPath.split("/") : [];

  if (!focusNode) return <LoaderCircle className="animate-spin" />;
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
            onClick={() => setFocusPath("")}
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
                  onClick={() => setFocusPath(path)}
                >
                  {translateFlavor(crumb)}
                </button>
              </span>
            );
          })}
        </nav>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={!focusPath}
          onClick={() => setFocusPath(crumbs.slice(0, -1).join("/"))}
        >
          <ArrowLeft size={15} /> Back
        </button>
      </div>
      <FlavorHierarchy
        key={focusNode.path}
        focusNode={focusNode}
        indexes={indexes}
        selectedCoffee={selectedCoffee}
        onSelectFlavor={setFocusPath}
        onSelectCoffee={onSelectCoffee}
      />
      <p className="text-center text-xs text-base-content/50">
        円の大きさと数値は、その味以下に含まれるコーヒー豆数です。タグをクリックして絞り込めます。
      </p>
    </main>
  );
}
