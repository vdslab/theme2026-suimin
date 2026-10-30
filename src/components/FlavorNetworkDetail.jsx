import {
  flavorName,
  flavorPath,
  formatConfidence,
  formatPrice,
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
import { zoom, zoomIdentity, zoomTransform } from "d3-zoom";
import { networkLayout, resizeNetworkNodes } from "../lib/networkLayout.js";
import { drag } from "d3-drag";
import { pathId } from "../lib/flavorData";

const beanInfo = (b) => {
  const price = formatPrice(b.price_value, b.price_currency);
  const country = translateCountry(b.origin_country) || "不明";
  const region = b.origin_region ? ` (${b.origin_region})` : "";
  const conf = formatConfidence(b.confidence);
  return `${b.title}\n値段：${price}\n生産国：${country}${region}\n焙煎所：${b.source_roaster || "不明"}\n精製方法：${processName(b.process_method)}\n焙煎度：${roastName(b.roast_level)}\n味タグの信頼度：${conf}`;
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
  const svgRef = useRef(null);
  const groupRef = useRef(null);
  const viewportRef = useRef(null);
  const [inspected, setInspected] = useState(null);

  const onSelectBeanRef = useRef(onSelectBean);
  onSelectBeanRef.current = onSelectBean;
  const onHoverBeanRef = useRef(onHoverBean);
  onHoverBeanRef.current = onHoverBean;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // 親から selectedBeanId が変更されたら inspected を同期
  useEffect(() => {
    if (!selectedBeanId) return;
    const beanNode = network?.nodes?.find(
      (n) => n.type === "bean" && n.bean.id === selectedBeanId,
    );
    if (beanNode) {
      setInspected(beanNode);
    }
  }, [selectedBeanId, network]);

  // D3 force simulation 初期化（networkまたはcolor変更時のみ）
  useEffect(() => {
    setInspected(null);
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
      x: layout.cx + Math.cos(i * 2.4) * 170 * layout.unit,
      y: layout.cy + Math.sin(i * 2.4) * 170 * layout.unit,
    }));
    nodes[0].fx = layout.cx;
    nodes[0].fy = layout.cy;
    const links = network.links.map((l) => ({ ...l }));

    // 100ノード規模でも重なりすぎず画面内に美しく収まるよう調整
    const simulation = forceSimulation(nodes)
      .force(
        "link",
        forceLink(links)
          .id((n) => n.id)
          .distance(
            (l) => (l.target.type === "center" ? 135 : 75) * layout.unit,
          )
          .strength(0.32),
      )
      .force("charge", forceManyBody().strength(-70 * layout.unit))
      .force(
        "collide",
        forceCollide((n) =>
          n.type === "center" ? 64 : n.type === "flavor" ? 40 : 10,
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
      .attr("stroke-opacity", 0.22)
      .attr("stroke-width", 1.2);

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
        setInspected(n);
        if (n.type === "bean") {
          onSelectBeanRef.current?.(n.bean);
        } else {
          onSelectBeanRef.current?.(null);
        }
      })
      .on("focus", (_, n) => setInspected(n))
      .on("mouseenter", (_, n) => {
        if (n.type === "bean") {
          onHoverBeanRef.current?.(n.bean.id);
        }
      })
      .on("mouseleave", (_, n) => {
        if (n.type === "bean") {
          onHoverBeanRef.current?.(null);
        }
      })
      .on("keydown", (event, n) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setInspected(n);
          if (n.type === "bean") {
            onSelectBeanRef.current?.(n.bean);
          } else {
            onSelectBeanRef.current?.(null);
          }
        }
      });

    // 円ノードの描画
    items
      .append("circle")
      .attr("class", "node-circle")
      .attr("r", (n) =>
        n.type === "center"
          ? 48
          : n.type === "flavor"
            ? 22 + Math.min(10, Math.sqrt(n.count))
            : 6,
      )
      .attr("fill", (n) =>
        n.type === "bean" ? "#c8a477" : color(n.flavor.path),
      )
      .attr("stroke", (n) => (n.type === "center" ? "#6f4e37" : "#fffbf3"))
      .attr("stroke-width", (n) => (n.type === "center" ? 2.5 : 1.5));

    // ツールチップ
    items
      .append("title")
      .text((n) =>
        n.type === "bean"
          ? beanInfo(n.bean)
          : `${flavorPath(n.flavor.path)}\n選択味と一緒に出た件数: ${n.count}`,
      );

    // テキストラベル: 味ノードは常時、豆ノードはホバー/選択時またはツールチップで識別
    // 100ノードの豆すべてに文字を出すと画面が真っ黒になるため、味ノードのみ常時表示
    items
      .filter((n) => n.type !== "bean")
      .append("text")
      .attr("class", "node-label")
      .attr("text-anchor", "middle")
      .attr("y", 4)
      .attr("fill", "#3e2c20")
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
      nodes[0].fx = layout.cx;
      nodes[0].fy = layout.cy;
      svg.attr("viewBox", `0 0 ${width} ${height}`);
      simulation.force("x").x(layout.cx);
      simulation.force("y").y(layout.cy);
      simulation
        .force("link")
        .distance((l) => (l.target.type === "center" ? 135 : 75) * layout.unit);
      simulation.force("charge").strength(-70 * layout.unit);
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
      simulation.stop();
      svg.on(".zoom", null);
    };
  }, [network, color]);

  // selectedBeanId や hoveredBeanId に応じてSVGノードのスタイルを更新
  useEffect(() => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    group
      .selectAll(".network-node.node-bean")
      .each(function (n) {
        const isSelected = selectedBeanId && n.bean.id === selectedBeanId;
        const isHovered = hoveredBeanId && n.bean.id === hoveredBeanId;
        const isActive = isSelected || isHovered;

        const el = select(this);
        el.classed("is-selected-bean", isSelected)
          .classed("is-hovered-bean", isHovered);

        // 円のスタイル
        el.select("circle")
          .attr("r", isActive ? 9.5 : 6)
          .attr("fill", isActive ? "#df9343" : "#c8a477")
          .attr("stroke", isActive ? "#5a3a22" : "#fffbf3")
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
  }, [selectedBeanId, hoveredBeanId]);

  const selectedBeanNode = selectedBeanId
    ? network?.nodes?.find(
        (n) => n.type === "bean" && n.bean.id === selectedBeanId,
      )
    : null;
  const currentInspected =
    inspected?.type === "flavor" || inspected?.type === "center"
      ? inspected
      : (selectedBeanNode || inspected);

  const source = currentInspected?.bean?.source_url || currentInspected?.bean?.product_url;
  const safeSource = source && /^https?:\/\//i.test(source) ? source : null;

  return (
    <>
      <div className="flavor-network-viewport" ref={viewportRef}>
        <svg
          ref={svgRef}
          className="flavor-network"
          aria-label="豆と味のネットワーク。ドラッグで移動、ホイールで拡大縮小"
        />
      </div>
      <div className="flavor-inspector" aria-live="polite">
        {currentInspected ? (
          currentInspected.type === "bean" ? (
            <div className="flavor-inspector-bean">
              <div className="flavor-inspector-header">
                <span className="flavor-inspector-badge">選択中の豆</span>
                <strong>{currentInspected.bean.title}</strong>
              </div>
              <div className="flavor-inspector-grid">
                <div>
                  <span className="inspector-label">値段:</span>
                  <span className="inspector-value font-semibold">
                    {formatPrice(
                      currentInspected.bean.price_value,
                      currentInspected.bean.price_currency,
                    )}
                  </span>
                </div>
                <div>
                  <span className="inspector-label">産地:</span>
                  <span className="inspector-value">
                    {translateCountry(currentInspected.bean.origin_country) || "不明"}
                    {currentInspected.bean.origin_region
                      ? ` (${currentInspected.bean.origin_region})`
                      : ""}
                  </span>
                </div>
                <div>
                  <span className="inspector-label">信頼度:</span>
                  <span className="inspector-value font-semibold">
                    {formatConfidence(currentInspected.bean.confidence)}
                  </span>
                </div>
                <div>
                  <span className="inspector-label">焙煎所:</span>
                  <span className="inspector-value">
                    {currentInspected.bean.source_roaster || "不明"}
                  </span>
                </div>
                <div>
                  <span className="inspector-label">精製・焙煎:</span>
                  <span className="inspector-value">
                    {processName(currentInspected.bean.process_method)} ·{" "}
                    {roastName(currentInspected.bean.roast_level)}
                  </span>
                </div>
              </div>
              <div className="flavor-bean-tags">
                <p>この豆の味タグ（{currentInspected.bean.paths.length}個）</p>
                <ul aria-label="この豆が持つすべての味タグ">
                  {currentInspected.bean.paths.map((path) => (
                    <li key={pathId(path)}>
                      <button
                        type="button"
                        onClick={() => onSelect(pathId(path))}
                        title="この味を中心に探索"
                        style={{ borderColor: color(path) }}
                      >
                        <i
                          className="flavor-tag-dot"
                          style={{ backgroundColor: color(path) }}
                        />
                        {flavorPath(path)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {safeSource && (
                <div className="flavor-inspector-actions">
                  <a
                    href={safeSource}
                    target="_blank"
                    rel="noreferrer"
                    className="flavor-inspector-link"
                  >
                    出典の商品ページを開く ↗
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="flavor-inspector-flavor">
              <span className="flavor-inspector-badge">味ノード</span>
              <strong>{flavorPath(currentInspected.flavor.path)}</strong>
              <p>選択味と一緒に出た件数：{currentInspected.count}件</p>
              {currentInspected.type !== "center" && (
                <button
                  type="button"
                  onClick={() => onSelect(currentInspected.flavor.id)}
                  className="flavor-inspector-btn"
                >
                  この味を中心に探索 →
                </button>
              )}
            </div>
          )
        ) : (
          <p className="flavor-inspector-empty">
            ネットワーク図のノードに触れるとツールチップ、クリックするとここに詳細が表示されます。
            下のリストから豆を選ぶと、ネットワーク図と連動します。
          </p>
        )}
      </div>
    </>
  );
}
