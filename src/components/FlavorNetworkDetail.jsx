import {
  flavorName,
  flavorPath,
  formatConfidence,
  formatPrice,
  processName,
  roastName,
} from "../lib/flavorJapanese";
import { translateCountry } from "../lib/countryNames";
import { useEffect, useRef } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
} from "d3-force";
import { select } from "d3-selection";
import { zoom, zoomIdentity, zoomTransform } from "d3-zoom";
import { networkLayout, resizeNetworkNodes } from "../lib/networkLayout.js";
import { drag } from "d3-drag";

export const FORCE_SETTINGS = {
  selectedDistance: 105,
  relatedDistance: 75,
  selectedStrength: 0.7,
  relatedStrength: 0.16,
  charge: -95,
};

const beanInfo = (b) => {
  const price = formatPrice(b.price_value, b.price_currency);
  const country = translateCountry(b.origin_country) || "不明";
  const region = b.origin_region ? ` (${b.origin_region})` : "";
  const conf = formatConfidence(b.confidence);
  return `${b.paths.map(flavorPath).join(" / ")}\n${b.matchCount ?? ""} / ${b.selectedCount ?? ""}\n${b.title}\n値段：${price}\n生産国：${country}${region}\n焙煎所：${b.source_roaster || "不明"}\n精製方法：${processName(b.process_method)}\n焙煎度：${roastName(b.roast_level)}\n味タグの信頼度：${conf}`;
};

export default function FlavorNetworkDetail({
  network,
  color,
  onSelect,
  selectedBeanId,
  onSelectBean,
  hoveredBeanId,
  onHoverBean,
}) {
  const positionsRef = useRef(new Map());
  const svgRef = useRef(null);
  const groupRef = useRef(null);
  const viewportRef = useRef(null);

  const onSelectBeanRef = useRef(onSelectBean);
  onSelectBeanRef.current = onSelectBean;
  const onHoverBeanRef = useRef(onHoverBean);
  onHoverBeanRef.current = onHoverBean;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const svg = select(svgRef.current);
    const viewport = viewportRef.current;
    let layout = networkLayout(
      Math.max(1, viewport.clientWidth),
      Math.max(1, viewport.clientHeight),
    );
    svg.attr("viewBox", `0 0 ${layout.width} ${layout.height}`);
    svg.selectAll("*").remove();
    const group = svg.append("g");
    groupRef.current = group;

    const nodes = network.nodes.map((n, i) => ({
      ...n,
      x:
        positionsRef.current.get(n.id)?.x ??
        layout.cx + Math.cos(i * 2.4) * 170 * layout.unit,
      y:
        positionsRef.current.get(n.id)?.y ??
        layout.cy + Math.sin(i * 2.4) * 170 * layout.unit,
    }));
    const pinSelected = () => {
      const centers = nodes.filter((n) => n.type === "center");
      const offset = Math.min(layout.width * 0.19, layout.height * 0.23, 110);
      centers.forEach((n, i) => {
        n.fx =
          layout.cx +
          (centers.length === 1
            ? 0
            : centers.length === 2
              ? i === 0
                ? -offset
                : offset
              : Math.cos(-Math.PI / 2 + (i * Math.PI * 2) / 3) * offset);
        n.fy =
          layout.cy +
          (centers.length < 3
            ? 0
            : Math.sin(-Math.PI / 2 + (i * Math.PI * 2) / 3) * offset);
        n.x = n.fx;
        n.y = n.fy;
      });
    };
    pinSelected();
    const links = network.links.map((l) => ({ ...l }));

    // 100ノード規模でも重なりすぎず画面内に美しく収まるよう調整
    const simulation = forceSimulation(nodes)
      .force(
        "link",
        forceLink(links)
          .id((n) => n.id)
          .distance(
            (l) =>
              (l.selected
                ? FORCE_SETTINGS.selectedDistance
                : FORCE_SETTINGS.relatedDistance) * layout.unit,
          )
          .strength((l) =>
            l.selected
              ? FORCE_SETTINGS.selectedStrength
              : FORCE_SETTINGS.relatedStrength,
          ),
      )
      .force(
        "charge",
        forceManyBody().strength(FORCE_SETTINGS.charge * layout.unit),
      )
      .force(
        "collide",
        forceCollide((n) =>
          n.type === "center" ? 43 : n.type === "flavor" ? 37 : 12,
        ),
      )
      .force("x", forceX(layout.cx).strength(0.08))
      .force("y", forceY(layout.cy).strength(0.12));
    const edges = group
      .append("g")
      .attr("class", "network-edges")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#94704d")
      .attr("stroke-opacity", (l) => (l.selected ? 0.32 : 0.12))
      .attr("stroke-width", (l) => (l.selected ? 1.6 : 0.8));

    const highlight = (node) => {
      const connected = new Set(node ? [node.id] : []);
      if (node)
        for (const l of links) {
          if (l.source.id === node.id) connected.add(l.target.id);
          if (l.target.id === node.id) connected.add(l.source.id);
        }
      edges.attr("stroke-opacity", (l) =>
        node
          ? l.source.id === node.id || l.target.id === node.id
            ? 0.85
            : 0.035
          : l.selected
            ? 0.32
            : 0.12,
      );
      group
        .selectAll(".network-node")
        .attr("opacity", (n) => (!node || connected.has(n.id) ? 1 : 0.2));
    };
    const items = group
      .append("g")
      .attr("class", "network-nodes")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", (n) => `network-node node-${n.type}`)
      .attr("data-id", (n) => n.id)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (n) =>
        n.type === "bean"
          ? beanInfo(n.bean)
          : `${flavorName(n.flavor.name)}: ${n.count}件`,
      )
      .on("click", (_, n) => {
        if (n.type === "bean") {
          onSelectBeanRef.current?.(n.bean);
        } else {
          onSelectRef.current?.(n.flavor.id);
        }
      })
      .on("focus", (_, n) => {
        highlight(n);
      })
      .on("blur", () => highlight(null))
      .on("mouseenter", (_, n) => {
        highlight(n);
        if (n.type === "bean") {
          onHoverBeanRef.current?.(n.bean.id);
        }
      })
      .on("mouseleave", (_, n) => {
        highlight(null);
        if (n.type === "bean") {
          onHoverBeanRef.current?.(null);
        }
      })
      .on("keydown", (event, n) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (n.type === "bean") {
            onSelectBeanRef.current?.(n.bean);
          } else {
            onSelectRef.current?.(n.flavor.id);
          }
        }
      });

    // 円ノードの描画
    items
      .append("circle")
      .attr("class", "node-circle")
      .attr("r", (n) =>
        n.type === "center"
          ? 34
          : n.type === "flavor"
            ? 22 + Math.min(10, Math.sqrt(n.count))
            : 6,
      )
      .attr("fill", (n) =>
        n.type === "bean" ? "#c8a477" : color(n.flavor.path),
      )
      .attr("stroke", (n) =>
        n.type === "center" || (n.type === "bean" && n.bean.matchCount === 3)
          ? "#6f4e37"
          : "#fffbf3",
      )
      .attr("stroke-width", (n) => (n.type === "center" ? 2.5 : 1.5));

    // テキストラベル: 味ノードは常時、豆ノードはホバー/選択時に表示
    // 100ノードの豆すべてに文字を出すと画面が真っ黒になるため、味ノードのみ常時表示
    items
      .filter((n) => n.type !== "bean")
      .append("text")
      .attr("class", "node-label")
      .attr("text-anchor", "middle")
      .attr("y", 4)
      .attr("fill", (n) =>
        n.flavor.path[0] === "Roasted" ? "#ffffff" : "#3e2c20",
      )
      .attr("font-size", 11)
      .attr("font-weight", (n) => (n.type === "center" ? 600 : 500))
      .attr("pointer-events", "none")
      .text((n) => flavorName(n.flavor.name).slice(0, 16));

    // 豆ノード用のホバー/選択時アクティブテキスト（通常時は非表示）
    items
      .filter((n) => n.type === "bean")
      .append("text")
      .attr("class", "bean-active-label")
      .attr("text-anchor", "middle")
      .attr("y", 18)
      .attr("fill", "#493426")
      .attr("font-size", 9.5)
      .attr("font-weight", 600)
      .attr("pointer-events", "none")
      .style("display", "none")
      .text((n) => n.bean.title.slice(0, 18));

    // ドラッグ操作
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
      for (const node of nodes) {
        const marginX = Math.min(
          layout.width / 2,
          node.type === "bean" ? 90 : 65,
        );
        const marginY = Math.min(
          layout.height / 2,
          node.type === "center" ? 55 : 42,
        );
        node.x = Math.max(marginX, Math.min(layout.width - marginX, node.x));
        node.y = Math.max(marginY, Math.min(layout.height - marginY, node.y));
      }
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
    // Restore the current transform when the selected flavor changes, too.
    group.attr("transform", zoomTransform(svg.node()));
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (
        !width ||
        !height ||
        (width === layout.width && height === layout.height)
      )
        return;
      const previous = layout;
      layout = networkLayout(width, height);
      resizeNetworkNodes(nodes, previous, layout);
      pinSelected();
      svg.attr("viewBox", `0 0 ${width} ${height}`);
      simulation.force("x").x(layout.cx);
      simulation.force("y").y(layout.cy);
      simulation
        .force("link")
        .distance((l) => (l.target.type === "center" ? 135 : 75) * layout.unit);
      simulation.force("charge").strength(FORCE_SETTINGS.charge * layout.unit);
      const transform = zoomTransform(svg.node());
      svg.call(
        zoomBehavior.transform,
        zoomIdentity
          .translate(
            (transform.x * width) / previous.width,
            (transform.y * height) / previous.height,
          )
          .scale(transform.k),
      );
      simulation.alpha(0.35).restart();
    });
    observer.observe(viewport);
    return () => {
      observer.disconnect();
      positionsRef.current = new Map(
        nodes.map((n) => [n.id, { x: n.x, y: n.y }]),
      );
      simulation.on("tick", null).stop();
      items
        .on(".drag", null)
        .on("click", null)
        .on("keydown", null)
        .on("mouseenter", null)
        .on("mouseleave", null)
        .on("focus", null)
        .on("blur", null);
      svg.on(".zoom", null);
    };
  }, [network, color]);

  // selectedBeanId や hoveredBeanId に応じてSVGノードのスタイルを更新
  useEffect(() => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    group.selectAll(".network-node.node-bean").each(function (n) {
      const isSelected = selectedBeanId && n.bean.id === selectedBeanId;
      const isHovered = hoveredBeanId && n.bean.id === hoveredBeanId;
      const isActive = isSelected || isHovered;

      const el = select(this);
      el.classed("is-selected-bean", isSelected).classed(
        "is-hovered-bean",
        isHovered,
      );

      // 円のスタイル
      el.select("circle")
        .attr("r", isActive ? 9.5 : 6)
        .attr("fill", isActive ? "#df9343" : "#c8a477")
        .attr(
          "stroke",
          isActive || n.bean.matchCount === 3 ? "#5a3a22" : "#fffbf3",
        )
        .attr("stroke-width", isActive ? 2.5 : 1.5);

      // ラベルの表示切り替え
      el.select(".bean-active-label").style(
        "display",
        isActive ? "block" : "none",
      );

      // アクティブノードを前面に出す
      if (isActive) {
        this.parentNode.appendChild(this);
      }
    });
  }, [selectedBeanId, hoveredBeanId, network]);

  return (
    <div className="flavor-network-viewport" ref={viewportRef}>
      <svg
        ref={svgRef}
        className="flavor-network"
        aria-label="豆と味のネットワーク。ドラッグで移動、ホイールで拡大縮小"
      />
    </div>
  );
}
