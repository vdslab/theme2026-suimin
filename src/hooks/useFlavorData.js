import { useEffect, useState } from "react";
import { buildFlavorIndex } from "../lib/flavorData";
import { beanAttributes } from "../lib/flavorStats";

// Loads the public flavor data (and, on the dev server only, seller
// descriptions) and builds the flavor hierarchy and per-bean attributes.
export function useFlavorData() {
  const [state, setState] = useState({ data: null, attributes: null });
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    // Seller descriptions are not in the public data; only the dev server has them.
    const descriptions = import.meta.env.DEV
      ? fetch(`${import.meta.env.BASE_URL}api/flavor-descriptions.json`)
          .then((response) => (response.ok ? response.json() : {}))
          .catch(() => ({}))
      : Promise.resolve({});
    Promise.all([import("../data/flavor_beans.json"), descriptions])
      .then(([{ default: published }, notes]) => {
        const beans = published.beans.map((bean) =>
          notes[bean.id]
            ? { ...bean, tasting_notes_raw: notes[bean.id] }
            : bean,
        );
        const data = buildFlavorIndex({ ...published, beans });
        if (!data.initialId) throw new Error("有効な味タグが見つかりません。");
        data.datasetVersion = published.datasetVersion;
        if (active) setState({ data, attributes: beanAttributes(data.beans) });
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return { ...state, error };
}
