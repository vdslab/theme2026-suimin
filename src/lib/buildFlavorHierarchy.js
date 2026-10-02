export function buildFlavorHierarchy(coffees, flavorToCoffeeIds) {
  const root = {
    id: "root",
    name: "All flavors",
    path: "",
    depth: 0,
    coffeeIds: new Set(coffees.map((coffee) => coffee.id)),
    coffeeCount: coffees.length,
    children: [],
  };
  const nodesByPath = new Map([["", root]]);

  for (const coffee of coffees) {
    for (const parts of coffee.flavorParts) {
      let parent = root;
      for (let index = 0; index < parts.length; index += 1) {
        const path = parts.slice(0, index + 1).join("/");
        let node = nodesByPath.get(path);
        if (!node) {
          node = {
            id: path,
            name: parts[index],
            path,
            depth: index + 1,
            coffeeIds: flavorToCoffeeIds.get(path) ?? new Set(),
            coffeeCount: flavorToCoffeeIds.get(path)?.size ?? 0,
            children: [],
          };
          nodesByPath.set(path, node);
          parent.children.push(node);
        }
        parent = node;
      }
    }
  }

  const sort = (node) => {
    node.children.sort(
      (a, b) => b.coffeeCount - a.coffeeCount || a.name.localeCompare(b.name),
    );
    node.children.forEach(sort);
  };
  sort(root);
  return { root, nodesByPath };
}
