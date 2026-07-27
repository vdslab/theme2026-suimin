# 豆単位ノードへの移行（地域集約の廃止）

## 現状の把握
- [x] 地域集約の場所: `scripts/precompute_data.py` [3] `df.groupby(["Country.of.Origin","Region_admin1"])`
- [x] クラスタリング用データ: 集約後ノードの偏差6軸 → StandardScaler → UMAP(2D) → HDBSCAN → 6クラスタへ統合
- [x] エッジ生成: `src/lib/coffeeData.js` の `tasteSimilarityPairs`（UMAP 2D距離のk=3近傍・無向・重複除去）

## 実装
- [x] precompute: groupby を廃止し、1豆=1ノード（1206件）に
- [x] precompute: 豆単位の偏差6軸でクラスタリング（min_cluster_size 4→20）
- [x] precompute: 味覚特徴量空間(標準化済み偏差6軸)で k-NN を計算し `neighbors` として書き出す
- [x] precompute: 同一地域の豆が重ならないよう決定的ジッター（黄金角の渦巻き）で座標を割り当てる
- [x] frontend: `coffeeData.js` を豆単位フィールドに合わせ、エッジは `neighbors` 上位3件から無向・重複除去で生成
- [x] frontend: DetailPanel / WorldMap / DrankList / Header の「地域の集約値」前提の表示を豆単位に
- [x] frontend: 描画レイヤーをメモ化・世界コピーを5枚→3枚に削減
- [x] 検証: precompute 実行ログ、`npm run build`、`npm run lint`、実ブラウザ描画

## Review
- ノード: 128（国×admin1の平均値）→ 1206（豆1件ずつ）。集約は完全に廃止。
- クラスタ: 豆単位の偏差6軸 → StandardScaler → UMAP(2D) → HDBSCAN(min_cluster_size=20)
  → 近いクラスタをWard法で6個へ丸め込み。分布は 264/242/188/129/114/75 + ノイズ194。
  ノードの色は従来どおり dominant_cluster（豆単位で計算したクラスタ）に対応。
- エッジ: 標準化済み偏差6軸空間の k-NN（各豆の上位3件）。無向・重複除去して 2626 本。
  近傍探索の基準を UMAP 2D距離から味覚特徴量空間に変更したので、
  地図の網・「味が近い豆」・選択時の弧はすべて同じ距離定義になった。
- 座標: 各豆の産地(admin1)の緯度経度。同一地域の豆は統合せず、
  半径 0.10*sqrt(連番) 度（最大1.2度）の渦巻きでずらして重なりを回避（1206点すべて別座標）。
- 描画: circle 3618個・path 7878本（1206点/2626辺 × 世界コピー3枚）を確認。
  弧線・点レイヤーを useMemo 化し、ホバー時に作り直さないようにした。

### 積み残し（今回は触っていない）
- `scripts/validate_grouping.py` は「地域集約の妥当性」を検証するスクリプトで、集約廃止により前提が失効。
  `scripts/validate_clustering.py` も設定値が本体と乖離したまま（元から乖離していた）。
- `StartupGuide` の説明文が「国ごとの縞模様」「精製方法が並びます」と古い UI のままになっている。
