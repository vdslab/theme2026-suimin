import { useState } from "react";
import { coffeeData } from "../lib/coffeeData";

export function useRecommendation(drankCoffees, setSelectedCoffee) {
  const [recommendedCoffee, setRecommendedCoffee] = useState(null);

  const recommend = () => {
    const drankIds = Object.keys(drankCoffees);
    if (drankIds.length === 0) {
      alert("まずは豆を選んで「飲んだ」と入力してください。");
      return;
    }

    // 1. Initial position = average of drank coffees
    let sumX = 0,
      sumY = 0;
    const drankNodes = coffeeData.filter(
      (d) => drankCoffees[d.id] !== undefined,
    );
    drankNodes.forEach((d) => {
      sumX += d.x;
      sumY += d.y;
    });
    const initX = sumX / drankNodes.length;
    const initY = sumY / drankNodes.length;

    // 2. Apply spring forces
    let deltaX = 0,
      deltaY = 0;
    let totalWeightMag = 0;
    drankNodes.forEach((d) => {
      const score = drankCoffees[d.id];
      const weight = score - 3; // 1->-2, 5->+2
      deltaX += weight * (d.x - initX);
      deltaY += weight * (d.y - initY);
      totalWeightMag += Math.abs(weight);
    });

    const multiplier = 1.2;
    const shiftX =
      totalWeightMag === 0 ? 0 : (deltaX / totalWeightMag) * multiplier;
    const shiftY =
      totalWeightMag === 0 ? 0 : (deltaY / totalWeightMag) * multiplier;

    const finalX = initX + shiftX;
    const finalY = initY + shiftY;

    // 3. Find closest node (excluding drank ones)
    let closestNode = null;
    let minDistance = Infinity;

    coffeeData.forEach((d) => {
      if (drankCoffees[d.id] !== undefined) return; // skip drank coffees
      const dist = Math.sqrt((d.x - finalX) ** 2 + (d.y - finalY) ** 2);
      if (dist < minDistance) {
        minDistance = dist;
        closestNode = d;
      }
    });

    if (closestNode) {
      setRecommendedCoffee(closestNode);
      setSelectedCoffee(closestNode); // Select it to show details
    } else {
      alert("すべての豆を飲み尽くしました！");
    }
  };

  return { recommendedCoffee, setRecommendedCoffee, recommend };
}
