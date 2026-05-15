import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib
matplotlib.rcParams['font.family'] = ['Hiragino Sans', 'Arial Unicode MS', 'sans-serif']
import seaborn as sns
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score

# ── データ読み込み・クリーニング ───────────────────────────────
df = pd.read_csv('/Users/min/Downloads/archive/merged_data_cleaned.csv', index_col=0)

FEATURES = ['Aroma', 'Flavor', 'Aftertaste', 'Acidity', 'Body',
            'Balance', 'Uniformity', 'Clean.Cup', 'Sweetness', 'Moisture']
TASTE     = ['Aroma', 'Flavor', 'Aftertaste', 'Acidity', 'Body',
             'Balance', 'Uniformity', 'Clean.Cup', 'Sweetness']

X = df[FEATURES].dropna()
X = X[X['Moisture'] > 0]                          # Moisture=0 は欠損扱い
X = X[(X[TASTE] > 0).all(axis=1)]                 # 風味スコア異常値除外
print(f"有効サンプル数: {len(X)}")

# ── 標準化 & k=5 でクラスタリング ─────────────────────────────
scaler  = StandardScaler()
X_scaled = scaler.fit_transform(X)

K = 5
km = KMeans(n_clusters=K, random_state=42, n_init=20)
X = X.copy()
X['Cluster'] = km.fit_predict(X_scaled)
sil = silhouette_score(X_scaled, X['Cluster'])
print(f"k={K}  silhouette={sil:.3f}")

# クラスタを総合スコア順に並び替えて番号を振り直す
total_mean = X.groupby('Cluster')[TASTE].mean().mean(axis=1)
rank_map   = {old: new for new, old in enumerate(total_mean.sort_values().index)}
X['Cluster'] = X['Cluster'].map(rank_map)

# クラスタラベル（風味プロファイル名）
LABELS = {
    0: 'C0: 要改善',
    1: 'C1: ライト',
    2: 'C2: スタンダード',
    3: 'C3: 高品質',
    4: 'C4: プレミアム',
}

cluster_means = X.groupby('Cluster')[FEATURES].mean().round(3)
cluster_sizes = X['Cluster'].value_counts().sort_index()

print("\n── クラスタ別平均値 ──")
print(cluster_means.to_string())
cluster_means.to_csv('/Users/min/Downloads/archive/cluster_means.csv')

# ── Figure 1: エルボー法 & シルエット ─────────────────────────
inertias, silhouettes = [], []
for k in range(2, 11):
    _km  = KMeans(n_clusters=k, random_state=42, n_init=10)
    _lbl = _km.fit_predict(X_scaled)
    inertias.append(_km.inertia_)
    silhouettes.append(silhouette_score(X_scaled, _lbl))

fig, axes = plt.subplots(1, 2, figsize=(12, 4))
axes[0].plot(range(2, 11), inertias, 'bo-')
axes[0].axvline(K, color='red', linestyle='--', label=f'k={K}')
axes[0].set_xlabel('クラスタ数 k'); axes[0].set_ylabel('Inertia')
axes[0].set_title('エルボー法'); axes[0].legend()

axes[1].plot(range(2, 11), silhouettes, 'rs-')
axes[1].axvline(K, color='red', linestyle='--', label=f'k={K}')
axes[1].set_xlabel('クラスタ数 k'); axes[1].set_ylabel('Silhouette Score')
axes[1].set_title('シルエットスコア'); axes[1].legend()
plt.tight_layout()
plt.savefig('/Users/min/Downloads/archive/cluster_elbow.png', dpi=150)
plt.close()
print("✓ elbow 保存")

# ── Figure 2: レーダーチャート ─────────────────────────────────
JA = {'Aroma':'香り', 'Flavor':'風味', 'Aftertaste':'後味',
      'Acidity':'酸味', 'Body':'コク', 'Balance':'バランス',
      'Uniformity':'均一性', 'Clean.Cup':'クリーン', 'Sweetness':'甘さ'}
RADAR = list(JA.keys())
labels_ja = [JA[c] for c in RADAR]

angles = np.linspace(0, 2*np.pi, len(RADAR), endpoint=False).tolist()
angles += angles[:1]

COLORS = ['#e74c3c','#e67e22','#3498db','#2ecc71','#9b59b6']

fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(polar=True))
for ci in range(K):
    vals = cluster_means.loc[ci, RADAR].tolist()
    vals += vals[:1]
    n    = cluster_sizes[ci]
    ax.plot(angles, vals, color=COLORS[ci], linewidth=2.2,
            label=f'{LABELS[ci]}  (n={n})')
    ax.fill(angles, vals, color=COLORS[ci], alpha=0.08)

ax.set_thetagrids(np.degrees(angles[:-1]), labels_ja, fontsize=10)
ax.set_ylim(6.5, 9.0)
ax.set_title('クラスタ別 風味プロファイル', pad=24, fontsize=13)
ax.legend(loc='upper right', bbox_to_anchor=(1.42, 1.15), fontsize=9)
plt.tight_layout()
plt.savefig('/Users/min/Downloads/archive/cluster_radar.png', dpi=150)
plt.close()
print("✓ レーダーチャート保存")

# ── Figure 3: ヒートマップ ─────────────────────────────────────
hm_data = cluster_means[RADAR].rename(columns=JA)
hm_data.index = [LABELS[i] for i in hm_data.index]

fig, ax = plt.subplots(figsize=(11, 5))
sns.heatmap(hm_data, annot=True, fmt='.2f', cmap='RdYlGn',
            linewidths=0.5, vmin=6.8, vmax=8.1, ax=ax,
            annot_kws={'size': 9})
ax.set_title('クラスタ別 風味スコア ヒートマップ', fontsize=13)
ax.set_ylabel('')
plt.tight_layout()
plt.savefig('/Users/min/Downloads/archive/cluster_heatmap.png', dpi=150)
plt.close()
print("✓ ヒートマップ保存")

# ── Figure 4: PCA 散布図 ──────────────────────────────────────
pca    = PCA(n_components=2, random_state=42)
coords = pca.fit_transform(X_scaled)
var    = pca.explained_variance_ratio_

fig, ax = plt.subplots(figsize=(9, 7))
for ci in range(K):
    mask = X['Cluster'] == ci
    ax.scatter(coords[mask, 0], coords[mask, 1],
               label=f'{LABELS[ci]}  (n={mask.sum()})',
               alpha=0.5, s=30, color=COLORS[ci])
ax.set_xlabel(f'PC1 ({var[0]:.1%})', fontsize=10)
ax.set_ylabel(f'PC2 ({var[1]:.1%})', fontsize=10)
ax.set_title('PCA によるクラスタ分布', fontsize=13)
ax.legend(fontsize=9)
plt.tight_layout()
plt.savefig('/Users/min/Downloads/archive/cluster_pca.png', dpi=150)
plt.close()
print("✓ PCA 散布図保存")

# ── Figure 5: クラスタ別 箱ひげ図 ────────────────────────────
fig, axes = plt.subplots(3, 3, figsize=(14, 10))
axes = axes.flatten()
plot_cols = RADAR

X_plot = X.copy()
X_plot['ClusterLabel'] = X_plot['Cluster'].map(LABELS)

for i, col in enumerate(plot_cols):
    data_list = [X_plot[X_plot['Cluster']==ci][col].values for ci in range(K)]
    bp = axes[i].boxplot(data_list, patch_artist=True, notch=False,
                         medianprops=dict(color='black', linewidth=2))
    for patch, color in zip(bp['boxes'], COLORS):
        patch.set_facecolor(color)
        patch.set_alpha(0.6)
    axes[i].set_title(JA[col], fontsize=10)
    axes[i].set_xticklabels([f'C{c}' for c in range(K)], fontsize=8)
    axes[i].grid(axis='y', alpha=0.3)

plt.suptitle('クラスタ別 各スコア分布', fontsize=13, y=1.01)
plt.tight_layout()
plt.savefig('/Users/min/Downloads/archive/cluster_boxplot.png', dpi=150, bbox_inches='tight')
plt.close()
print("✓ 箱ひげ図保存")

# ── クラスタ列付き CSV 保存 ───────────────────────────────────
out = df.loc[X.index].copy()
out['Cluster']      = X['Cluster'].values
out['ClusterLabel'] = X['Cluster'].map(LABELS).values
out.to_csv('/Users/min/Downloads/archive/merged_data_clustered.csv')
print("✓ merged_data_clustered.csv 保存")

# ── サマリー表示 ──────────────────────────────────────────────
print("\n=== クラスタ サマリー ===")
for ci in range(K):
    row = cluster_means.loc[ci]
    print(f"\n{LABELS[ci]} (n={cluster_sizes[ci]})")
    print(f"  香り={row['Aroma']:.2f}  風味={row['Flavor']:.2f}  "
          f"後味={row['Aftertaste']:.2f}  酸味={row['Acidity']:.2f}")
    print(f"  コク={row['Body']:.2f}  バランス={row['Balance']:.2f}  "
          f"水分={row['Moisture']:.3f}")
print("\n完了")
