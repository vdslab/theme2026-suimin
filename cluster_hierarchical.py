import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib
matplotlib.rcParams['font.family'] = ['Hiragino Sans', 'Arial Unicode MS', 'sans-serif']
import seaborn as sns
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from scipy.cluster.hierarchy import dendrogram, linkage, fcluster
from scipy.spatial.distance import pdist

# ── データ読み込み・クリーニング ───────────────────────────────
df = pd.read_csv('/Users/min/Downloads/archive/merged_data_cleaned.csv', index_col=0)

FEATURES = ['Aroma', 'Flavor', 'Aftertaste', 'Acidity', 'Body',
            'Balance', 'Uniformity', 'Clean.Cup', 'Sweetness', 'Moisture']
TASTE    = ['Aroma', 'Flavor', 'Aftertaste', 'Acidity', 'Body',
            'Balance', 'Uniformity', 'Clean.Cup', 'Sweetness']

X = df[FEATURES].dropna()
X = X[X['Moisture'] > 0]
X = X[(X[TASTE] > 0).all(axis=1)]
print(f"有効サンプル数: {len(X)}")

scaler   = StandardScaler()
X_scaled = scaler.fit_transform(X)

# ── Ward 法で階層クラスタリング ────────────────────────────────
Z = linkage(X_scaled, method='ward')

# ── Figure 1: デンドログラム（全体）─────────────────────────
fig, ax = plt.subplots(figsize=(16, 6))
dendrogram(Z, ax=ax,
           truncate_mode='lastp', p=40,        # 末端40ノードに圧縮して見やすく
           leaf_rotation=90, leaf_font_size=8,
           show_contracted=True,
           color_threshold=0)                  # 色分けはあとで
ax.set_title('階層クラスタリング デンドログラム（Ward法）', fontsize=13)
ax.set_xlabel('サンプル（末端ノード）')
ax.set_ylabel('距離（Ward距離）')

# k=3,4,5,6 の切断線を追加
heights = sorted(set(Z[:, 2]), reverse=True)
cut_ks  = {3: None, 4: None, 5: None, 6: None}
for k in cut_ks:
    cut_ks[k] = (heights[k-2] + heights[k-1]) / 2   # k番目と(k-1)番目の合併距離の中点

colors_cut = {3:'#e74c3c', 4:'#e67e22', 5:'#3498db', 6:'#8e44ad'}
for k, h in cut_ks.items():
    ax.axhline(h, color=colors_cut[k], linestyle='--', linewidth=1.2,
               label=f'k={k}  (h={h:.1f})')
ax.legend(loc='upper right', fontsize=9)
plt.tight_layout()
plt.savefig('/Users/min/Downloads/archive/hc_dendrogram.png', dpi=150)
plt.close()
print("✓ デンドログラム保存")

# ── Figure 2: k=3〜6 のレーダーチャート一覧 ───────────────────
JA = {'Aroma':'香り', 'Flavor':'風味', 'Aftertaste':'後味',
      'Acidity':'酸味', 'Body':'コク', 'Balance':'バランス',
      'Uniformity':'均一性', 'Clean.Cup':'クリーン', 'Sweetness':'甘さ'}
RADAR      = list(JA.keys())
labels_ja  = [JA[c] for c in RADAR]
angles     = np.linspace(0, 2*np.pi, len(RADAR), endpoint=False).tolist()
angles    += angles[:1]
PALETTE    = ['#e74c3c','#e67e22','#3498db','#2ecc71','#9b59b6','#1abc9c']

fig, axes = plt.subplots(2, 2, figsize=(14, 12),
                          subplot_kw=dict(polar=True))
axes = axes.flatten()

for idx, k in enumerate([3, 4, 5, 6]):
    labels = fcluster(Z, t=k, criterion='maxclust')
    X_tmp  = X.copy()
    X_tmp['Cluster'] = labels - 1   # 0-indexed に揃える

    means = X_tmp.groupby('Cluster')[RADAR].mean()
    sizes = X_tmp['Cluster'].value_counts().sort_index()

    # クラスタを Flavor 平均で昇順ソート（プロファイル比較しやすく）
    order   = means['Flavor'].sort_values().index.tolist()
    means   = means.loc[order].reset_index(drop=True)
    sizes   = sizes.loc[order].values

    ax = axes[idx]
    for ci in range(k):
        vals  = means.loc[ci, RADAR].tolist()
        vals += vals[:1]
        ax.plot(angles, vals, color=PALETTE[ci], linewidth=2,
                label=f'C{ci}  n={sizes[ci]}')
        ax.fill(angles, vals, color=PALETTE[ci], alpha=0.08)

    ax.set_thetagrids(np.degrees(angles[:-1]), labels_ja, fontsize=8)
    ax.set_ylim(6.5, 9.0)
    ax.set_title(f'k = {k}', fontsize=12, pad=16)
    ax.legend(loc='upper right', bbox_to_anchor=(1.45, 1.1), fontsize=8)

plt.suptitle('階層クラスタリング — k=3〜6 の風味プロファイル', fontsize=14, y=1.01)
plt.tight_layout()
plt.savefig('/Users/min/Downloads/archive/hc_radar_all.png', dpi=150, bbox_inches='tight')
plt.close()
print("✓ レーダーチャート一覧保存")

# ── Figure 3: k=3〜6 のヒートマップ一覧 ──────────────────────
fig, axes = plt.subplots(2, 2, figsize=(16, 10))
axes = axes.flatten()

for idx, k in enumerate([3, 4, 5, 6]):
    labels = fcluster(Z, t=k, criterion='maxclust')
    X_tmp  = X.copy()
    X_tmp['Cluster'] = labels - 1

    means  = X_tmp.groupby('Cluster')[RADAR].mean()
    sizes  = X_tmp['Cluster'].value_counts().sort_index()
    order  = means['Flavor'].sort_values().index.tolist()
    means  = means.loc[order].reset_index(drop=True)
    means.index = [f'C{i}  (n={sizes.loc[order[i]]})' for i in range(k)]

    hm = means.rename(columns=JA)
    sns.heatmap(hm, annot=True, fmt='.2f', cmap='RdYlGn',
                linewidths=0.5, vmin=6.8, vmax=8.2,
                ax=axes[idx], annot_kws={'size': 8},
                cbar=idx == 0)
    axes[idx].set_title(f'k = {k}', fontsize=12)
    axes[idx].set_ylabel('')

plt.suptitle('階層クラスタリング — k=3〜6 のスコアヒートマップ', fontsize=14, y=1.01)
plt.tight_layout()
plt.savefig('/Users/min/Downloads/archive/hc_heatmap_all.png', dpi=150, bbox_inches='tight')
plt.close()
print("✓ ヒートマップ一覧保存")

# ── k ごとの平均値をまとめて CSV 保存 ────────────────────────
rows = []
for k in [3, 4, 5, 6]:
    labels = fcluster(Z, t=k, criterion='maxclust')
    X_tmp  = X.copy()
    X_tmp['Cluster'] = labels - 1
    means  = X_tmp.groupby('Cluster')[FEATURES].mean().round(3)
    sizes  = X_tmp['Cluster'].value_counts().sort_index()
    for ci in means.index:
        row = {'k': k, 'Cluster': ci, 'n': sizes[ci]}
        row.update(means.loc[ci].to_dict())
        rows.append(row)

pd.DataFrame(rows).to_csv('/Users/min/Downloads/archive/hc_cluster_means.csv', index=False)
print("✓ hc_cluster_means.csv 保存")
print("\n完了 — デンドログラムを見て k を選んでください")
