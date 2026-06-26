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

# 本体と同一。クラスタリングは3D(min_dist=0)、表示用に2D(min_dist=0.1)を併用。
CLUSTER_UMAP_PARAMS = dict(n_components=3, n_neighbors=15, min_dist=0.0)  # 本体のクラスタリング空間
DISPLAY_UMAP_PARAMS = dict(n_components=2, n_neighbors=15, min_dist=0.1)  # 本体の表示座標
OLD_UMAP_PARAMS = dict(n_components=2, n_neighbors=15, min_dist=0.1)      # 旧方式(2D上でHDBSCAN)
HDBSCAN_PARAMS = dict(min_cluster_size=4, min_samples=1)                 # 本体と同一
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
def _reseed_aris(X_scaled, baseline_labels, umap_params):
    """同じパイプラインをシード違いで再実行し、基準ラベルとのARI分布を返す。"""
    aris = []
    for seed in range(1, N_SEEDS + 1):
        Xe = umap_embed(X_scaled, seed=seed, **umap_params)
        _, lab = run_hdbscan(Xe)
        aris.append(adjusted_rand_score(baseline_labels, lab))
    return np.array(aris)


def stability_analysis(X_scaled, baseline_new, baseline_old):
    """新方式(3D,min_dist=0)と旧方式(2D)の安定性を並べて比較する。"""
    aris_new = _reseed_aris(X_scaled, baseline_new, CLUSTER_UMAP_PARAMS)
    aris_old = _reseed_aris(X_scaled, baseline_old, OLD_UMAP_PARAMS)

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.hist(aris_old, bins=15, range=(0, 1), color="#BAB0AC", edgecolor="white",
            alpha=0.8, label=f"old 2D: mean={aris_old.mean():.3f} sd={aris_old.std():.3f}")
    ax.hist(aris_new, bins=15, range=(0, 1), color="#F58518", edgecolor="white",
            alpha=0.8, label=f"new 3D(md=0): mean={aris_new.mean():.3f} sd={aris_new.std():.3f}")
    ax.axvline(aris_new.mean(), color="red", ls="--", lw=1)
    ax.axvline(aris_old.mean(), color="black", ls="--", lw=1)
    ax.set_title(f"Stability: ARI of {N_SEEDS} reseeded runs vs baseline (seed={RANDOM_STATE})\n"
                 "near 1 = reproducible / low & spread = seed-dependent")
    ax.set_xlabel("Adjusted Rand Index"); ax.set_ylabel("count")
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(STAB_PNG, dpi=130)
    plt.close(fig)
    print(f"    [OK] {STAB_PNG}")
    return aris_new, aris_old


# ---------------------------------------------------------------------
def main():
    print("=" * 78)
    print("[準備] ノード構築")
    nodes, X_scaled = build_nodes()
    print(f"    ノード数 N = {len(nodes)} / 偏差6軸 + StandardScaler")

    # --- 3つのラベリングを用意 ---------------------------------------
    print("\n[A] 手法比較: ラベリングを3通り生成")
    # (1) 旧方式: 可視化用2D UMAP上でHDBSCAN
    X_2d = umap_embed(X_scaled, seed=RANDOM_STATE, **OLD_UMAP_PARAMS)
    clusterer_2d, labels_2d = run_hdbscan(X_2d, prediction_data=True)
    # (2) 特徴量空間で直接HDBSCAN
    clusterer_feat, labels_feat = run_hdbscan(X_scaled, prediction_data=True)
    # (3) 新方式(本体): 中次元UMAP(3D, min_dist=0)でHDBSCAN
    X_3d = umap_embed(X_scaled, seed=RANDOM_STATE, **CLUSTER_UMAP_PARAMS)
    clusterer_3d, labels_3d = run_hdbscan(X_3d, prediction_data=True)

    print("    --- 一致度 (ARI / AMI) ---")
    print(f"      旧(2D)    vs 特徴量空間 : ARI={adjusted_rand_score(labels_2d, labels_feat):+.3f}"
          f"  AMI={adjusted_mutual_info_score(labels_2d, labels_feat):+.3f}")
    print(f"      旧(2D)    vs 新(3D)     : ARI={adjusted_rand_score(labels_2d, labels_3d):+.3f}"
          f"  AMI={adjusted_mutual_info_score(labels_2d, labels_3d):+.3f}")
    print(f"      新(3D)    vs 特徴量空間 : ARI={adjusted_rand_score(labels_feat, labels_3d):+.3f}"
          f"  AMI={adjusted_mutual_info_score(labels_feat, labels_3d):+.3f}")
    print("    （新(3D)が特徴量空間と近いほど、本来の味距離に忠実なクラスタリング）")

    print("\n[B] 内部指標（すべて特徴量空間=スケール済み偏差6軸で計算）")
    print(fmt_metrics("(1) 旧方式: 2D UMAP上HDBSCAN", internal_metrics(X_scaled, labels_2d),
                      clusterer_2d.cluster_persistence_))
    print(fmt_metrics("(2) 特徴量空間で直接", internal_metrics(X_scaled, labels_feat),
                      clusterer_feat.cluster_persistence_))
    print(fmt_metrics("(3) 新方式: 3D UMAP(min_dist=0)", internal_metrics(X_scaled, labels_3d),
                      clusterer_3d.cluster_persistence_))
    print("    silh: 高いほど良 / DB: 低いほど良 / CH: 高いほど良 / persist: 高いほどクラスタが頑健")

    print("\n[C] 安定性（新3D方式 と 旧2D方式 をシード違いで再実行して比較）")
    aris_new, aris_old = stability_analysis(X_scaled, labels_3d, labels_2d)
    print(f"    新3D: ARI mean={aris_new.mean():.3f}  sd={aris_new.std():.3f}  "
          f"min={aris_new.min():.3f}  max={aris_new.max():.3f}")
    print(f"    旧2D: ARI mean={aris_old.mean():.3f}  sd={aris_old.std():.3f}  "
          f"min={aris_old.min():.3f}  max={aris_old.max():.3f}")

    # --- [E] 表示忠実度: 新3Dクラスタを「表示用2D座標」に乗せて崩れないか -------
    print("\n[E] 表示忠実度（新3Dクラスタを表示用2D UMAPに乗せた際の分離保持）")
    X_disp = umap_embed(X_scaled, seed=RANDOM_STATE, **DISPLAY_UMAP_PARAMS)
    mask = labels_3d != -1
    if len(set(labels_3d[mask])) >= 2:
        sil_feat = silhouette_score(X_scaled[mask], labels_3d[mask])
        sil_disp = silhouette_score(X_disp[mask], labels_3d[mask])
        print(f"    silhouette(新3Dラベル) 特徴量空間={sil_feat:+.3f}  表示2D座標={sil_disp:+.3f}")
        print("    （表示2Dでも正なら、地図上でもクラスタが概ね分離して見える＝表示が誤解を生まない）")
    else:
        print("    クラスタ数<2 のため評価不可")

    print("\n[D] ヒストグラム出力（本体=新3D方式のラベルで作成）")
    plot_quality_histograms(X_scaled, clusterer_3d, labels_3d)
    plot_axis_by_cluster(nodes, labels_3d)

    print("=" * 78)
    print("完了。生成物:")
    for p in (HIST_PNG, AXIS_PNG, STAB_PNG):
        print(f"  - {p}")
    print("=" * 78)


if __name__ == "__main__":
    main()
