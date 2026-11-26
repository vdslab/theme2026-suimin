import { forceCollide, forceSimulation, forceX, forceY } from "d3-force";
import { geoCentroid, geoNaturalEarth1, geoPath } from "d3-geo";
import { useMemo } from "react";
import { feature } from "topojson-client";
import worldTopoJson from "../data/world-50m.json";
import { translateCountry } from "../lib/countryNames";
import { formatBags } from "../lib/flavorStats";

const W = 460;
const H = 230;
const countries = feature(worldTopoJson, worldTopoJson.objects.countries);
const byName = new Map(countries.features.map((f) => [f.properties.name, f]));

// Bubbles on the producing countries: area = "bags out of 10". Countries are
// not filled, so large countries (Brazil) do not look more important. Nearby
// bubbles (Central America) are pushed apart and tied to their country.
export default function FlavorOriginMap({ rows, base }) {
  const layout = useMemo(() => {
    const present = rows.filter((r) => byName.has(r.level));
    const projection = geoNaturalEarth1().fitExtent(
      [
        [14, 14],
        [W - 14, H - 14],
      ],
      {
        type: "FeatureCollection",
        features: present.map((r) => byName.get(r.level)),
      },
    );
    const path = geoPath(projection);
    const maxP = Math.max(base, ...present.map((r) => r.p), 1e-9);
    const radius = (p) => 3 + Math.sqrt(p / maxP) * 16;
    const nodes = present.map((r) => {
      const [x, y] = projection(geoCentroid(byName.get(r.level)));
      return { ...r, ax: x, ay: y, x, y, r: radius(r.p) };
    });
    const sim = forceSimulation(nodes)
      .force("x", forceX((d) => d.ax).strength(0.4))
      .force("y", forceY((d) => d.ay).strength(0.4))
      .force(
        "collide",
        forceCollide((d) => d.r + 1.5),
      )
      .stop();
    for (let i = 0; i < 160; i++) sim.tick();
    // Name the countries clearly above the average (or the single highest).
    const ranked = [...nodes]
      .filter((n) => !n.uncertain)
      .sort((a, b) => b.p - a.p);
    const above = ranked.filter((n) => n.signal === "hi").slice(0, 4);
    const top = new Set(
      (above.length ? above : ranked.slice(0, 1)).map((n) => n.level),
    );
    return { path, nodes, top };
  }, [rows, base]);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="flavor-origin-map"
      role="img"
      aria-label="産地ごとの10袋中何袋かを地図上の円の大きさで表した図"
    >
      <g className="land">
        {countries.features.map((f, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: some features share a name
          <path key={i} d={layout.path(f)} />
        ))}
      </g>
      {layout.nodes
        .slice()
        .sort((a, b) => b.r - a.r)
        .map((n) => {
          const color =
            n.signal === "hi"
              ? "#A8452A"
              : n.signal === "lo"
                ? "#3F7A80"
                : "#a39280";
          return (
            <g key={n.level} opacity={n.uncertain ? 0.4 : 1}>
              <title>
                {`${translateCountry(n.level)}：10袋中${formatBags(n.p)}袋（${n.t}袋中${n.k}袋）${n.uncertain ? "。件数が少なく確かでない" : ""}`}
              </title>
              {Math.hypot(n.x - n.ax, n.y - n.ay) > n.r && (
                <line
                  x1={n.ax}
                  y1={n.ay}
                  x2={n.x}
                  y2={n.y}
                  stroke="#9a8066"
                  strokeWidth="0.8"
                />
              )}
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill={color}
                fillOpacity="0.8"
                stroke="#fffbf3"
                strokeWidth="1"
              />
            </g>
          );
        })}
      {layout.nodes
        .filter((n) => layout.top.has(n.level))
        .map((n) => (
          <text
            key={n.level}
            x={n.x + n.r + 3}
            y={n.y + 4}
            className="map-label"
          >
            {translateCountry(n.level)} {formatBags(n.p)}袋
          </text>
        ))}
    </svg>
  );
}
