// 豆1206点をどこに置くかを決める2つのレイアウト。
//
//   buildGeoLayout(projection)      … 産地(地理座標)に並べる = 地図モード
//   buildTasteLayout(width, height) … UMAP座標に並べる       = 味覚空間モード
//
// どちらも Map<node.id, [px, py]> という同じ形を返すので、2つのレイアウトの間は
// id をキーにした単純な線形補間でモーフィングできる。
import { forceCollide, forceSimulation, forceX, forceY } from "d3-force";
import { clusterIndex, isNoise } from "./clusters";
import { coffeeData } from "./coffeeData";

export const NODE_BASE_R = 1.5;
// バネ（アンカーへ引き戻す力）と衝突（点どうしを押し離す力）の釣り合いで重なりを解く。
const LAYOUT_SPRING = 0.15;
const LAYOUT_COLLIDE_PADDING = 0;
const LAYOUT_COLLIDE_STRENGTH = 0.85;
const LAYOUT_TICKS = 300;
// 味覚空間モードで、UMAPの点群が画面のどれだけを占めるか。
const TASTE_FILL_RATIO = 0.8;

// アンカー付きの粒子群を、その場（同期）で収束させる。
// d3-force のタイマーは使わず .stop().tick() で一気に回すため、
// 呼び出し側から見れば単なる計算関数として扱える。
function relaxParticles(particles) {
  forceSimulation(particles)
    .force("spring-x", forceX((d) => d.anchorX).strength(LAYOUT_SPRING))
    .force("spring-y", forceY((d) => d.anchorY).strength(LAYOUT_SPRING))
    .force(
      "collide",
      forceCollide(NODE_BASE_R + LAYOUT_COLLIDE_PADDING).strength(
        LAYOUT_COLLIDE_STRENGTH,
      ),
    )
    .stop()
    .tick(LAYOUT_TICKS);

  return new Map(particles.map((p) => [p.id, [p.x, p.y]]));
}

// アンカー位置から初期位置を作る。完全に同じ座標の点があると衝突力が働かないため、
// 黄金角で微小ジッターを与えて方向をばらけさせる。
function seed(id, ax, ay, i) {
  const j = i * 2.399963;
  return {
    id,
    anchorX: ax,
    anchorY: ay,
    x: ax + 0.01 * Math.cos(j),
    y: ay + 0.01 * Math.sin(j),
  };
}

// 地図モードのレイアウト。
//
// 同じ産地の豆はまったく同じ緯度経度を持つため、そのままでは点が完全に重なる。
// さらに見た目が"ぐちゃぐちゃ"にならないよう、引き戻す先を国の中心そのものではなく
//   国の中心 + そのクラスタ(色)ごとの方向オフセット = クラスタ・サブアンカー
// にする。これで同じ国の中で同じ色の豆が同じ方角へ寄り、国ごとに色がまとまる。
export function buildGeoLayout(projection) {
  // 1) 国ごとに豆をまとめ、その国の豆の平均座標を中心とする
  //    （admin1でばらけている産地を1つの塊に集約して国単位の島にする）
  const countries = new Map();
  coffeeData.forEach((node) => {
    if (node.lng == null || node.lat == null) return;
    const p = projection([node.lng, node.lat]);
    if (!p) return;
    let country = countries.get(node.country);
    if (!country) {
      country = { sx: 0, sy: 0, members: [] };
      countries.set(node.country, country);
    }
    country.sx += p[0];
    country.sy += p[1];
    country.members.push(node);
  });

  // 2) 各国内で、クラスタ(色)ごとに方向を割り当ててサブアンカーを作る
  const particles = [];
  for (const country of countries.values()) {
    const cx = country.sx / country.members.length;
    const cy = country.sy / country.members.length;

    // その国に存在するクラスタを決定的な順序(クラスタ番号順・ノイズは最後)で並べる
    const clusterOrder = [];
    const seen = new Set();
    for (const node of country.members) {
      const name = node.clusterName;
      if (seen.has(name)) continue;
      seen.add(name);
      clusterOrder.push(name);
    }
    clusterOrder.sort((a, b) => {
      if (isNoise(a)) return 1;
      if (isNoise(b)) return -1;
      return (clusterIndex(a) ?? 0) - (clusterIndex(b) ?? 0);
    });
    const dirOf = new Map(clusterOrder.map((name, i) => [name, i]));
    const m = clusterOrder.length;
    // 国が大きい(=豆が多い)ほど点の塊も大きいので、色を分ける距離もそれに比例させる
    const spread =
      m <= 1 ? 0 : NODE_BASE_R * Math.sqrt(country.members.length) * 0.55;

    country.members.forEach((node, i) => {
      const k = dirOf.get(node.clusterName);
      const ang = m <= 1 ? 0 : (2 * Math.PI * k) / m;
      // サブアンカー: 国の中心から、そのクラスタの方角へ spread だけずらした点
      particles.push(
        seed(node.id, cx + spread * Math.cos(ang), cy + spread * Math.sin(ang), i),
      );
    });
  }

  return relaxParticles(particles);
}

// 味覚空間モードのレイアウト。
//
// UMAP座標(node.x, node.y)は約 7.9 x 7.2 の生の単位なので、縦横比を保ったまま
// 画面中央の正方領域へ収める。歪ませるとクラスタの形が変わってしまうため、
// x/y に別々のスケールをかけてはいけない。
//
// クラスタ名ラベルを置くため、クラスタごとの重心も併せて返す。
export function buildTasteLayout(width, height) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of coffeeData) {
    if (node.x < minX) minX = node.x;
    if (node.x > maxX) maxX = node.x;
    if (node.y < minY) minY = node.y;
    if (node.y > maxY) maxY = node.y;
  }

  const box = Math.min(width, height) * TASTE_FILL_RATIO;
  // 長い方の辺を box に合わせる単一スケール（縦横比が保たれる）
  const scale = box / Math.max(maxX - minX, maxY - minY, 1e-6);
  const offsetX = width / 2 - ((minX + maxX) / 2) * scale;
  const offsetY = height / 2 - ((minY + maxY) / 2) * scale;

  const particles = coffeeData.map((node, i) =>
    seed(node.id, node.x * scale + offsetX, node.y * scale + offsetY, i),
  );
  const positions = relaxParticles(particles);

  // クラスタごとの重心（重なり除去後の実際の位置から計算する）
  const sums = new Map();
  for (const node of coffeeData) {
    const p = positions.get(node.id);
    if (!p) continue;
    let acc = sums.get(node.clusterName);
    if (!acc) {
      acc = { sx: 0, sy: 0, n: 0 };
      sums.set(node.clusterName, acc);
    }
    acc.sx += p[0];
    acc.sy += p[1];
    acc.n += 1;
  }
  const clusterCentroids = new Map(
    [...sums].map(([name, a]) => [name, [a.sx / a.n, a.sy / a.n]]),
  );

  // 縦パンのクランプに使う、点群全体の範囲（投影後px, ズーム前）
  const bounds = [
    [offsetX + minX * scale, offsetY + minY * scale],
    [offsetX + maxX * scale, offsetY + maxY * scale],
  ];

  return { positions, clusterCentroids, bounds };
}
