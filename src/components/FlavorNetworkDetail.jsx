import {
  flavorName,
  flavorPath,
  processName,
  roastName,
} from "../lib/flavorJapanese";
import { translateCountry } from "../lib/countryNames";
import { useEffect, useRef, useState } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
} from "d3-force";
import { select } from "d3-selection";
import { zoom } from "d3-zoom";
import { drag } from "d3-drag";
import { pathId } from "../lib/flavorData";

const beanInfo = (b) =>
  `${b.title}\n焙煎所：${b.source_roaster || "不明"}\n生産国：${translateCountry(b.origin_country) || "不明"}\n精製方法：${processName(b.process_method)}\n焙煎度：${roastName(b.roast_level)}\n味タグの信頼度：${b.tasting_notes_confidence || "不明"}`;
export default function FlavorNetworkDetail({ network, color, onSelect }) {
  const svgRef = useRef(null);
  const [inspected, setInspected] = useState(null);
  useEffect(() => {
    setInspected(null);
    const svg = select(svgRef.current);
    svg.selectAll("*").remove();
    const group = svg.append("g");
    const nodes = network.nodes.map((n, i) => ({
      ...n,
      x: 350 + Math.cos(i * 2.4) * 170,
      y: 270 + Math.sin(i * 2.4) * 170,
    }));
    nodes[0].fx = 350;
    nodes[0].fy = 270;
    const links = network.links.map((l) => ({ ...l }));
    const simulation = forceSimulation(nodes)
      .force(
        "link",
        forceLink(links)
          .id((n) => n.id)
          .distance((l) => (l.target.type === "center" ? 145 : 85))
          .strength(0.35),
      )
      .force("charge", forceManyBody().strength(-240))
      .force(
        "collide",
        forceCollide((n) =>
          n.type === "center" ? 66 : n.type === "flavor" ? 48 : 19,
        ),
      )
      .force("x", forceX(350).strength(0.07))
      .force("y", forceY(270).strength(0.1));
    const edges = group
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#94704d")
      .attr("stroke-opacity", 0.26)
      .attr("stroke-width", 1.2);
    const items = group
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (n) =>
        n.type === "bean"
          ? beanInfo(n.bean)
          : `${flavorName(n.flavor.name)}: ${n.count}件`,
      )
      .on("click", (_, n) => setInspected(n))
      .on("focus", (_, n) => setInspected(n))
      .on("keydown", (event, n) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setInspected(n);
        }
      });
    items
      .append("circle")
      .attr("r", (n) =>
        n.type === "center"
          ? 49
          : n.type === "flavor"
            ? 24 + Math.min(10, Math.sqrt(n.count))
            : 9,
      )
      .attr("fill", (n) =>
        n.type === "bean" ? "#c8a477" : color(n.flavor.path),
      )
      .attr("stroke", (n) => (n.type === "center" ? "#6f4e37" : "#fffbf3"))
      .attr("stroke-width", 2);
    items
      .append("title")
      .text((n) =>
        n.type === "bean"
          ? beanInfo(n.bean)
          : `${flavorPath(n.flavor.path)}\n選択味と一緒に出た件数: ${n.count}`,
      );
    items
      .append("text")
      .attr("text-anchor", "middle")
      .attr("y", (n) => (n.type === "bean" ? 23 : 4))
      .attr("fill", (n) => (n.type === "bean" ? "#624833" : "#3e2c20"))
      .attr("font-size", (n) => (n.type === "bean" ? 9 : 11))
      .attr("pointer-events", "none")
      .text((n) =>
        (n.type === "bean" ? n.bean.title : flavorName(n.flavor.name)).slice(
          0,
          19,
        ),
      );
    items.call(
      drag()
        .on("start", (event, n) => {
          if (!event.active) simulation.alphaTarget(0.25).restart();
          n.fx = n.x;
          n.fy = n.y;
        })
        .on("drag", (event, n) => {
          if (n.type !== "center") {
            n.fx = event.x;
            n.fy = event.y;
          }
        })
        .on("end", (event, n) => {
          if (!event.active) simulation.alphaTarget(0);
          if (n.type !== "center") {
            n.fx = null;
            n.fy = null;
          }
        }),
    );
    simulation.on("tick", () => {
      edges
        .attr("x1", (l) => l.source.x)
        .attr("y1", (l) => l.source.y)
        .attr("x2", (l) => l.target.x)
        .attr("y2", (l) => l.target.y);
      items.attr("transform", (n) => `translate(${n.x},${n.y})`);
    });
    const zoomBehavior = zoom()
      .scaleExtent([0.35, 4])
      .on("zoom", (e) => group.attr("transform", e.transform));
    svg.call(zoomBehavior).on("dblclick.zoom", null);
    return () => {
      simulation.stop();
      svg.on(".zoom", null);
    };
  }, [network, color]);
  const source = inspected?.bean?.source_url;
  const safeSource = source && /^https?:\/\//i.test(source) ? source : null;
  return (
    <>
      <svg
        ref={svgRef}
        className="flavor-network"
        viewBox="0 0 700 540"
        aria-label="豆と味のネットワーク。ドラッグで移動、ホイールで拡大縮小"
      />
      <div className="flavor-inspector" aria-live="polite">
        {inspected ? (
          inspected.type === "bean" ? (
            <>
              <strong>{inspected.bean.title}</strong>
              <p className="flavor-metadata">
                {beanInfo(inspected.bean).split("\n").slice(1).join("\n")}
              </p>
              <div className="flavor-bean-tags">
                <p>この豆の味タグ（{inspected.bean.paths.length}個）</p>
                <ul aria-label="この豆が持つすべての味タグ">
                  {inspected.bean.paths.map((path) => (
                    <li key={pathId(path)}>
                      <button
                        type="button"
                        onClick={() => onSelect(pathId(path))}
                        title="この味を中心に探索"
                        style={{ borderColor: color(path) }}
                      >
                        {flavorPath(path)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {safeSource && (
                <a href={safeSource} target="_blank" rel="noreferrer">
                  出典の商品ページ ↗
                </a>
              )}
            </>
          ) : (
            <>
              <strong>{flavorPath(inspected.flavor.path)}</strong>
              <p>選択味と一緒に出た件数：{inspected.count}</p>
              {inspected.type !== "center" && (
                <button
                  type="button"
                  onClick={() => onSelect(inspected.flavor.id)}
                >
                  この味を中心に探索 →
                </button>
              )}
            </>
          )
        ) : (
          <p>
            ノードに触れるとツールチップ、クリックするとここに詳細を表示します。
          </p>
        )}
      </div>
    </>
  );
}
