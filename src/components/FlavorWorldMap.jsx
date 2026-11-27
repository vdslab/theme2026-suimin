import { forceCollide, forceSimulation, forceX, forceY } from "d3-force";
import { geoCentroid, geoMercator, geoPath } from "d3-geo";
import { useMemo, useState } from "react";
import { feature } from "topojson-client";
import worldTopoJson from "../data/world-50m.json";
import { translateCountry } from "../lib/countryNames";
import { formatBags } from "../lib/flavorStats";
import { BELT_COLOR, BELT_FILL_OPACITY, BELT_LAT } from "../lib/mapStyle";

const countries = feature(worldTopoJson, worldTopoJson.objects.countries);
const byName = new Map(countries.features.map((f) => [f.properties.name, f]));

export const SIGNAL_COLORS = { hi: "#A8452A", lo: "#3F7A80", none: "#a39280" };

// Full-screen world map in the style of the root map: one bubble per
// producing country, area = "bags out of 10" for the selected flavor.
// `inset` keeps the producing countries clear of the floating panels.
export default function FlavorWorldMap({ width, height, inset, rows, base }) {
  const [hovered, setHovered] = useState(null);
  const layout = useMemo(() => {
    const present = rows.filter((r) => byName.has(r.level));
    const projection = geoMercator().fitExtent(
      [
        [inset.left, inset.top],
        [width - inset.right, height - inset.bottom],
      ],
      {
        type: "FeatureCollection",
        features: present.map((r) => byName.get(r.level)),
      },
    );
    const path = geoPath(projection);
    const maxP = Math.max(base, ...present.map((r) => r.p), 1e-9);
    const scale = Math.min(width, height) / 900;
    const radius = (p) => (5 + Math.sqrt(p / maxP) * 34) * Math.max(scale, 0.6);
    const nodes = present.map((r) => {
      const [x, y] = projection(geoCentroid(byName.get(r.level)));
      return { ...r, ax: x, ay: y, x, y, r: radius(r.p) };
    });
    const sim = forceSimulation(nodes)
      .force("x", forceX((d) => d.ax).strength(0.4))
      .force("y", forceY((d) => d.ay).strength(0.4))
      .force(
        "collide",
        forceCollide((d) => d.r + 2),
      )
      .stop();
    for (let i = 0; i < 200; i++) sim.tick();
    const ranked = [...nodes]
      .filter((n) => !n.uncertain)
      .sort((a, b) => b.p - a.p);
    const above = ranked.filter((n) => n.signal === "hi").slice(0, 5);
    const labelled = new Set(
      (above.length ? above : ranked.slice(0, 1)).map((n) => n.level),
    );
    const beltTop = projection([0, BELT_LAT])[1];
    const beltBottom = projection([0, -BELT_LAT])[1];
    return { path, nodes, labelled, beltTop, beltBottom, present };
  }, [rows, base, width, height, inset]);
  const producing = new Set(layout.present.map((r) => r.level));
  return (
    <div className="absolute inset-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        className="absolute inset-0 select-none bg-[#e0f2fe]"
        role="img"
        aria-label="産地ごとに、選んだ味が10袋中何袋に書かれているかを円の大きさで表した世界地図"
      >
        <g>
          {countries.features.map((f, i) => (
            <path
              // biome-ignore lint/suspicious/noArrayIndexKey: some features share a name
              key={i}
              d={layout.path(f)}
              fill={producing.has(f.properties.name) ? "#fde9d0" : "#e2e8f0"}
              stroke="#f8fafc"
              strokeWidth={0.5}
            />
          ))}
        </g>
        <rect
          x={0}
          y={layout.beltTop}
          width={width}
          height={layout.beltBottom - layout.beltTop}
          fill={BELT_COLOR}
          opacity={BELT_FILL_OPACITY}
          pointerEvents="none"
        />
        {layout.nodes
          .slice()
          .sort((a, b) => b.r - a.r)
          .map((n) => (
            <g
              key={n.level}
              opacity={n.uncertain ? 0.4 : 1}
              onPointerEnter={() => setHovered(n)}
              onPointerLeave={() => setHovered(null)}
            >
              {Math.hypot(n.x - n.ax, n.y - n.ay) > n.r && (
                <line
                  x1={n.ax}
                  y1={n.ay}
                  x2={n.x}
                  y2={n.y}
                  stroke="#9a8066"
                  strokeWidth="1"
                />
              )}
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill={SIGNAL_COLORS[n.signal]}
                fillOpacity="0.82"
                stroke={hovered?.level === n.level ? "#2a211b" : "#fffbf3"}
                strokeWidth={hovered?.level === n.level ? 2 : 1.2}
              />
            </g>
          ))}
        {layout.nodes
          .filter((n) => layout.labelled.has(n.level))
          .map((n) => (
            <text
              key={n.level}
              x={n.x + n.r + 4}
              y={n.y + 4}
              className="flavor-world-label"
            >
              {translateCountry(n.level)} {formatBags(n.p)}袋
            </text>
          ))}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg bg-[#2a211b] px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: hovered.x + hovered.r + 8, top: hovered.y - 16 }}
        >
          <b>{translateCountry(hovered.level)}</b> 10袋中
          {formatBags(hovered.p)}袋（{hovered.t}袋中{hovered.k}袋）
          {hovered.uncertain ? "・件数が少なく確かでない" : ""}
        </div>
      )}
    </div>
  );
}
