import React from "react";

const TasteRadarChart = ({ taste, color = "rgb(99, 110, 250)", size = 220 }) => {
  const axes = ["Aroma", "Flavor", "Aftertaste", "Acidity", "Body", "Balance"];
  const center = size / 2;
  const maxRadius = (size / 2) * 0.75; // leave room for labels
  const levels = [2, 4, 6, 8, 10];

  const getCoordinates = (index, value) => {
    // 0 is Aroma (top), rotating clockwise
    const angle = (index * Math.PI) / 3 - Math.PI / 2;
    const radius = (value / 10) * maxRadius;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    return { x, y };
  };

  // Build grid lines (concentric polygons)
  const gridPolygons = levels.map((level) => {
    const points = axes.map((_, i) => {
      const { x, y } = getCoordinates(i, level);
      return `${x},${y}`;
    }).join(" ");
    return (
      <polygon
        key={level}
        points={points}
        fill="none"
        stroke="rgba(156, 163, 175, 0.2)"
        strokeWidth="1"
      />
    );
  });

  // Build axes lines
  const axesLines = axes.map((axis, i) => {
    const outer = getCoordinates(i, 10);
    return (
      <line
        key={axis}
        x1={center}
        y1={center}
        x2={outer.x}
        y2={outer.y}
        stroke="rgba(156, 163, 175, 0.25)"
        strokeWidth="1"
      />
    );
  });

  // Axis labels placement
  const labels = axes.map((axis, i) => {
    const angle = (i * Math.PI) / 3 - Math.PI / 2;
    // Push labels a bit further than maxRadius
    const labelRadius = maxRadius + 18;
    const x = center + labelRadius * Math.cos(angle);
    const y = center + labelRadius * Math.sin(angle);
    
    // Adjust text alignment based on position
    let textAnchor = "middle";
    let dy = "0.35em";
    if (Math.cos(angle) > 0.1) textAnchor = "start";
    else if (Math.cos(angle) < -0.1) textAnchor = "end";
    
    if (Math.sin(angle) > 0.5) dy = "0.8em";
    else if (Math.sin(angle) < -0.5) dy = "-0.2em";

    // Japanese labels translation
    const jpNames = {
      Aroma: "香り (Aroma)",
      Flavor: "風味 (Flavor)",
      Aftertaste: "後味 (Aftertaste)",
      Acidity: "酸味 (Acidity)",
      Body: "コク (Body)",
      Balance: "バランス (Balance)"
    };

    return (
      <text
        key={axis}
        x={x}
        y={y}
        textAnchor={textAnchor}
        dy={dy}
        className="text-[10px] font-medium fill-base-content/80 select-none"
      >
        {jpNames[axis]}
      </text>
    );
  });

  // User flavor profile polygon
  const scorePoints = taste
    ? axes.map((axis, i) => {
        const score = taste[axis] || 0;
        const { x, y } = getCoordinates(i, score);
        return `${x},${y}`;
      }).join(" ")
    : "";

  return (
    <div className="flex flex-col items-center justify-center p-2">
      <svg width={size} height={size} className="overflow-visible">
        {/* Background Grids */}
        {gridPolygons}
        {axesLines}
        
        {/* Level labels (only on the vertical aroma axis) */}
        {levels.map((level) => {
          const { x, y } = getCoordinates(0, level);
          return (
            <text
              key={level}
              x={x + 4}
              y={y + 3}
              className="text-[8px] fill-base-content/40 select-none font-semibold"
            >
              {level}
            </text>
          );
        })}

        {/* Value polygon */}
        {taste && (
          <polygon
            points={scorePoints}
            fill={color.replace("rgb", "rgba").replace(")", ", 0.25)")}
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        )}

        {/* Data point dots */}
        {taste &&
          axes.map((axis, i) => {
            const score = taste[axis] || 0;
            const { x, y } = getCoordinates(i, score);
            return (
              <circle
                key={axis}
                cx={x}
                cy={y}
                r="3.5"
                fill={color}
                stroke="white"
                strokeWidth="1.5"
                className="transition-all duration-300"
              />
            );
          })}

        {/* Axis labels */}
        {labels}
      </svg>
    </div>
  );
};

export default TasteRadarChart;
