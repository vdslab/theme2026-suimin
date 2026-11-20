// Writes the public subset of the paid RoasterDB snapshot used by the flavor explorer.
//
// License (data/private/roasterdb/<version>/COMMERCIAL_LICENSE.md): app features built on
// the data may be published, but the raw dataset (or a substantial, trivially transformed
// portion) may not, and source_url must be kept. So this keeps only the fields the app
// displays, for products that carry flavor tags. Seller descriptions (tasting_notes_raw)
// are deliberately left out; `npm run dev` adds them locally from the private JSON.
//
// Usage: npm run export:flavor-data
import { readFile, writeFile } from "node:fs/promises";
import { csvParse } from "d3-dsv";
import { aggregateFlavorRows } from "../src/lib/flavorData.js";

const VERSION = "2026.11";
const source = new URL(
  `../data/private/roasterdb/${VERSION}/roasterdb_export.csv`,
  import.meta.url,
);
const output = new URL("../src/data/flavor_beans.json", import.meta.url);

const FIELDS = [
  "title",
  "source_roaster",
  "origin_country",
  "origin_region",
  "process_method",
  "roast_level",
  "varietals",
  "weight_grams",
  "altitude_min_meters",
  "altitude_max_meters",
  "price_currency",
  "price_value",
  "source_url",
];

const csv = await readFile(source, "utf8");
const { beans, totalRows, totalProducts } = aggregateFlavorRows(
  csvParse(csv.replace(/^﻿/, "")),
);

const publicBeans = beans
  .filter((bean) => bean.paths.length)
  .map((bean) => {
    const record = { id: bean.id };
    for (const field of FIELDS) {
      const value = bean[field]?.trim();
      if (value) record[field] = value;
    }
    record.paths = bean.paths;
    record.confidence = bean.confidence;
    return record;
  });

const missingSource = publicBeans.filter((b) => !b.source_url).length;
if (missingSource) throw new Error(`${missingSource} beans lack source_url`);

// One bean per line keeps git diffs readable when the snapshot is updated.
const json = `{"datasetVersion":${JSON.stringify(VERSION)},"totalRows":${totalRows},"totalProducts":${totalProducts},"beans":[\n${publicBeans
  .map((bean) => JSON.stringify(bean))
  .join(",\n")}\n]}\n`;
await writeFile(output, json);
console.log(
  `wrote ${publicBeans.length} beans (${(json.length / 1024).toFixed(0)} KB) to src/data/flavor_beans.json`,
);
