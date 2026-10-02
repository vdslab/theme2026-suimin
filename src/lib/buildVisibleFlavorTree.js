import { buildCoffeeBranch } from "../components/CoffeeNodes";

export function buildVisibleFlavorTree({
  root,
  activeNode,
  expandedPaths,
  indexes,
  expandedCountry,
}) {
  const makeVisible = (node) => {
    if (node.children.length === 0 && node.path === activeNode.path) {
      return buildCoffeeBranch(node, indexes, expandedCountry) ?? node;
    }
    return {
      ...node,
      children:
        node.path === "" || expandedPaths.has(node.path)
          ? node.children.map(makeVisible)
          : [],
    };
  };
  return makeVisible(root);
}
