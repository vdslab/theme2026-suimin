import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib
matplotlib.rcParams['font.family'] = ['Hiragino Sans', 'Arial Unicode MS', 'sans-serif']
import seaborn as sns
from sklearn.preprocessing import StandardScaler
from scipy.cluster.hierarchy import dendrogram, linkage, fcluster

# ── データ読み込み・クリーニング ───────────────────────────────
df = pd.read_csv('/Users/min/Downloads/archive/merged_data_cleaned.csv', index_col=0)

# 方法3: 風味の「形」に効く6特徴だけ使う
FEATURES = ['Aroma', 'Flavor', 'Aftertaste', 'Acidity', 'Body', 'Balance']
JA = {'Aroma':'香り', 'Flavor':'風味', 'Aftertaste':'後味',
      'Acidity':'酸味', 'Body':'コク', 'Balance':'バランス'}

X = df[FEATURES].dropna()
X = X[(X > 0).all(axis=1)]   # 全スコアが正の行のみ
print(f"有効サンプル数: {len(X)}")

# ── 方法1: 行正規化（各サンプルの平均を引く） ─────────────────
# 品質レベルを除去し、「自分の中でどこが突出しているか」だけ残す
row_mean = X.mean(axis=1)
X_rel = X.subtract(row_mean, axis=0)   # shape: (n, 6)

print("\n行正規化後の統計（各特徴の偏差）:")
print(X_rel.describe().round(3))

# さらに列方向に標準化（特徴間のスケールを揃える）
scaler   = StandardScaler()
X_scaled = scaler.fit_transform(X_rel)

# ── Ward法で階層クラスタリング ────────────────────────────────
Z = linkage(X_scaled, method='ward')

# ── Figure 1: デンドログラム ──────────────────────────────────
fig, ax = plt.subplots(figsize=(16, 6))
dendrogram(Z, ax=ax,
           truncate_mode='lastp', p=40,
           leaf_rotation=90, leaf_font_size=8,
           show_contracted=True, color_threshold=0)
ax.set_title('階層クラスタリング デンドログラム\n（行正規化 + Ward法）', fontsize=13)
ax.set_xlabel('サンプル（末端ノード）')
ax.set_ylabel('距離（Ward距離）')

heights = sorted(set(Z[:, 2]), reverse=True)
cut_ks  = {k: (heights[k-2] + heights[k-1]) / 2 for k in [3, 4, 5, 6]}
colors_cut = {3:'#e74c3c', 4:'#e67e22', 5:'#3498db', 6:'#8e44ad'}
for k, h in cut_ks.items():
    ax.axhline(h, color=colors_cut[k], linestyle='--', linewidth=1.2,
               label=f'k={k}')
ax.legend(loc='upper right', fontsize=9)
plt.tight_layout()
plt.savefig('/Users/min/Downloads/archive/fp_dendrogram.png', dpi=150)
plt.close()
print("\n✓ デンドログラム保存")

# ── Figure 2: k=3〜6 レーダーチャート一覧 ─────────────────────
PALETTE = ['#e74c3c','#e67e22','#3498db','#2ecc71','#9b59b6','#1abc9c']
labels_ja = [JA[c] for c in FEATURES]
angles = np.linspace(0, 2*np.pi, len(FEATURES), endpoint=False).tolist()
angles += angles[:1]

fig, axes = plt.subplots(2, 2, figsize=(14, 12),
                          subplot_kw=dict(polar=True))
axes = axes.flatten()

for idx, k in enumerate([3, 4, 5, 6]):
    cluster_labels = fcluster(Z, t=k, criterion='maxclust') - 1
    X_tmp = X.copy()
    X_tmp['Cluster'] = cluster_labels

    # 生スコアの平均でプロファイルを描く（解釈しやすくするため）
    means = X_tmp.groupby('Cluster')[FEATURES].mean()
    sizes = X_tmp['Cluster'].value_counts().sort_index()

    # 各クラスタを Acidity - Body の差でソート（酸味系→コク系の軸で並べる）
    order = (means['Acidity'] - means['Body']).sort_values(ascending=False).index.tolist()
    means = means.loc[order].reset_index(drop=True)
    sizes = [sizes[o] for o in order]

    ax = axes[idx]
    for ci in range(k):
        vals  = means.loc[ci, FEATURES].tolist()
        vals += vals[:1]
        ax.plot(angles, vals, color=PALETTE[ci], linewidth=2.2,
                label=f'C{ci}  n={sizes[ci]}')
        ax.fill(angles, vals, color=PALETTE[ci], alpha=0.10)

    ax.set_thetagrids(np.degrees(angles[:-1]), labels_ja, fontsize=9)
    ax.set_ylim(6.8, 8.5)
    ax.set_title(f'k = {k}', fontsize=12, pad=16)
    ax.legend(loc='upper right', bbox_to_anchor=(1.45, 1.1), fontsize=8)

plt.suptitle('風味プロファイル クラスタリング（行正規化）\nk=3〜6', fontsize=14, y=1.01)
plt.tight_layout()
plt.savefig('/Users/min/Downloads/archive/fp_radar_all.png', dpi=150, bbox_inches='tight')
plt.close()
print("✓ レーダーチャート一覧保存")

# ── Figure 3: k=3〜6 ヒートマップ一覧（偏差で描く） ──────────
fig, axes = plt.subplots(2, 2, figsize=(14, 9))
axes = axes.flatten()

for idx, k in enumerate([3, 4, 5, 6]):
    cluster_labels = fcluster(Z, t=k, criterion='maxclust') - 1
    X_tmp = X_rel.copy()
    X_tmp['Cluster'] = cluster_labels

    means = X_tmp.groupby('Cluster')[FEATURES].mean()
    sizes_all = pd.Series(cluster_labels).value_counts().sort_index()
    order = (means['Acidity'] - means['Body']).sort_values(ascending=False).index.tolist()
    means = means.loc[order].reset_index(drop=True)
    row_labels = [f'C{i}  (n={sizes_all[order[i]]})' for i in range(k)]
    means.index = row_labels

    hm = means.rename(columns=JA)
    sns.heatmap(hm, annot=True, fmt='.3f', cmap='coolwarm',
                center=0, linewidths=0.5,
                ax=axes[idx], annot_kws={'size': 9},
                cbar=idx == 0)
    axes[idx].set_title(f'k = {k}  （偏差: 正=突出, 負=控えめ）', fontsize=10)
    axes[idx].set_ylabel('')

plt.suptitle('風味プロファイル ヒートマップ（行正規化後の偏差）', fontsize=13, y=1.01)
plt.tight_layout()
plt.savefig('/Users/min/Downloads/archive/fp_heatmap_all.png', dpi=150, bbox_inches='tight')
plt.close()
print("✓ ヒートマップ一覧保存")

# ── サマリー表示 ──────────────────────────────────────────────
print("\n=== k=4 のプロファイル確認 ===")
cluster_labels = fcluster(Z, t=4, criterion='maxclust') - 1
X_tmp = X.copy()
X_tmp['Cluster'] = cluster_labels
X_rel_tmp = X_rel.copy()
X_rel_tmp['Cluster'] = cluster_labels

means_raw = X_tmp.groupby('Cluster')[FEATURES].mean().round(3)
means_dev = X_rel_tmp.groupby('Cluster')[FEATURES].mean().round(3)
sizes = X_tmp['Cluster'].value_counts().sort_index()

for ci in range(4):
    print(f"\nCluster {ci} (n={sizes[ci]})")
    print(f"  生スコア: " + "  ".join(f"{c}={means_raw.loc[ci,c]:.2f}" for c in FEATURES))
    print(f"  偏差:     " + "  ".join(f"{c}={means_dev.loc[ci,c]:+.3f}" for c in FEATURES))

print("\n完了 — デンドログラムを見て k を選んでください")
