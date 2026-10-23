import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { FLAVOR_JA } from '../src/lib/flavorJapanese.js';
import { buildFlavorData, buildFlavorNetwork, MAX_BEANS, MAX_FLAVORS } from '../src/lib/flavorData.js';

const data = buildFlavorData(readFileSync(new URL('../data/private/roasterdb/2026.10/roasterdb_export.csv', import.meta.url), 'utf8'));
assert.ok(data.initialId, 'CSV must have tagged beans');
for (const node of data.nodes.values()) {
  if (node.path.length) assert.ok(FLAVOR_JA[node.name], `日本語訳がありません: ${node.name}`);
  const network = buildFlavorNetwork(data, node.id);
  assert.equal(network.matchedCount, node.beanIds.size);
  assert.ok(network.beans.length <= MAX_BEANS);
  assert.ok(network.nodes.filter(n => n.type === 'flavor').length <= MAX_FLAVORS);
  assert.equal(network.links.filter(l => l.target === 'selected').length, network.beans.length);
  const ids = new Set(network.nodes.map(n => n.id));
  assert.ok(network.links.every(l => ids.has(l.source) && ids.has(l.target)));
}
const initial = buildFlavorNetwork(data, data.initialId);
console.log(JSON.stringify({ rows: data.totalRows, products: data.totalProducts, taggedBeans: data.beans.length, hierarchyNodes: data.nodes.size - 1, initialPath: initial.selected.path, initialMatches: initial.matchedCount, checkedSelections: data.nodes.size }, null, 2));
