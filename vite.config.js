import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { csvFormat, csvParse } from "d3-dsv";

// Local-only endpoint: never copy the paid CSV into public/ or the build.
const csvPath = fileURLToPath(
  new URL(
    "./data/private/roasterdb/2026.10/roasterdb_export.csv",
    import.meta.url,
  ),
);
const jsonPath = fileURLToPath(
  new URL(
    "./data/private/roasterdb/2026.10/roasterdb_export.json",
    import.meta.url,
  ),
);
function privateFlavorData() {
  const attach = (server) => {
    server.middlewares.use("/api/flavor-data.csv", async (req, res) => {
      try {
        const csv = await readFile(csvPath, "utf8");
        const rows = csvParse(csv.replace(/^\uFEFF/, ""));
        // The CSV export omits seller descriptions; use the original JSON text.
        if (!rows.columns.includes("tasting_notes_raw")) {
          try {
            const products = JSON.parse(await readFile(jsonPath, "utf8"));
            const key = (row) =>
              JSON.stringify([row.source_roaster, row.product_id]);
            const descriptions = new Map(
              products
                .filter(
                  (row) => row.product_id && row.tasting_notes_raw?.trim(),
                )
                .map((row) => [key(row), row.tasting_notes_raw]),
            );
            for (const row of rows)
              row.tasting_notes_raw = descriptions.get(key(row)) || "";
            rows.columns.push("tasting_notes_raw");
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
        }
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(csvFormat(rows, rows.columns));
      } catch {
        res.statusCode = 404;
        res.end("Local RoasterDB CSV is missing.");
      }
    });
  };
  return {
    name: "local-private-flavor-data",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), privateFlavorData()],
});
