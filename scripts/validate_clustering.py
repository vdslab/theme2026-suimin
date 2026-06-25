"""
クラスタリング妥当性の検証スクリプト（読み取り専用・本体には影響しない）。

precompute_data.py の前処理を再現したうえで、以下を出力する:

  A. 手法の妥当性比較
       現状(2D UMAP上でHDBSCAN) vs 特徴量空間で直接 vs 中次元UMAP(min_dist=0)
       を ARI / AMI で突き合わせ、各内部指標も併記。
  B. 内部指標（必ず特徴量空間=スケール済み偏差6軸で計算）
       Silhouette / Davies-Bouldin / Calinski-Harabasz / HDBSCANの cluster_persistence_
  C. 安定性
       シードを変えて現状パイプラインを再実行し、基準ラベルとの ARI 分布を見る。
  D. ヒストグラム（PNG出力）
       1 メンバーシップ確率  2 点ごとのシルエット  3 GLOSH外れ値スコア
       4 特徴量空間のkNN距離  5 ペア距離  6 クラスタサイズ
       + 6軸偏差のクラスタ別分布

使い方:
    python scripts/validate_clustering.py
"""

import warnings
import numpy as np
import pandas as pd
import umap
import hdbscan
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.spatial.distance import pdist
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    adjusted_rand_score,
    adjusted_mutual_info_score,
    silhouette_score,
    silhouette_samples,
    davies_bouldin_score,
    calinski_harabasz_score,
)

warnings.filterwarnings("ignore")  # UMAP/numba の冗長な警告を抑制

# --- 設定（precompute_data.py と一致させる） --------------------------
TASTE_COLS = ["Aroma", "Flavor", "Aftertaste", "Acidity", "Body", "Balance"]
DEV_COLS = [f"{c}_dev" for c in TASTE_COLS]
GROUP_COLS = ["Country.of.Origin", "Processing.Method"]
MIN_SAMPLE_COUNT = 3
INPUT_CSV = "data/merged_data_cleaned.csv"

UMAP_PARAMS = dict(n_components=2, n_neighbors=15, min_dist=0.1)  # 本体と同一
HDBSCAN_PARAMS = dict(min_cluster_size=4, min_samples=1)         # 本体と同一
RANDOM_STATE = 42
N_SEEDS = 30  # 安定性チェックの試行数

HIST_PNG = "scripts/validate_quality_histograms.png"
AXIS_PNG = "scripts/validate_axis_by_cluster.png"
STAB_PNG = "scripts/validate_stability_ari.png"


# ---------------------------------------------------------------------
# 前処理（precompute_data.py [2]-[5] の再現）
# ---------------------------------------------------------------------
def build_nodes():
    df = pd.read_csv(INPUT_CSV)
    df = df.dropna(subset=GROUP_COLS + TASTE_COLS).copy()

    df["row_mean"] = df[TASTE_COLS].mean(axis=1)
    for col in TASTE_COLS:
        df[f"{col}_dev"] = df[col] - df["row_mean"]

    agg_spec = {c: "mean" for c in DEV_COLS}
    grouped = df.groupby(GROUP_COLS).agg(agg_spec)
    grouped["sample_count"] = df.groupby(GROUP_COLS).size()
    grouped = grouped.reset_index()

    nodes = grouped[grouped["sample_count"] >= MIN_SAMPLE_COUNT].reset_index(drop=True)
    X_scaled = StandardScaler().fit_transform(nodes[DEV_COLS].values)
    return nodes, X_scaled


def umap_embed(X_scaled, n_components, min_dist, n_neighbors, seed):
    mapper = umap.UMAP(
        n_components=n_components, n_neighbors=n_neighbors,
        min_dist=min_dist, random_state=seed,
    )
    return mapper.fit_transform(X_scaled)


def run_hdbscan(X, prediction_data=False):
    clusterer = hdbscan.HDBSCAN(prediction_data=prediction_data, **HDBSCAN_PARAMS)
    labels = clusterer.fit_predict(X)
    return clusterer, labels


# ---------------------------------------------------------------------
# 内部指標（特徴量空間で計算。ノイズ-1は除外）
# ---------------------------------------------------------------------
def internal_metrics(X_feat, labels):
    mask = labels != -1
    n_clusters = len(set(labels[mask]))
    out = {"n_clusters": n_clusters,
           "n_noise": int((labels == -1).sum()),
           "n_used": int(mask.sum())}
    if n_clusters >= 2 and mask.sum() > n_clusters:
        Xm, ym = X_feat[mask], labels[mask]
        out["silhouette"] = float(silhouette_score(Xm, ym))
        out["davies_bouldin"] = float(davies_bouldin_score(Xm, ym))
        out["calinski_harabasz"] = float(calinski_harabasz_score(Xm, ym))
    else:
        out["silhouette"] = out["davies_bouldin"] = out["calinski_harabasz"] = float("nan")
    return out


def fmt_metrics(name, m, persistence=None):
    line = (f"  {name:<34} clusters={m['n_clusters']:>2}  noise={m['n_noise']:>2}  "
            f"silh={m['silhouette']:+.3f}  DB={m['davies_bouldin']:.3f}  "
            f"CH={m['calinski_harabasz']:7.2f}")
    if persistence is not None and len(persistence):
        line += f"  persist(mean)={np.mean(persistence):.3f}"
    return line


# ---------------------------------------------------------------------
# D. ヒストグラム群
# ---------------------------------------------------------------------
def plot_quality_histograms(X_feat, clusterer_2d, labels_2d):
    probs = clusterer_2d.probabilities_
    outliers = clusterer_2d.outlier_scores_
    outliers = outliers[np.isfinite(outliers)]

    # 点ごとシルエット（特徴量空間、クラスタ>=2のとき）
    mask = labels_2d != -1
    sil_samples = None
    if len(set(labels_2d[mask])) >= 2 and mask.sum() > len(set(labels_2d[mask])):
        sil_samples = silhouette_samples(X_feat[mask], labels_2d[mask])

    # kNN距離（k=5）とペア距離（特徴量空間）
    from sklearn.neighbors import NearestNeighbors
    k = min(6, len(X_feat))  # 自分自身を含むので+1
    nn = NearestNeighbors(n_neighbors=k).fit(X_feat)
    dist, _ = nn.kneighbors(X_feat)
    knn_dist = dist[:, -1]  # k番目の近傍までの距離
    pair_dist = pdist(X_feat)

    # クラスタサイズ
    sizes = pd.Series(labels_2d[labels_2d != -1]).value_counts().sort_index()

    fig, axes = plt.subplots(2, 3, figsize=(15, 9))

    ax = axes[0, 0]
    ax.hist(probs, bins=20, color="#4C78A8", edgecolor="white")
    ax.set_title("1. HDBSCAN membership probability\n(peak near 1 = decisive / low = weak assignment)")
    ax.set_xlabel("probability"); ax.set_ylabel("count")
    ax.axvline(probs.mean(), color="red", ls="--", lw=1, label=f"mean={probs.mean():.2f}")
    ax.legend(fontsize=8)

    ax = axes[0, 1]
    if sil_samples is not None:
        ax.hist(sil_samples, bins=20, color="#54A24B", edgecolor="white")
        ax.axvline(0, color="black", lw=1)
        ax.axvline(sil_samples.mean(), color="red", ls="--", lw=1,
                   label=f"mean={sil_samples.mean():+.2f}")
        ax.legend(fontsize=8)
        ax.set_title("2. Per-point silhouette (feature space)\n(>0 = fits cluster / <0 = likely mis-assigned)")
    else:
        ax.text(0.5, 0.5, "silhouette N/A\n(clusters<2)", ha="center", va="center")
        ax.set_title("2. Per-point silhouette")
    ax.set_xlabel("silhouette"); ax.set_ylabel("count")

    ax = axes[0, 2]
    if len(outliers):
        ax.hist(outliers, bins=20, color="#E45756", edgecolor="white")
        ax.set_title("3. GLOSH outlier score\n(higher = more outlier-like)")
    else:
        ax.text(0.5, 0.5, "outlier scores N/A", ha="center", va="center")
        ax.set_title("3. GLOSH outlier score")
    ax.set_xlabel("outlier score"); ax.set_ylabel("count")

    ax = axes[1, 0]
    ax.hist(knn_dist, bins=20, color="#B279A2", edgecolor="white")
    ax.set_title(f"4. {k-1}-NN distance (feature space)\n(bimodal = density varies / unimodal = weak structure)")
    ax.set_xlabel("distance to k-th neighbor"); ax.set_ylabel("count")

    ax = axes[1, 1]
    ax.hist(pair_dist, bins=30, color="#FF9DA6", edgecolor="white")
    ax.set_title("5. Pairwise distance (feature space)\n(multimodal = separated blobs)")
    ax.set_xlabel("pairwise distance"); ax.set_ylabel("count")

    ax = axes[1, 2]
    ax.bar([f"C{c}" for c in sizes.index], sizes.values, color="#9D755D", edgecolor="white")
    ax.set_title("6. Cluster size")
    ax.set_xlabel("cluster"); ax.set_ylabel("count")

    fig.suptitle("Clustering quality histograms (current = HDBSCAN on 2D UMAP)", fontsize=13)
    fig.tight_layout(rect=[0, 0, 1, 0.97])
    fig.savefig(HIST_PNG, dpi=130)
    plt.close(fig)
    print(f"    [OK] {HIST_PNG}")


def plot_axis_by_cluster(nodes, labels_2d):
    """6軸偏差のクラスタ別分布。クラスタが味の軸で実際に分かれているかを見る。"""
    clusters = sorted(c for c in set(labels_2d) if c != -1)
    cmap = plt.get_cmap("tab10")

    fig, axes = plt.subplots(2, 3, figsize=(15, 8))
    for ax, dev_col, taste in zip(axes.ravel(), DEV_COLS, TASTE_COLS):
        vals_all = nodes[dev_col].values
        bins = np.linspace(vals_all.min(), vals_all.max(), 12)
        for i, c in enumerate(clusters):
            vals = nodes.loc[labels_2d == c, dev_col].values
            ax.hist(vals, bins=bins, alpha=0.55, color=cmap(i % 10),
                    label=f"C{c}", edgecolor="white")
        ax.axvline(0, color="black", lw=1)
        ax.set_title(f"{taste}_dev")
        ax.set_xlabel("deviation"); ax.set_ylabel("count")
    axes.ravel()[0].legend(fontsize=8, title="cluster")
    fig.suptitle("Per-axis deviation distribution by cluster (more overlap = weaker separation)", fontsize=13)
    fig.tight_layout(rect=[0, 0, 1, 0.96])
    fig.savefig(AXIS_PNG, dpi=130)
    plt.close(fig)
    print(f"    [OK] {AXIS_PNG}")


# ---------------------------------------------------------------------
# C. 安定性
# ---------------------------------------------------------------------
def stability_analysis(X_scaled, baseline_labels):
    aris = []
    for seed in range(1, N_SEEDS + 1):
        X2 = umap_embed(X_scaled, seed=seed, **UMAP_PARAMS)
        _, lab = run_hdbscan(X2)
        aris.append(adjusted_rand_score(baseline_labels, lab))
    aris = np.array(aris)

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.hist(aris, bins=15, range=(0, 1), color="#F58518", edgecolor="white")
    ax.axvline(aris.mean(), color="red", ls="--",
               label=f"mean={aris.mean():.3f}  (sd={aris.std():.3f})")
    ax.set_title(f"Stability: ARI of {N_SEEDS} reseeded runs vs baseline (seed={RANDOM_STATE})\n"
                 "near 1 = reproducible / low & spread = seed-dependent")
    ax.set_xlabel("Adjusted Rand Index"); ax.set_ylabel("count")
    ax.legend()
    fig.tight_layout()
    fig.savefig(STAB_PNG, dpi=130)
    plt.close(fig)
    print(f"    [OK] {STAB_PNG}")
    return aris


# ---------------------------------------------------------------------
def main():
    print("=" * 78)
    print("[準備] ノード構築")
    nodes, X_scaled = build_nodes()
    print(f"    ノード数 N = {len(nodes)} / 偏差6軸 + StandardScaler")

    # --- 3つのラベリングを用意 ---------------------------------------
    print("\n[A] 手法比較: ラベリングを3通り生成")
    # (1) 現状: 可視化用2D UMAP上でHDBSCAN
    X_2d = umap_embed(X_scaled, seed=RANDOM_STATE, **UMAP_PARAMS)
    clusterer_2d, labels_2d = run_hdbscan(X_2d, prediction_data=True)
    # (2) 特徴量空間で直接HDBSCAN
    clusterer_feat, labels_feat = run_hdbscan(X_scaled, prediction_data=True)
    # (3) 中次元UMAP(min_dist=0, 3D)でHDBSCAN（mock方式）
    X_3d = umap_embed(X_scaled, n_components=3, n_neighbors=15,
                      min_dist=0.0, seed=RANDOM_STATE)
    clusterer_3d, labels_3d = run_hdbscan(X_3d, prediction_data=True)

    print("    --- 一致度 (ARI / AMI) ---")
    print(f"      現状(2D)  vs 特徴量空間 : ARI={adjusted_rand_score(labels_2d, labels_feat):+.3f}"
          f"  AMI={adjusted_mutual_info_score(labels_2d, labels_feat):+.3f}")
    print(f"      現状(2D)  vs 中次元(3D) : ARI={adjusted_rand_score(labels_2d, labels_3d):+.3f}"
          f"  AMI={adjusted_mutual_info_score(labels_2d, labels_3d):+.3f}")
    print(f"      特徴量空間 vs 中次元(3D): ARI={adjusted_rand_score(labels_feat, labels_3d):+.3f}"
          f"  AMI={adjusted_mutual_info_score(labels_feat, labels_3d):+.3f}")
    print("    （現状と他で大きくズレる＝2D埋め込みがクラスタ結果を左右している兆候）")

    print("\n[B] 内部指標（すべて特徴量空間=スケール済み偏差6軸で計算）")
    print(fmt_metrics("(1) 現状: 2D UMAP上HDBSCAN", internal_metrics(X_scaled, labels_2d),
                      clusterer_2d.cluster_persistence_))
    print(fmt_metrics("(2) 特徴量空間で直接", internal_metrics(X_scaled, labels_feat),
                      clusterer_feat.cluster_persistence_))
    print(fmt_metrics("(3) 中次元UMAP(3D,min_dist=0)", internal_metrics(X_scaled, labels_3d),
                      clusterer_3d.cluster_persistence_))
    print("    silh: 高いほど良 / DB: 低いほど良 / CH: 高いほど良 / persist: 高いほどクラスタが頑健")

    print("\n[C] 安定性（現状パイプラインをシード違いで再実行）")
    aris = stability_analysis(X_scaled, labels_2d)
    print(f"    ARI mean={aris.mean():.3f}  sd={aris.std():.3f}  "
          f"min={aris.min():.3f}  max={aris.max():.3f}")

    print("\n[D] ヒストグラム出力")
    plot_quality_histograms(X_scaled, clusterer_2d, labels_2d)
    plot_axis_by_cluster(nodes, labels_2d)

    print("=" * 78)
    print("完了。生成物:")
    for p in (HIST_PNG, AXIS_PNG, STAB_PNG):
        print(f"  - {p}")
    print("=" * 78)


if __name__ == "__main__":
    main()
