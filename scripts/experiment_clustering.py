"""
クラスタリング検証実験（読み取り専用・本体には影響しない）。

現行 precompute_data.py の前処理（国×admin1で集約 → 偏差6軸 → StandardScaler）を
再現したうえで、2つの実験を行い表で出力する。

  実験1: MIN_SAMPLE_COUNT を {1,2,3,4} で振り、
         ノード数 / ノイズ率 / silhouette / DB / 平均振幅 の変化を見る。
         （クラスタリング法は現行と同じ: 2D UMAP(md=0.1) 上 HDBSCAN → 6個へWard統合）

  実験2: クラスタリング空間 {偏差6軸直, 2D UMAP(md=0.1), 3D UMAP(md=0)}
         × 目標クラスタ数 {3,4,5,6} を総当たりし、
         silhouette / DB / ノイズ率 / 平均振幅 のベスト構成を探す。
         （MIN_SAMPLE_COUNT は現行=1 に固定）

評価指標はすべて「特徴量空間 = 標準化した偏差6軸」で計算（クラスタリングをどの空間で
行っても比較軸を揃えるため）。silhouette/振幅 が高く、DB/ノイズ率 が低い構成が良い。

使い方: python scripts/experiment_clustering.py
"""

import warnings
import numpy as np
import pandas as pd
import umap
import hdbscan
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics import silhouette_score, davies_bouldin_score

warnings.filterwarnings("ignore")

TASTE_COLS = ["Aroma", "Flavor", "Aftertaste", "Acidity", "Body", "Balance"]
DEV_COLS = [f"{c}_dev" for c in TASTE_COLS]
GROUP_COLS = ["Country.of.Origin", "Region_admin1"]
INPUT_CSV = "data/merged_data_cleaned.csv"
HDBSCAN_PARAMS = dict(min_cluster_size=4, min_samples=1)
SEED = 42


def build_grouped():
    """precompute_data.py [2][3] の再現: 偏差6軸を作り 国×admin1 で集約。"""
    df = pd.read_csv(INPUT_CSV)
    df = df.dropna(subset=GROUP_COLS + TASTE_COLS).copy()
    df["row_mean"] = df[TASTE_COLS].mean(axis=1)
    for col in TASTE_COLS:
        df[f"{col}_dev"] = df[col] - df["row_mean"]
    agg = {c: "mean" for c in DEV_COLS}
    grouped = df.groupby(GROUP_COLS).agg(agg)
    grouped["sample_count"] = df.groupby(GROUP_COLS).size()
    return grouped.reset_index()


def embed(X_scaled, space):
    if space == "feat6":
        return X_scaled
    if space == "umap2d_md0.1":
        return umap.UMAP(n_components=2, n_neighbors=15, min_dist=0.1,
                         random_state=SEED).fit_transform(X_scaled)
    if space == "umap3d_md0":
        return umap.UMAP(n_components=3, n_neighbors=15, min_dist=0.0,
                         random_state=SEED).fit_transform(X_scaled)
    raise ValueError(space)


def cluster(X_space, target_k):
    """HDBSCAN で細かく割り、必要なら Ward で target_k へ統合。ハードラベルを返す。"""
    clusterer = hdbscan.HDBSCAN(prediction_data=True, **HDBSCAN_PARAMS)
    labels = clusterer.fit_predict(X_space)
    membership = hdbscan.all_points_membership_vectors(clusterer)
    if membership.ndim == 1:
        membership = membership.reshape(-1, 1)
    n_nat = membership.shape[1]

    if target_k and 0 < target_k < n_nat:
        centroids = np.array([X_space[labels == c].mean(axis=0)
                              for c in range(n_nat)])
        merge_map = AgglomerativeClustering(
            n_clusters=target_k, linkage="ward").fit_predict(centroids)
        labels = np.array([-1 if c == -1 else int(merge_map[c]) for c in labels])
        k = target_k
    else:
        k = n_nat
    return labels, n_nat, k


def evaluate(X_feat, dev_raw, labels):
    """評価はすべて特徴量空間(X_feat=標準化偏差6軸)で。振幅は生偏差で解釈しやすく。"""
    mask = labels != -1
    uniq = sorted(set(labels[mask]))
    n_clusters = len(uniq)
    n_noise = int((~mask).sum())
    n = len(labels)
    out = {"n": n, "k": n_clusters, "noise": n_noise,
           "noise_pct": 100.0 * n_noise / n}
    if n_clusters >= 2 and mask.sum() > n_clusters:
        out["silh"] = silhouette_score(X_feat[mask], labels[mask])
        out["db"] = davies_bouldin_score(X_feat[mask], labels[mask])
    else:
        out["silh"] = float("nan")
        out["db"] = float("nan")
    # 平均振幅: 各クラスタの偏差6軸平均の最大絶対値 → クラスタ間平均
    amps = []
    for c in uniq:
        m = dev_raw[labels == c].mean(axis=0)
        amps.append(np.abs(m).max())
    out["amp"] = float(np.mean(amps)) if amps else float("nan")
    return out


def main():
    grouped = build_grouped()
    print("=" * 84)
    print(f"元の集約ノード数（sample_count>=1）: {len(grouped)}")

    # ============ 実験1: MIN_SAMPLE_COUNT スイープ ============
    print("\n" + "=" * 84)
    print("[実験1] MIN_SAMPLE_COUNT スイープ（クラスタリング法は現行=2D UMAP md0.1 → 6統合）")
    print("=" * 84)
    print(f"{'minSample':>9} | {'ノード数':>7} | {'ノイズ':>10} | {'silh':>7} | "
          f"{'DB':>6} | {'平均振幅':>7}")
    print("-" * 84)
    for thr in (1, 2, 3, 4):
        nodes = grouped[grouped["sample_count"] >= thr].reset_index(drop=True)
        X_scaled = StandardScaler().fit_transform(nodes[DEV_COLS].values)
        dev_raw = nodes[DEV_COLS].values
        X_sp = embed(X_scaled, "umap2d_md0.1")
        labels, n_nat, k = cluster(X_sp, target_k=6)
        m = evaluate(X_scaled, dev_raw, labels)
        print(f"{thr:>9} | {m['n']:>7} | {m['noise']:>3}"
              f"({m['noise_pct']:>4.1f}%) | {m['silh']:>+7.3f} | "
              f"{m['db']:>6.3f} | {m['amp']:>7.3f}")
    print("  ※ノード数=地図に出る点の数。silh/振幅↑・DB/ノイズ↓ が良い")

    # ============ 実験2: 空間 × クラスタ数 総当たり ============
    print("\n" + "=" * 84)
    print("[実験2] クラスタリング空間 × 目標クラスタ数（MIN_SAMPLE_COUNT=1 固定）")
    print("=" * 84)
    nodes = grouped[grouped["sample_count"] >= 1].reset_index(drop=True)
    X_scaled = StandardScaler().fit_transform(nodes[DEV_COLS].values)
    dev_raw = nodes[DEV_COLS].values

    spaces = ["feat6", "umap2d_md0.1", "umap3d_md0"]
    print(f"{'空間':>13} | {'目標k':>5} | {'自然k':>5} | {'実k':>4} | "
          f"{'ノイズ':>10} | {'silh':>7} | {'DB':>6} | {'振幅':>6}")
    print("-" * 84)
    results = []
    for space in spaces:
        X_sp = embed(X_scaled, space)
        for tk in (3, 4, 5, 6):
            labels, n_nat, k = cluster(X_sp, target_k=tk)
            m = evaluate(X_scaled, dev_raw, labels)
            results.append((space, tk, n_nat, m))
            print(f"{space:>13} | {tk:>5} | {n_nat:>5} | {m['k']:>4} | "
                  f"{m['noise']:>3}({m['noise_pct']:>4.1f}%) | {m['silh']:>+7.3f} | "
                  f"{m['db']:>6.3f} | {m['amp']:>6.3f}")
        print("-" * 84)

    # ベスト構成（silhouette最大、次いで振幅）
    valid = [(s, tk, m) for (s, tk, _, m) in results if m["silh"] == m["silh"]]
    best = max(valid, key=lambda r: (r[2]["silh"], r[2]["amp"]))
    print(f"\n★ silhouette最大の構成: 空間={best[0]}  目標k={best[1]}  "
          f"→ silh={best[2]['silh']:+.3f}  DB={best[2]['db']:.3f}  "
          f"ノイズ={best[2]['noise_pct']:.1f}%  振幅={best[2]['amp']:.3f}")
    print("=" * 84)


if __name__ == "__main__":
    main()
