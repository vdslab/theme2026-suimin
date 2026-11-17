import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Dev-server-only endpoint for seller descriptions (tasting_notes_raw).
// They are the roasters' own product copy, so they stay out of the public
// build (src/data/flavor_beans.json); `npm run dev` overlays them locally.
const jsonPath = fileURLToPath(
  new URL(
    "./data/private/roasterdb/2026.10/roasterdb_export.json",
    import.meta.url,
  ),
);
function privateFlavorDescriptions() {
  return {
    name: "local-private-flavor-descriptions",
    configureServer(server) {
      server.middlewares.use(
        "/api/flavor-descriptions.json",
        async (_req, res) => {
          try {
            const products = JSON.parse(await readFile(jsonPath, "utf8"));
            // Same key as aggregateFlavorRows: roaster \u00D7 product_id.
            const descriptions = Object.fromEntries(
              products
                .filter(
                  (row) => row.product_id && row.tasting_notes_raw?.trim(),
                )
                .map((row) => [
                  JSON.stringify([row.source_roaster, row.product_id]),
                  row.tasting_notes_raw,
                ]),
            );
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify(descriptions));
          } catch {
            res.statusCode = 404;
            res.end("{}");
          }
        },
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), privateFlavorDescriptions()],
});
