const MAX_COFFEES = 80;

export function buildCoffeeBranch(flavorNode, indexes, expandedCountry) {
  if (!flavorNode || flavorNode.children.length > 0) return null;
  const countries = new Map();
  for (const id of flavorNode.coffeeIds) {
    const coffee = indexes.coffeeById.get(id);
    if (!coffee) continue;
    const country = coffee.origin_country || "Unknown";
    if (!countries.has(country)) countries.set(country, []);
    countries.get(country).push(coffee);
  }

  return {
    ...flavorNode,
    nodeType: "flavor",
    children: [...countries.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([country, coffees]) => ({
        id: `country:${country}`,
        name: country,
        path: flavorNode.path,
        nodeType: "country",
        coffeeCount: coffees.length,
        children:
          expandedCountry === country
            ? coffees.slice(0, MAX_COFFEES).map((coffee) => ({
                id: `coffee:${coffee.id}`,
                name: coffee.title,
                nodeType: "coffee",
                coffee,
                children: [],
              }))
            : [],
      })),
  };
}

export function CoffeeLimitNote({ count }) {
  if (count <= MAX_COFFEES) return null;
  return (
    <p className="text-xs text-base-content/55">
      描画負荷を抑えるため先頭 {MAX_COFFEES} 件を表示しています（全 {count}{" "}
      件）。
    </p>
  );
}
