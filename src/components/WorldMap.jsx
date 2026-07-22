import * as d3geo from "d3-geo";
import { RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as topojson from "topojson-client";
import worldTopoJson from "../data/world-110m.json";
import { clusterColor, shortName } from "../lib/clusters";
import { coffeeData, nearestByTaste } from "../lib/coffeeData";
import { translateCountry } from "../lib/countryNames";
import MapLegend from "./MapLegend";

// TopoJSONのnameとcoffeeDataのcountryをマッピング
const mapCountryName = (c) => {
  if (c === "Tanzania, United Republic Of") return "Tanzania";
  if (c === "United States") return "United States of America";
  if (c === "United States (Hawaii)") return "Hawaii";
  if (c === "United States (Puerto Rico)") return "Puerto Rico";
  return c;
};

export default function WorldMap({
  selectedCoffee,
  onSelectCoffee,
  searchQuery,
  drankCoffees = {},
  recommendedCoffee,
}) {
  const [activeCluster, setActiveCluster] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [nodeScreenBadges, setNodeScreenBadges] = useState([]);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Three.js インスタンス保持用の ref
  const threeRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    pillarsGroup: null,
    arcsGroup: null,
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    pillarMeshMap: new Map(),
    nodes3DPositions: [],
  });

  const maxSampleCount = useMemo(() => {
    return Math.max(...coffeeData.map((d) => d.sampleCount || 1), 1);
  }, []);

  const similarCoffees = useMemo(() => {
    if (!selectedCoffee) return [];
    return nearestByTaste(selectedCoffee, 3);
  }, [selectedCoffee]);

  const similarCoffeeIds = useMemo(() => {
    return new Set(similarCoffees.map((n) => n.id));
  }, [similarCoffees]);

  const geoFeatures = useMemo(() => {
    return topojson.feature(worldTopoJson, worldTopoJson.objects.countries)
      .features;
  }, []);

  // 検索・クラスタフィルタリング後のノード
  const filteredNodesByGeoName = useMemo(() => {
    const rawQuery = (searchQuery || "").trim();
    let regex = null;
    let isRegexValid = false;

    if (rawQuery) {
      try {
        regex = new RegExp(rawQuery, "i");
        isRegexValid = true;
      } catch (_e) {
        // フォールバック
      }
    }

    const queryLower = rawQuery.toLowerCase();
    const map = {};

    coffeeData.forEach((node) => {
      let matchesSearch = false;
      if (!rawQuery) {
        matchesSearch = true;
      } else {
        const targets = [
          translateCountry(node.country) || "",
          node.country || "",
          node.admin1 || "",
          node.name || "",
          (node.varieties || []).join(" "),
        ];

        if (isRegexValid) {
          matchesSearch = targets.some((str) => regex.test(str));
        } else {
          matchesSearch = targets.some((str) =>
            str.toLowerCase().includes(queryLower),
          );
        }
      }

      if (matchesSearch) {
        const geoName = mapCountryName(node.country);
        if (!map[geoName]) map[geoName] = [];
        map[geoName].push(node);
      }
    });
    return map;
  }, [searchQuery]);

  const filteredNodeList = useMemo(() => {
    return Object.values(filteredNodesByGeoName).flat();
  }, [filteredNodesByGeoName]);

  // オフスクリーンCanvasで高精細な地図テクスチャ（2048x1024）を生成
  const mapTexture = useMemo(() => {
    const texWidth = 2048;
    const texHeight = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = texWidth;
    canvas.height = texHeight;
    const ctx = canvas.getContext("2d");

    const centerLng = 139;
    const projection = d3geo
      .geoMercator()
      .rotate([-centerLng, 0])
      .scale(texWidth / (2 * Math.PI))
      .translate([texWidth / 2, texHeight / 1.5]);

    const pathGen = d3geo.geoPath().projection(projection);

    // 海洋背景
    ctx.fillStyle = "#e0f2fe";
    ctx.fillRect(0, 0, texWidth, texHeight);

    // 陸地
    geoFeatures.forEach((geo) => {
      const geoName = geo.properties.name;
      const hasData = !!filteredNodesByGeoName[geoName];
      ctx.fillStyle = hasData ? "#fde9d0" : "#e2e8f0";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;

      ctx.beginPath();
      pathGen.context(ctx)(geo);
      ctx.fill();
      ctx.stroke();
    });

    // 回帰線と赤道
    const yEquator = projection([centerLng, 0])?.[1] ?? 0;
    const yCancer = projection([centerLng, 25])?.[1] ?? 0;
    const yCapricorn = projection([centerLng, -25])?.[1] ?? 0;

    // コーヒーベルト帯
    ctx.fillStyle = "rgba(245, 158, 11, 0.12)";
    ctx.fillRect(0, yCancer, texWidth, yCapricorn - yCancer);

    ctx.strokeStyle = "rgba(245, 158, 11, 0.6)";
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, yCancer);
    ctx.lineTo(texWidth, yCancer);
    ctx.moveTo(0, yCapricorn);
    ctx.lineTo(texWidth, yCapricorn);
    ctx.stroke();

    ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(0, yEquator);
    ctx.lineTo(texWidth, yEquator);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { texture, projection, texWidth, texHeight };
  }, [geoFeatures, filteredNodesByGeoName]);

  // 3Dシーンの初期化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // シーン
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#dbeafe");

    // カメラ
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 48, 52);

    // レンダラー
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // 地面下に潜らない
    controls.minDistance = 15;
    controls.maxDistance = 180;
    controls.target.set(0, 0, 0);

    // ライティング
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(40, 80, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x475569, 0.4);
    scene.add(hemiLight);

    // 地面（3Dマッププレーン）
    const mapPlaneGeo = new THREE.PlaneGeometry(100, 50);
    const mapPlaneMat = new THREE.MeshStandardMaterial({
      map: mapTexture.texture,
      roughness: 0.7,
      metalness: 0.05,
    });
    const mapPlane = new THREE.Mesh(mapPlaneGeo, mapPlaneMat);
    mapPlane.rotation.x = -Math.PI / 2;
    mapPlane.receiveShadow = true;
    scene.add(mapPlane);

    // 柱グループと弧線グループ
    const pillarsGroup = new THREE.Group();
    const arcsGroup = new THREE.Group();
    scene.add(pillarsGroup);
    scene.add(arcsGroup);

    threeRef.current = {
      scene,
      camera,
      renderer,
      controls,
      pillarsGroup,
      arcsGroup,
      raycaster: new THREE.Raycaster(),
      mouse: new THREE.Vector2(),
      pillarMeshMap: new Map(),
      nodes3DPositions: [],
    };

    // リサイズハンドラ
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // アニメーションループ
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);

      // スクリーン座標へのバッジ追従計算
      if (threeRef.current.nodes3DPositions.length > 0) {
        const badges = [];
        const tempVec = new THREE.Vector3();
        const canvasW = containerRef.current?.clientWidth || window.innerWidth;
        const canvasH =
          containerRef.current?.clientHeight || window.innerHeight;

        threeRef.current.nodes3DPositions.forEach((item) => {
          tempVec.set(item.x, item.topY, item.z);
          tempVec.project(camera);

          // カメラの背後にある場合は非表示
          if (tempVec.z > 1) return;

          const screenX = ((tempVec.x + 1) * canvasW) / 2;
          const screenY = ((-tempVec.y + 1) * canvasH) / 2;

          badges.push({
            id: item.node.id,
            node: item.node,
            x: screenX,
            y: screenY,
            sampleCount: item.node.sampleCount,
            dimmed: item.dimmed,
          });
        });

        setNodeScreenBadges(badges);
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, [mapTexture]);

  // 3D柱（バー）の更新構築
  useEffect(() => {
    const { pillarsGroup, pillarMeshMap } = threeRef.current;
    if (!pillarsGroup) return;

    // 既存柱の破棄
    while (pillarsGroup.children.length > 0) {
      const child = pillarsGroup.children.pop();
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => {
            m.dispose();
          });
        } else {
          child.material.dispose();
        }
      }
    }
    pillarMeshMap.clear();

    const new3DPositions = [];
    const { projection, texWidth, texHeight } = mapTexture;

    filteredNodeList.forEach((node) => {
      if (node.lng == null || node.lat == null) return;
      const [px, py] = projection([node.lng, node.lat]);
      if (!px || !py) return;

      // 2048x1024 -> 3D空間の 100x50 にマッピング
      const x3D = (px / texWidth) * 100 - 50;
      const z3D = (py / texHeight) * 50 - 25;

      const isFilteredOut =
        activeCluster !== null && activeCluster !== node.clusterName;
      const isRecommended = recommendedCoffee?.id === node.id;
      const isSelected = selectedCoffee?.id === node.id;
      const isDrank = !!drankCoffees[node.id];
      const isSimilar = selectedCoffee ? similarCoffeeIds.has(node.id) : false;

      let opacity = 1;
      let dimmed = false;
      if (isFilteredOut) {
        opacity = 0.15;
        dimmed = true;
      } else if (recommendedCoffee) {
        if (!isDrank && !isRecommended) {
          opacity = 0.35;
          dimmed = true;
        }
      } else if (selectedCoffee) {
        if (!isSelected && !isSimilar) {
          opacity = 0.35;
          dimmed = true;
        }
      }

      // データ件数に応じた高さ（1.2 〜 10.0）
      const sampleCount = node.sampleCount || 1;
      const height3D = 1.2 + (sampleCount / maxSampleCount) * 8.8;
      const radius = isSelected || isRecommended ? 0.55 : 0.4;
      const hexColor = clusterColor(node.clusterName);

      // 3D柱メッシュ
      const cylGeo = new THREE.CylinderGeometry(radius, radius, height3D, 16);
      const cylMat = new THREE.MeshStandardMaterial({
        color: hexColor,
        roughness: 0.3,
        metalness: 0.15,
        transparent: opacity < 1,
        opacity: opacity,
      });
      const pillarMesh = new THREE.Mesh(cylGeo, cylMat);
      pillarMesh.position.set(x3D, height3D / 2, z3D);
      pillarMesh.castShadow = true;
      pillarMesh.receiveShadow = true;

      pillarMesh.userData = {
        node,
        x3D,
        z3D,
        height3D,
        topY: height3D,
        hexColor,
      };

      // 柱の天面（3Dハイライト）
      const capGeo = new THREE.CylinderGeometry(
        radius * 1.05,
        radius * 1.05,
        0.08,
        16,
      );
      const capMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xffffff : isRecommended ? 0xeab308 : 0xffffff,
        emissive: isSelected ? 0xffffff : 0x000000,
        emissiveIntensity: 0.3,
        roughness: 0.2,
      });
      const capMesh = new THREE.Mesh(capGeo, capMat);
      capMesh.position.set(x3D, height3D + 0.04, z3D);
      pillarsGroup.add(capMesh);

      // 地面の影/リング
      const ringGeo = new THREE.RingGeometry(radius * 1.1, radius * 1.6, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0x000000 : 0x000000,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(x3D, 0.02, z3D);
      pillarsGroup.add(ringMesh);

      pillarsGroup.add(pillarMesh);
      pillarMeshMap.set(node.id, {
        x3D,
        z3D,
        height3D,
        mesh: pillarMesh,
        node,
      });

      new3DPositions.push({
        node,
        x: x3D,
        z: z3D,
        topY: height3D + 0.6,
        dimmed,
      });
    });

    threeRef.current.nodes3DPositions = new3DPositions;
  }, [
    filteredNodeList,
    maxSampleCount,
    activeCluster,
    selectedCoffee,
    recommendedCoffee,
    drankCoffees,
    similarCoffeeIds,
    mapTexture,
  ]);

  // 3D空間上の弧線（アルク）の更新描画
  useEffect(() => {
    const { arcsGroup, pillarMeshMap } = threeRef.current;
    if (!arcsGroup) return;

    while (arcsGroup.children.length > 0) {
      const child = arcsGroup.children.pop();
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }

    if (!selectedCoffee) return;

    const startInfo = pillarMeshMap.get(selectedCoffee.id);
    if (!startInfo) return;

    similarCoffees.forEach((similar) => {
      const endInfo = pillarMeshMap.get(similar.id);
      if (!endInfo) return;

      const p1 = new THREE.Vector3(
        startInfo.x3D,
        startInfo.height3D,
        startInfo.z3D,
      );
      const p2 = new THREE.Vector3(endInfo.x3D, endInfo.height3D, endInfo.z3D);

      const dist = p1.distanceTo(p2);
      const midY = Math.max(p1.y, p2.y) + Math.min(dist * 0.35, 12.0);
      const mid = new THREE.Vector3((p1.x + p2.x) / 2, midY, (p1.z + p2.z) / 2);

      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.15, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0x14b8a6,
        emissive: 0x14b8a6,
        emissiveIntensity: 0.8,
        roughness: 0.2,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      arcsGroup.add(tubeMesh);
    });
  }, [selectedCoffee, similarCoffees]);

  // 3Dレイキャスティング（ホバー＆クリック判定）
  const handlePointerMove = (e) => {
    const { raycaster, mouse, camera, pillarsGroup } = threeRef.current;
    if (!containerRef.current || !pillarsGroup || !camera) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(pillarsGroup.children);

    if (intersects.length > 0) {
      const hit = intersects.find((i) => i.object.userData?.node);
      if (hit) {
        const node = hit.object.userData.node;
        setHoveredNode({
          node,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        return;
      }
    }
    setHoveredNode(null);
  };

  const handlePointerDown = (e) => {
    const { raycaster, mouse, camera, pillarsGroup } = threeRef.current;
    if (!containerRef.current || !pillarsGroup || !camera) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(pillarsGroup.children);

    if (intersects.length > 0) {
      const hit = intersects.find((i) => i.object.userData?.node);
      if (hit) {
        const node = hit.object.userData.node;
        onSelectCoffee(node);
      }
    }
  };

  // カメラをデフォルトの3D俯瞰視点へリセット
  const handleResetCamera = () => {
    const { camera, controls } = threeRef.current;
    if (!camera || !controls) return;
    camera.position.set(0, 48, 52);
    controls.target.set(0, 0, 0);
    controls.update();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: WebGL map interaction
    // biome-ignore lint/a11y/useKeyWithClickEvents: Pointer-driven 3D interaction
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-[#dbeafe]"
      onPointerMove={handlePointerMove}
      onClick={handlePointerDown}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* 3Dカメラリセットボタン */}
      <div className="absolute top-3 right-3 sm:top-6 sm:right-6 z-30 flex items-center gap-2 bg-base-100/90 backdrop-blur-md p-2 rounded-2xl shadow-lg border border-base-200 pointer-events-auto select-none">
        <button
          type="button"
          onClick={handleResetCamera}
          className="btn btn-xs sm:btn-sm btn-ghost gap-1.5 font-bold text-base-content/80 hover:text-primary"
          title="3Dカメラ視点をリセット"
        >
          <RotateCcw size={14} />
          視点をリセット
        </button>
      </div>

      {/* 3D柱直上に追従表示するデータ件数バッジ */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        {nodeScreenBadges.map((badge) => (
          <div
            key={`badge-${badge.id}`}
            className={`absolute -translate-x-1/2 -translate-y-full transition-opacity duration-200 ${
              badge.dimmed ? "opacity-30" : "opacity-100"
            }`}
            style={{ left: badge.x, top: badge.y }}
          >
            <span className="inline-block rounded-md bg-base-100/90 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-extrabold text-base-content shadow-sm border border-base-200/80 leading-none">
              {badge.sampleCount}件
            </span>
          </div>
        ))}
      </div>

      <MapLegend
        ref={null}
        activeCluster={activeCluster}
        toggleCluster={setActiveCluster}
        setActiveCluster={setActiveCluster}
      />

      {/* ホバーツールチップ */}
      {hoveredNode && (
        <div
          className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-full rounded-xl bg-base-100/95 p-3 shadow-2xl border border-base-200 whitespace-nowrap"
          style={{ left: hoveredNode.x, top: hoveredNode.y - 12 }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="w-3 h-3 rounded-full shrink-0 shadow-sm"
              style={{
                backgroundColor: clusterColor(hoveredNode.node.clusterName),
              }}
            />
            <span className="text-sm font-bold text-base-content leading-tight">
              {translateCountry(hoveredNode.node.country)}
            </span>
          </div>
          <div className="text-xs text-base-content/70 font-medium">
            地域: {hoveredNode.node.admin1}
          </div>
          <div className="text-xs font-extrabold text-primary mt-1">
            データ件数: {hoveredNode.node.sampleCount} 件
          </div>
          <div className="text-[11px] text-base-content/50 mt-0.5">
            味わいタイプ: {shortName(hoveredNode.node.clusterName)}
          </div>
        </div>
      )}
    </div>
  );
}
