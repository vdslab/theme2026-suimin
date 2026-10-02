export function buildFlavorIndexes(coffees) {
  const coffeeById = new Map();
  const coffeeToFlavorPaths = new Map();
  const flavorToCoffeeIds = new Map();
  const countryToCoffeeIds = new Map();

  for (const coffee of coffees) {
    coffeeById.set(coffee.id, coffee);
    const paths = coffee.flavorParts.map((parts) => parts.join("/"));
    coffeeToFlavorPaths.set(coffee.id, paths);

    for (const parts of coffee.flavorParts) {
      for (let depth = 1; depth <= parts.length; depth += 1) {
        const path = parts.slice(0, depth).join("/");
        if (!flavorToCoffeeIds.has(path))
          flavorToCoffeeIds.set(path, new Set());
        flavorToCoffeeIds.get(path).add(coffee.id);
      }
    }

    const country = coffee.origin_country || "Unknown";
    if (!countryToCoffeeIds.has(country))
      countryToCoffeeIds.set(country, new Set());
    countryToCoffeeIds.get(country).add(coffee.id);
  }

  return {
    coffeeById,
    coffeeToFlavorPaths,
    flavorToCoffeeIds,
    countryToCoffeeIds,
  };
}
