
import os
import numpy as np
import pandas as pd
import umap
import hdbscan
import matplotlib
matplotlib.use("Agg")  # GUI不要のバックエンド
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from sklearn.preprocessing import StandardScaler

# --- 設定 ---------------------------------------------------------------
TASTE_COLS = ["Aroma", "Flavor", "Aftertaste", "Acidity", "Body", "Balance"]
DEV_COLS = [f"{c}_dev" for c in TASTE_COLS]
GROUP_COLS = ["Country.of.Origin", "Processing.Method"]
MIN_SAMPLE_COUNT = 1
INPUT_CSV = "data/merged_data_cleaned.csv"
OUTPUT_JSON = "src/data/coffee_data.json"
HEATMAP_PNG = "scripts/cluster_deviation_heatmap.png"
SCATTER_PNG = "scripts/cluster_scatter.png"

# カラーパレット（クラスタごとの基準色）
HEX_PALETTE = [
    "#1F77B4", "#FF7F0E", "#2CA02C", "#D62728", "#9467BD",
    "#8C564B", "#E377C2", "#7F7F7F", "#BCBD22", "#17BECF",
]


# 各味覚軸を「飲んだ味が想像できる」表現に対応づける
AXIS_DESC = {
    "Aroma": "華やかな香り",
    "Flavor": "豊かな風味",
    "Aftertaste": "長い余韻",
    "Acidity": "明るい酸味",
    "Body": "しっかりしたコク",
    "Balance": "整ったバランス",
}
# 2番目の軸を名前に含める閾値（偏差がこの値以上なら「際立っている」とみなす）
SECOND_AXIS_THRESHOLD = 0.02


def assign_cluster_name(dev_mean: pd.Series, c: int) -> str:
    ordered = dev_mean.sort_values(ascending=False)
    bases = [idx.replace("_dev", "") for idx in ordered.index]
    vals = ordered.values

    d1 = AXIS_DESC[bases[0]]
    if vals[1] >= SECOND_AXIS_THRESHOLD:
        d2 = AXIS_DESC[bases[1]]
        label = f"{d1}と{d2}が際立つタイプ"
    else:
        label = f"{d1}が主役のタイプ"
    return f"{label} (C{c})"


def english_short_label(dev_mean: pd.Series) -> str:
    """ヒートマップ/散布図用の英語短ラベル（上位1〜2軸）。matplotlib文字化け回避。"""
    ordered = dev_mean.sort_values(ascending=False)
    bases = [idx.replace("_dev", "") for idx in ordered.index]
    if ordered.values[1] >= SECOND_AXIS_THRESHOLD:
        return f"{bases[0]}+{bases[1]}"
    return bases[0]


def plot_scatter(nodes, cluster_names, has_tcp):
    """UMAP(2D)座標の散布図。クラスタごとに色分けして空間的なまとまりを確認する。

    クラスタリングはこの2D埋め込み上で行っているため、
    理想どおり「同じクラスタが近くにまとまる」かを直接確認できる。
    """
    fig, ax = plt.subplots(figsize=(11, 8))

    # クラスタごとに散布（ハードラベル基準。-1 はノイズ）
    for c in sorted(cluster_names):
        sub = nodes[nodes["_cluster_label"] == c]
        color = HEX_PALETTE[c % len(HEX_PALETTE)]
        label = f"C{c}: {english_short_label(sub[DEV_COLS].mean())} (n={len(sub)})"
        ax.scatter(sub["x"], sub["y"], s=90, c=color, edgecolors="white",
                   linewidths=0.8, alpha=0.9, label=label, zorder=3)

    noise = nodes[nodes["_cluster_label"] == -1]
    if len(noise):
        ax.scatter(noise["x"], noise["y"], s=70, c="lightgrey",
                   edgecolors="white", linewidths=0.8, alpha=0.7,
                   label=f"Noise (n={len(noise)})", zorder=2)

    # 産地を薄く注記（読みやすさのため小さめ）
    for _, r in nodes.iterrows():
        ax.annotate(r["Country.of.Origin"], (r["x"], r["y"]),
                    fontsize=6, alpha=0.55, xytext=(4, 3),
                    textcoords="offset points")

    ax.set_title("Coffee taste-shape map (UMAP 2D of deviation features)\n"
                 "colored by HDBSCAN cluster")
    ax.set_xlabel("UMAP-1")
    ax.set_ylabel("UMAP-2")
    ax.legend(loc="best", fontsize=8, framealpha=0.9)
    fig.tight_layout()
    fig.savefig(SCATTER_PNG, dpi=130)
    plt.close(fig)
    print(f"    [OK] {SCATTER_PNG} 保存完了")


def plot_heatmap(nodes, cluster_names, has_tcp):
    # クラスタ × 偏差6軸 のヒートマップを描画して PNG 保存する。
    cluster_ids = sorted(cluster_names)
    if not cluster_ids:
        print("    [skip] クラスタが無いためヒートマップは省略")
        return

    rows, ylabels = [], []
    for c in cluster_ids:
        sub = nodes[nodes["_cluster_label"] == c]
        dev_mean = sub[DEV_COLS].mean()
        rows.append(dev_mean.values)
        label = f"C{c}: {english_short_label(dev_mean)}  (n={len(sub)}"
        if has_tcp:
            label += f", TCP={sub['Total.Cup.Points'].mean():.1f}"
        label += ")"
        ylabels.append(label)

    mat = np.array(rows)
    vmax = np.abs(mat).max()

    fig, ax = plt.subplots(figsize=(9, 1.1 * len(rows) + 2))
    im = ax.imshow(mat, cmap="RdBu_r", vmin=-vmax, vmax=vmax, aspect="auto")

    ax.set_xticks(range(len(TASTE_COLS)))
    ax.set_xticklabels(TASTE_COLS, rotation=30, ha="right")
    ax.set_yticks(range(len(ylabels)))
    ax.set_yticklabels(ylabels)

    # 各セルに数値を注記
    for i in range(mat.shape[0]):
        for j in range(mat.shape[1]):
            val = mat[i, j]
            ax.text(j, i, f"{val:+.3f}", ha="center", va="center",
                    fontsize=8,
                    color="white" if abs(val) > vmax * 0.6 else "black")

    ax.set_title("Cluster mean of deviation features (taste shape)\n"
                 "+ = relatively strong in the bean, - = relatively weak")
    fig.colorbar(im, ax=ax, label="deviation from bean's 6-axis mean")
    fig.tight_layout()
    fig.savefig(HEATMAP_PNG, dpi=130)
    plt.close(fig)
    print(f"    [OK] {HEATMAP_PNG} 保存完了")


def main():
    print("=" * 70)
    print("[1] データ読み込み:", INPUT_CSV)
    df = pd.read_csv(INPUT_CSV)
    df = df.dropna(subset=GROUP_COLS + TASTE_COLS).copy()
    df["Variety"] = df["Variety"].fillna("Unknown")

    # 総合品質スコア（補助情報）。Total.Cup.Points があれば使う。
    has_tcp = "Total.Cup.Points" in df.columns

    # ------------------------------------------------------------------
    # [2] 個別豆ごとに偏差6軸を作成
    #     row_mean = mean(6軸), *_dev = 各軸 - row_mean
    # ------------------------------------------------------------------
    print("[2] 個別豆ごとに偏差特徴量(*_dev)を作成")
    df["row_mean"] = df[TASTE_COLS].mean(axis=1)
    for col in TASTE_COLS:
        df[f"{col}_dev"] = df[col] - df["row_mean"]

    # 確認: 偏差6軸の各行合計はほぼ0になるはず
    dev_row_sums = df[DEV_COLS].sum(axis=1)
    print(f"    偏差6軸の行合計  mean={dev_row_sums.mean():.2e}  "
          f"abs max={dev_row_sums.abs().max():.2e}  (理論上0)")

    # ------------------------------------------------------------------
    # [3] 産地 × 精製方法 で集約（先に偏差を取ってから平均する）
    # ------------------------------------------------------------------
    print("[3] 産地 × 精製方法 で集約")
    agg_spec = {c: "mean" for c in TASTE_COLS}          # 元6軸スコア平均
    agg_spec.update({c: "mean" for c in DEV_COLS})       # 偏差6軸平均
    agg_spec["row_mean"] = "mean"                        # 6軸平均そのものの平均
    if has_tcp:
        agg_spec["Total.Cup.Points"] = "mean"

    grouped = df.groupby(GROUP_COLS).agg(agg_spec)
    grouped["sample_count"] = df.groupby(GROUP_COLS).size()
    # 表示用メタデータ: グループ内のユニーク品種一覧
    grouped["varieties"] = df.groupby(GROUP_COLS)["Variety"].agg(
        lambda s: sorted(s.unique().tolist())
    )
    grouped = grouped.reset_index()
    print(f"    集約後のノード数: {len(grouped)}")

    # ------------------------------------------------------------------
    # [4] sample_count >= 3 のグループのみクラスタリング対象に
    # ------------------------------------------------------------------
    nodes = grouped[grouped["sample_count"] >= MIN_SAMPLE_COUNT].reset_index(drop=True)
    print(f"[4] sample_count >= {MIN_SAMPLE_COUNT} で残ったノード数: {len(nodes)}")

    # ------------------------------------------------------------------
    # [5] 集約ノードの偏差6軸に StandardScaler → UMAP(2D) → HDBSCAN
    # ------------------------------------------------------------------
    print("[5] StandardScaler → UMAP(2D) → HDBSCAN")
    X = nodes[DEV_COLS].values
    X_scaled = StandardScaler().fit_transform(X)

    mapper = umap.UMAP(
        n_components=2, n_neighbors=15, min_dist=0.1, random_state=42,
    )
    X_2d = mapper.fit_transform(X_scaled)
    nodes["x"] = X_2d[:, 0]
    nodes["y"] = X_2d[:, 1]

    clusterer = hdbscan.HDBSCAN(
        # HDBSCANのパラメータ決めるとこ
        min_cluster_size=5, min_samples=1, prediction_data=True,
    )
    cluster_labels = clusterer.fit_predict(X_2d)
    membership = hdbscan.all_points_membership_vectors(clusterer)
    # all_points_membership_vectors は 1クラスタ時に 1次元配列を返すことがある
    if membership.ndim == 1:
        membership = membership.reshape(-1, 1)
    n_clusters = membership.shape[1]

    n_noise = int((cluster_labels == -1).sum())
    print(f"    HDBSCANクラスタ数: {n_clusters}")
    print(f"    ノイズ扱いノード数: {n_noise} / {len(nodes)}")

    # ------------------------------------------------------------------
    # クラスタ名の割り当て（偏差6軸平均の最大特徴量で命名）
    # ------------------------------------------------------------------
    cluster_names = {}
    for c in sorted(set(cluster_labels)):
        if c == -1:
            continue
        dev_mean = nodes.loc[cluster_labels == c, DEV_COLS].mean()
        cluster_names[c] = assign_cluster_name(dev_mean, c)

    # ------------------------------------------------------------------
    # カラーブレンド & dominant cluster & probs
    # ------------------------------------------------------------------
    base_colors = [np.array(mcolors.to_rgb(HEX_PALETTE[i % len(HEX_PALETTE)]))
                   for i in range(n_clusters)]
    noise_color = np.array(mcolors.to_rgb("lightgrey"))

    colors, dominant_clusters, probs_list = [], [], []
    for i in range(len(nodes)):
        probs = membership[i]
        sum_probs = float(np.sum(probs))

        c = np.zeros(3)
        for j in range(n_clusters):
            c += probs[j] * base_colors[j]
        if sum_probs < 1.0:
            c += (1.0 - sum_probs) * noise_color
        c = np.clip(c, 0, 1)
        colors.append(f"rgb({int(c[0]*255)}, {int(c[1]*255)}, {int(c[2]*255)})")

        if sum_probs > 0.1 and n_clusters > 0:
            dominant_clusters.append(cluster_names[int(np.argmax(probs))])
        else:
            dominant_clusters.append("ノイズ (独自路線)")

        p_dict = {cluster_names[j]: float(probs[j]) for j in range(n_clusters)}
        p_dict["noise"] = float(max(0.0, 1.0 - sum_probs))
        probs_list.append(p_dict)

    nodes["dominant_cluster"] = dominant_clusters
    nodes["color"] = colors
    nodes["probs"] = probs_list
    nodes["_cluster_label"] = cluster_labels  # 確認ログ用

    # ------------------------------------------------------------------
    # [6] JSON 出力
    # ------------------------------------------------------------------
    print("[6] JSON 出力:", OUTPUT_JSON)
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)

    records = []
    for idx, row in nodes.iterrows():
        rec = {
            "id": int(idx),
            "country": row["Country.of.Origin"],
            "method": row["Processing.Method"],
            "varieties": row["varieties"],
            "sample_count": int(row["sample_count"]),
            "x": float(row["x"]),
            "y": float(row["y"]),
            # 元の6軸スコア平均（補助情報）
            "scores_mean": {c: float(row[c]) for c in TASTE_COLS},
            # 偏差6軸平均（クラスタリングに使った特徴量）
            "deviation_mean": {c: float(row[c]) for c in DEV_COLS},
            # 総合品質スコア（補助情報・クラスタリングには未使用）
            "overall_score_mean": float(row["row_mean"]),
            "dominant_cluster": row["dominant_cluster"],
            "color": row["color"],
            "probs": row["probs"],
        }
        if has_tcp:
            rec["total_cup_points_mean"] = float(row["Total.Cup.Points"])
        records.append(rec)

    pd.Series(records).to_json(
        OUTPUT_JSON, orient="values", force_ascii=False, indent=2
    )
    print(f"    [OK] {OUTPUT_JSON} 保存完了 (ノード数: {len(records)})")

    # ------------------------------------------------------------------
    # 確認ログ: 各クラスタの偏差6軸平均 / 総合品質スコア平均
    # ------------------------------------------------------------------
    print("=" * 70)
    print("[確認] 各クラスタの特性")
    for c in sorted(cluster_names):
        mask = nodes["_cluster_label"] == c
        sub = nodes[mask]
        dev_mean = sub[DEV_COLS].mean()
        line = "  ".join(f"{col.replace('_dev',''):<10}{dev_mean[col]:+.3f}"
                         for col in DEV_COLS)
        print(f"\n  {cluster_names[c]}  (n={len(sub)})")
        print(f"    偏差6軸平均: {line}")
        if has_tcp:
            print(f"    Total.Cup.Points 平均: {sub['Total.Cup.Points'].mean():.2f}")
        print(f"    6軸平均(品質目安) 平均: {sub['row_mean'].mean():.2f}")

    # ノイズの総合品質スコアも参考表示
    noise_mask = nodes["_cluster_label"] == -1
    if noise_mask.any() and has_tcp:
        print(f"\n  ノイズ (n={int(noise_mask.sum())})")
        print(f"    Total.Cup.Points 平均: "
              f"{nodes.loc[noise_mask, 'Total.Cup.Points'].mean():.2f}")

    if has_tcp:
        tcp_means = [nodes.loc[nodes['_cluster_label'] == c, 'Total.Cup.Points'].mean()
                     for c in sorted(cluster_names)]
        if len(tcp_means) >= 2:
            spread = max(tcp_means) - min(tcp_means)
            print(f"\n  [注意] クラスタ間の Total.Cup.Points 平均の差(spread): {spread:.2f}")
            print("         この値が大きい場合、まだ品質クラスタになっている可能性あり。")
    print("=" * 70)

    # ------------------------------------------------------------------
    # ヒートマップ出力（クラスタ × 偏差6軸）
    # ------------------------------------------------------------------
    print("[7] ヒートマップ出力:", HEATMAP_PNG)
    plot_heatmap(nodes, cluster_names, has_tcp)

    print("[8] 散布図出力:", SCATTER_PNG)
    plot_scatter(nodes, cluster_names, has_tcp)


if __name__ == "__main__":
    main()
