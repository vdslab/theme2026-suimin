import csvText from "../../data/roasterdb_sample.csv?raw";

// Small RFC-4180 parser. Keeping it here avoids reparsing data during interactions.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const [headers, ...records] = rows;
  return records.map((record) =>
    Object.fromEntries(
      headers.map((header, index) => [header, record[index] ?? ""]),
    ),
  );
}

export function parseFlavorPaths(value) {
  return value
    .split(";")
    .map((note) =>
      note
        .split(">")
        .map((part) => part.trim())
        .filter(Boolean),
    )
    .filter((parts) => parts.length > 0);
}

export function loadRoasterData() {
  return parseCsv(csvText).map((row) => ({
    ...row,
    id: String(row.product_id),
    _kind: "roaster",
    price_value: row.price_value ? Number(row.price_value) : null,
    tasting_notes_confidence: row.tasting_notes_confidence
      ? Number(row.tasting_notes_confidence)
      : null,
    flavorParts: parseFlavorPaths(row.tasting_notes_sca_nodes),
  }));
}
