import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Local-only endpoint: never copy the paid CSV into public/ or the build.
const csvPath = fileURLToPath(
  new URL(
    "./data/private/roasterdb/2026.10/roasterdb_export.csv",
    import.meta.url,
  ),
);
function privateFlavorData() {
  const attach = (server) => {
    server.middlewares.use("/api/flavor-data.csv", async (req, res) => {
      try {
        await stat(csvPath);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        const stream = createReadStream(csvPath);
        stream.on("error", () => res.destroy());
        stream.pipe(res);
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
