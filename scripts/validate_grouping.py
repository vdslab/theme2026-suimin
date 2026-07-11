"""
データのまとめ方（産地 × 精製方法 でのグループ集約）の妥当性検証スクリプト
（読み取り専用・本体には影響しない）。

問い:
    「産地・精製方法ごとに"味の形"の傾向は本当に違うのか？
     違うなら、グループ平均でまとめるのは妥当か？」

検証対象の特徴量:
    各豆の偏差6軸 *_dev（= 各味覚スコア - その豆の6軸平均）。
    これは本体 precompute_data.py がクラスタリングに使う「味の形」そのもの。
    （総合的な高低=品質ではなく、相対的な味の傾向を見るため偏差で評価する）

母集団:
    本体と同じく sample_count >= 3 の 産地×精製方法 グループに属する豆のみ。

出力:
    [A] グループ間で味が違うか
          一元配置ANOVA(F検定) + Kruskal-Wallis(非正規の裏取り) + 効果量 η²
    [B] 産地と精製方法のどちらが効くか
          産地のみ / 精製方法のみ で集約したときの η² を軸別に比較
    [C] 並べ替え検定（分布仮定なしで η² の有意性を確認）
    [D] ICC(1)：グループ平均という"まとめ方"自体の信頼性
    [E] sample_count >= 3 閾値の妥当性
          グループ平均の標準誤差(ノイズ) vs グループ間SD(信号)
    [F] 図出力（軸別ボックスプロット / η²棒グラフ）

使い方:
    python scripts/validate_grouping.py
"""

import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy import stats

warnings.filterwarnings("ignore")

# --- 設定（precompute_data.py と一致させる） --------------------------
TASTE_COLS = ["Aroma", "Flavor", "Aftertaste", "Acidity", "Body", "Balance"]
DEV_COLS = [f"{c}_dev" for c in TASTE_COLS]
GROUP_COLS = ["Country.of.Origin", "Processing.Method"]
MIN_SAMPLE_COUNT = 3
INPUT_CSV = "data/merged_data_cleaned.csv"

N_PERM = 2000          # 並べ替え検定の試行数
RANDOM_STATE = 42

BOX_PNG = "scripts/validate_grouping_boxplots.png"
ETA_PNG = "scripts/validate_grouping_eta2.png"
HIST_PNG = "scripts/validate_grouping_histograms.png"


# ---------------------------------------------------------------------
# 前処理（豆ごとに偏差化 → n>=3 のグループに属する豆だけ残す）
# ---------------------------------------------------------------------
def load_beans():
    df = pd.read_csv(INPUT_CSV).dropna(subset=GROUP_COLS + TASTE_COLS).copy()
    # 豆ごとに6軸平均との差（味の形）
    df["row_mean"] = df[TASTE_COLS].mean(axis=1)
    for col in TASTE_COLS:
        df[f"{col}_dev"] = df[col] - df["row_mean"]
    # 本体と同じ母集団: n>=3 の 産地×方法 グループに属する豆だけ
    g = df.groupby(GROUP_COLS).size()
    keep = g[g >= MIN_SAMPLE_COUNT].index
    df["_grp"] = list(zip(df[GROUP_COLS[0]], df[GROUP_COLS[1]]))
    df = df[df["_grp"].isin(set(keep))].reset_index(drop=True)
    return df


# ---------------------------------------------------------------------
# 効果量 η²（= グループで説明される分散の割合）と分散分解
# ---------------------------------------------------------------------
def eta_squared(values, group_key):
    """一元配置の η² と F, 自由度を返す。group_key は各サンプルのグループ。"""
    s = pd.Series(values)
    grand = s.mean()
    ss_total = float(((s - grand) ** 2).sum())
    groups = [s.values[group_key == k] for k in pd.unique(group_key)]
    ss_between = float(sum(len(g) * (g.mean() - grand) ** 2 for g in groups))
    K = len(groups)
    N = len(s)
    ss_within = ss_total - ss_between
    df_b, df_w = K - 1, N - K
    msb, msw = ss_between / df_b, ss_within / df_w
    F = msb / msw if msw > 0 else np.inf
    eta2 = ss_between / ss_total if ss_total > 0 else 0.0
    return eta2, F, (df_b, df_w), (msb, msw), groups


def icc1(msb, msw, group_sizes):
    """一元配置ランダム効果モデルの ICC(1)。グループ平均の信頼性。"""
    K = len(group_sizes)
    N = sum(group_sizes)
    # 不均衡デザイン補正後の代表グループサイズ
    k0 = (N - sum(n ** 2 for n in group_sizes) / N) / (K - 1)
    denom = msb + (k0 - 1) * msw
    return (msb - msw) / denom if denom > 0 else 0.0


def eta_label(e):
    if e >= 0.14:
        return "大"
    if e >= 0.06:
        return "中"
    if e >= 0.01:
        return "小"
    return "ごく小"


# ---------------------------------------------------------------------
def main():
    rng = np.random.default_rng(RANDOM_STATE)
    df = load_beans()
    # eta_squared 用に整数コード化（タプル/文字列のままだと比較できないため）
    grp_country_method = pd.factorize(df["_grp"])[0]
    grp_country = pd.factorize(df[GROUP_COLS[0]])[0]
    grp_method = pd.factorize(df[GROUP_COLS[1]])[0]
    K = df["_grp"].nunique()

    print("=" * 80)
    print(f"母集団: 豆 N={len(df)} / 産地×方法グループ K={K} "
          f"（産地{df[GROUP_COLS[0]].nunique()} × 方法{df[GROUP_COLS[1]].nunique()}）")
    print("特徴量: 偏差6軸 *_dev（味の形）。各軸でグループ間の違いを検定する。")

    # -----------------------------------------------------------------
    # [A] グループ間で味が違うか（ANOVA / Kruskal / η²）
    # -----------------------------------------------------------------
    print("\n[A] 産地×方法グループ間で味の形は違うか（一元配置）")
    print(f"    {'軸':<12}{'η²':>8} {'(効果)':>6}{'F':>9}{'ANOVA p':>12}{'Kruskal p':>12}")
    eta_cm = {}
    msb_msw = {}
    for dev, taste in zip(DEV_COLS, TASTE_COLS):
        vals = df[dev].values
        eta2, F, (db, dw), (msb, msw), groups = eta_squared(vals, grp_country_method)
        _, p_anova = stats.f_oneway(*groups)
        _, p_kw = stats.kruskal(*groups)
        eta_cm[taste] = eta2
        msb_msw[taste] = (msb, msw)
        print(f"    {taste:<12}{eta2:>8.3f} {eta_label(eta2):>6}{F:>9.2f}"
              f"{p_anova:>12.2e}{p_kw:>12.2e}")
    print("    η²: グループで説明される分散割合（0.01小/0.06中/0.14大）。"
          "p<0.05 で『偶然では説明できない違いあり』。")

    # -----------------------------------------------------------------
    # [B] 産地 と 精製方法 のどちらが味を分けているか
    # -----------------------------------------------------------------
    print("\n[B] 産地のみ / 精製方法のみ で集約したときの η²（どちらが効くか）")
    print(f"    {'軸':<12}{'η²(産地)':>10}{'η²(方法)':>10}{'η²(産地×方法)':>14}")
    for dev, taste in zip(DEV_COLS, TASTE_COLS):
        vals = df[dev].values
        e_c, *_ = eta_squared(vals, grp_country)
        e_m, *_ = eta_squared(vals, grp_method)
        print(f"    {taste:<12}{e_c:>10.3f}{e_m:>10.3f}{eta_cm[taste]:>14.3f}")
    print("    両方が単独でも効き、かつ 産地×方法 で更に上がるなら『両軸でまとめる』意味がある。")

    # -----------------------------------------------------------------
    # [C] 並べ替え検定（分布仮定なし）
    # -----------------------------------------------------------------
    print(f"\n[C] 並べ替え検定（ラベルを{N_PERM}回シャッフルした帰無分布と比較）")
    print(f"    {'軸':<12}{'観測η²':>10}{'帰無η² 95%点':>14}{'perm p':>10}")
    for dev, taste in zip(DEV_COLS, TASTE_COLS):
        vals = df[dev].values
        obs, *_ = eta_squared(vals, grp_country_method)
        null = np.empty(N_PERM)
        for i in range(N_PERM):
            perm = rng.permutation(grp_country_method)
            null[i], *_ = eta_squared(vals, perm)
        p = (np.sum(null >= obs) + 1) / (N_PERM + 1)
        print(f"    {taste:<12}{obs:>10.3f}{np.quantile(null, 0.95):>14.3f}{p:>10.4f}")
    print("    観測η²が帰無分布の95%点を大きく超え perm p が小さいほど、違いは構造的。")

    # -----------------------------------------------------------------
    # [D] ICC(1): グループ平均という"まとめ方"の信頼性
    # -----------------------------------------------------------------
    print("\n[D] ICC(1): 同じグループ内の豆がどれだけ似ているか（グループ平均の信頼性）")
    group_sizes = df.groupby("_grp").size().values.tolist()
    print(f"    {'軸':<12}{'ICC(1)':>10}{'解釈':>8}")
    for taste in TASTE_COLS:
        msb, msw = msb_msw[taste]
        icc = icc1(msb, msw, group_sizes)
        if icc >= 0.5:
            tag = "良好"
        elif icc >= 0.2:
            tag = "中程度"
        else:
            tag = "弱い"
        print(f"    {taste:<12}{icc:>10.3f}{tag:>8}")
    print("    ICC>0.2でグループに体系的な味差あり / >0.5で平均集約は十分信頼できる。")

    # -----------------------------------------------------------------
    # [E] sample_count >= 3 閾値の妥当性（信号 vs ノイズ）
    # -----------------------------------------------------------------
    print("\n[E] グループ平均の標準誤差(ノイズ) vs グループ間SD(信号)")
    print(f"    {'軸':<12}{'グループ間SD':>14}{'平均SEM(中央値)':>16}{'信号/ノイズ':>12}")
    gmeans = df.groupby("_grp")[DEV_COLS].mean()
    for dev, taste in zip(DEV_COLS, TASTE_COLS):
        between_sd = float(gmeans[dev].std())
        sems = df.groupby("_grp")[dev].agg(lambda x: x.std(ddof=1) / np.sqrt(len(x)))
        med_sem = float(np.nanmedian(sems.values))
        snr = between_sd / med_sem if med_sem > 0 else np.inf
        print(f"    {taste:<12}{between_sd:>14.4f}{med_sem:>16.4f}{snr:>12.2f}")
    print(f"    信号/ノイズ>1 で、グループ間の差が n>={MIN_SAMPLE_COUNT}集約の推定誤差より大きい"
          "＝閾値は妥当。")

    # -----------------------------------------------------------------
    # [F] 図出力
    # -----------------------------------------------------------------
    print("\n[F] 図出力")
    plot_histograms(df)
    plot_boxplots(df)
    plot_eta(df, grp_country, grp_method, grp_country_method)

    print("=" * 80)
    print("完了。生成物:")
    for p in (HIST_PNG, BOX_PNG, ETA_PNG):
        print(f"  - {p}")
    print("=" * 80)


def plot_histograms(df):
    """偏差6軸 × 上位グループ のヒストグラム重ね描き。
    平均で潰さず『分布そのもの』を見せ、グループごとに山の位置がずれるか／
    分布がどんな形（歪み・離散性）かを目視する。"""
    top = df["_grp"].value_counts().head(4).index.tolist()  # 豆数の多い4群
    cmap = plt.get_cmap("tab10")

    fig, axes = plt.subplots(2, 3, figsize=(16, 9))
    for ax, dev, taste in zip(axes.ravel(), DEV_COLS, TASTE_COLS):
        vals_all = df[dev].values
        bins = np.linspace(vals_all.min(), vals_all.max(), 30)
        for i, g in enumerate(top):
            vals = df.loc[df["_grp"] == g, dev].values
            label = f"{g[0][:8]}/{g[1].split()[0][:4]} (n={len(vals)})"
            # density=Trueで群サイズ差を正規化し、山の位置・形を比較できるように
            ax.hist(vals, bins=bins, density=True, alpha=0.45,
                    color=cmap(i), label=label, edgecolor="white", linewidth=0.3)
            ax.axvline(vals.mean(), color=cmap(i), ls="--", lw=1.2)  # 群平均
        ax.axvline(0, color="black", lw=1)  # 偏差0 = 豆の6軸平均
        ax.set_title(f"{taste}_dev")
        ax.set_xlabel("deviation"); ax.set_ylabel("density")
    axes.ravel()[0].legend(fontsize=7)
    fig.suptitle("Per-axis deviation distribution by top groups "
                 "(histograms; dashed line = group mean / black = 0)", fontsize=13)
    fig.tight_layout(rect=[0, 0, 1, 0.97])
    fig.savefig(HIST_PNG, dpi=130)
    plt.close(fig)
    print(f"    [OK] {HIST_PNG}")


def plot_boxplots(df):
    """偏差6軸 × 上位グループ のボックスプロット。グループ間で分布がずれるかを目視。"""
    top = df["_grp"].value_counts().head(8).index.tolist()
    sub = df[df["_grp"].isin(top)].copy()
    labels = [f"{c[:8]}/{m.split()[0][:4]}" for (c, m) in top]

    fig, axes = plt.subplots(2, 3, figsize=(16, 9))
    for ax, dev, taste in zip(axes.ravel(), DEV_COLS, TASTE_COLS):
        data = [sub.loc[sub["_grp"] == g, dev].values for g in top]
        ax.boxplot(data, labels=labels, showmeans=True)
        ax.axhline(0, color="red", lw=1, ls="--")
        ax.set_title(f"{taste}_dev")
        ax.tick_params(axis="x", labelrotation=60, labelsize=7)
        ax.set_ylabel("deviation")
    fig.suptitle("Per-axis deviation by top groups (boxes apart from each other = group taste differs)",
                 fontsize=13)
    fig.tight_layout(rect=[0, 0, 1, 0.97])
    fig.savefig(BOX_PNG, dpi=130)
    plt.close(fig)
    print(f"    [OK] {BOX_PNG}")


def plot_eta(df, grp_country, grp_method, grp_cm):
    """軸別 η²（産地 / 方法 / 産地×方法）の棒グラフ。"""
    e_c, e_m, e_cm = [], [], []
    for dev in DEV_COLS:
        vals = df[dev].values
        e_c.append(eta_squared(vals, grp_country)[0])
        e_m.append(eta_squared(vals, grp_method)[0])
        e_cm.append(eta_squared(vals, grp_cm)[0])

    x = np.arange(len(TASTE_COLS))
    w = 0.27
    fig, ax = plt.subplots(figsize=(11, 6))
    ax.bar(x - w, e_c, w, label="Country only", color="#4C78A8")
    ax.bar(x, e_m, w, label="Method only", color="#54A24B")
    ax.bar(x + w, e_cm, w, label="Country x Method", color="#E45756")
    for thr, txt in [(0.06, "medium"), (0.14, "large")]:
        ax.axhline(thr, color="grey", ls=":", lw=1)
        ax.text(len(x) - 0.5, thr, txt, fontsize=8, va="bottom", ha="right", color="grey")
    ax.set_xticks(x)
    ax.set_xticklabels(TASTE_COLS, rotation=20)
    ax.set_ylabel("eta^2 (variance explained by grouping)")
    ax.set_title("How much taste-shape variance each grouping explains")
    ax.legend()
    fig.tight_layout()
    fig.savefig(ETA_PNG, dpi=130)
    plt.close(fig)
    print(f"    [OK] {ETA_PNG}")


if __name__ == "__main__":
    main()
