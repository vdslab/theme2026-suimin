import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib
matplotlib.rcParams['font.family'] = ['Hiragino Sans', 'Arial Unicode MS', 'sans-serif']
import seaborn as sns
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from scipy.cluster.hierarchy import linkage, fcluster

# ── データ・クラスタリング（前回と同じ前処理） ────────────────
df = pd.read_csv('/Users/min/Downloads/archive/merged_data_cleaned.csv', index_col=0)

FEATURES = ['Aroma', 'Flavor', 'Aftertaste', 'Acidity', 'Body', 'Balance']
JA = {'Aroma':'香り', 'Flavor':'風味', 'Aftertaste':'後味',
      'Acidity':'酸味', 'Body':'コク', 'Balance':'バランス'}

X = df[FEATURES].dropna()
X = X[(X > 0).all(axis=1)]

row_mean = X.mean(axis=1)
X_rel    = X.subtract(row_mean, axis=0)

scaler   = StandardScaler()
X_scaled = scaler.fit_transform(X_rel)

Z      = linkage(X_scaled, method='ward')
labels = fcluster(Z, t=4, criterion='maxclust') - 1

X     = X.copy()
X_rel = X_rel.copy()
X['Cluster']     = labels
X_rel['Cluster'] = labels

# クラスタを Acidity偏差 - Body偏差 でソート（酸味系→コク系）
dev_means = X_rel.groupby('Cluster')[FEATURES].mean()
order     = (dev_means['Acidity'] - dev_means['Body']).sort_values(ascending=False).index.tolist()
remap     = {old: new for new, old in enumerate(order)}
X['Cluster']     = X['Cluster'].map(remap)
X_rel['Cluster'] = X_rel['Cluster'].map(remap)

CLUSTER_NAMES = {
    0: '酸味系',
    1: 'バランス系',
    2: 'コク・バランス系',
    3: '香り系',
}
PALETTE = ['#e74c3c', '#3498db', '#2ecc71', '#e67e22']

means_raw = X.groupby('Cluster')[FEATURES].mean()
means_dev = X_rel.groupby('Cluster')[FEATURES].mean()
sizes     = X['Cluster'].value_counts().sort_index()

print("=== k=4 クラスタ詳細 ===")
for ci in range(4):
    print(f"\n【{CLUSTER_NAMES[ci]}】 C{ci} (n={sizes[ci]})")
    print("  偏差: " + "  ".join(f"{JA[c]}={means_dev.loc[ci,c]:+.3f}" for c in FEATURES))

# ── Figure 1: レーダーチャート ─────────────────────────────────
labels_ja = [JA[c] for c in FEATURES]
angles    = np.linspace(0, 2*np.pi, len(FEATURES), endpoint=False).tolist()
angles   += angles[:1]

fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(polar=True))
for ci in range(4):
    vals  = means_raw.loc[ci, FEATURES].tolist()
    vals += vals[:1]
    n     = sizes[ci]
    ax.plot(angles, vals, color=PALETTE[ci], linewidth=2.5,
            label=f'C{ci}: {CLUSTER_NAMES[ci]}  (n={n})')
    ax.fill(angles, vals, color=PALETTE[ci], alpha=0.10)

ax.set_thetagrids(np.degrees(angles[:-1]), labels_ja, fontsize=11)
ax.set_ylim(6.8, 8.5)
ax.set_title('風味プロファイル（k=4）', fontsize=14, pad=24)
ax.legend(loc='upper right', bbox_to_anchor=(1.5, 1.15), fontsize=10)
plt.tight_layout()
plt.savefig('/Users/min/Downloads/archive/k4_radar.png', dpi=150)
plt.close()
print("\n✓ レーダーチャート保存")

# ── Figure 2: 偏差ヒートマップ ────────────────────────────────
hm_data = means_dev[FEATURES].rename(columns=JA)
hm_data.index = [f'C{i}: {CLUSTER_NAMES[i]}  (n={sizes[i]})' for i in range(4)]

fig, ax = plt.subplots(figsize=(9, 4))
sns.heatmap(hm_data, annot=True, fmt='+.3f', cmap='coolwarm',
            center=0, linewidths=0.8, ax=ax,
            annot_kws={'size': 11})
ax.set_title('各クラスタの偏差（正=自分の平均より突出、負=控えめ）', fontsize=12)
ax.set_ylabel('')
plt.tight_layout()
plt.savefig('/Users/min/Downloads/archive/k4_heatmap.png', dpi=150)
plt.close()
print("✓ ヒートマップ保存")

# ── Figure 3: PCA 散布図 ──────────────────────────────────────
pca    = PCA(n_components=2, random_state=42)
coords = pca.fit_transform(X_scaled)
var    = pca.explained_variance_ratio_

# PCA の軸解釈
components = pd.DataFrame(pca.components_, columns=FEATURES,
                           index=['PC1', 'PC2'])
print("\nPCA 軸の寄与（上位特徴）:")
for pc in ['PC1', 'PC2']:
    top = components.loc[pc].abs().sort_values(ascending=False)
    print(f"  {pc}: " + ", ".join(f"{JA[c]}({components.loc[pc,c]:+.2f})" for c in top.index))

fig, ax = plt.subplots(figsize=(9, 7))
remap_labels = X['Cluster'].values
for ci in range(4):
    mask = remap_labels == ci
    ax.scatter(coords[mask, 0], coords[mask, 1],
               label=f'C{ci}: {CLUSTER_NAMES[ci]}  (n={mask.sum()})',
               alpha=0.5, s=35, color=PALETTE[ci])

ax.set_xlabel(f'PC1 ({var[0]:.1%})  ← {" / ".join(JA[c] for c in components.loc["PC1"].abs().nlargest(2).index)}',
              fontsize=10)
ax.set_ylabel(f'PC2 ({var[1]:.1%})  ← {" / ".join(JA[c] for c in components.loc["PC2"].abs().nlargest(2).index)}',
              fontsize=10)
ax.set_title('PCA 散布図（k=4）', fontsize=13)
ax.legend(fontsize=9)
plt.tight_layout()
plt.savefig('/Users/min/Downloads/archive/k4_pca.png', dpi=150)
plt.close()
print("✓ PCA 散布図保存")

# ── Figure 4: クラスタ別スコア分布（バイオリン図） ────────────
fig, axes = plt.subplots(2, 3, figsize=(14, 8))
axes = axes.flatten()

X_plot = X.copy()
X_plot['ClusterName'] = X_plot['Cluster'].map(
    lambda c: f'C{c}:{CLUSTER_NAMES[c]}')

for i, col in enumerate(FEATURES):
    data_list  = [X_plot[X_plot['Cluster']==ci][col].values for ci in range(4)]
    name_list  = [f'C{ci}\n{CLUSTER_NAMES[ci]}' for ci in range(4)]
    vp = axes[i].violinplot(data_list, positions=range(4),
                             showmedians=True, showextrema=False)
    for body, color in zip(vp['bodies'], PALETTE):
        body.set_facecolor(color)
        body.set_alpha(0.6)
    vp['cmedians'].set_color('black')
    axes[i].set_xticks(range(4))
    axes[i].set_xticklabels(name_list, fontsize=7)
    axes[i].set_title(JA[col], fontsize=11)
    axes[i].grid(axis='y', alpha=0.3)

plt.suptitle('クラスタ別 スコア分布（k=4）', fontsize=13)
plt.tight_layout()
plt.savefig('/Users/min/Downloads/archive/k4_violin.png', dpi=150)
plt.close()
print("✓ バイオリン図保存")

# ── CSV 保存 ──────────────────────────────────────────────────
out = df.loc[X.index].copy()
out['Cluster']      = X['Cluster'].values
out['ClusterName']  = X['Cluster'].map(CLUSTER_NAMES).values
out.to_csv('/Users/min/Downloads/archive/merged_data_k4.csv')
print("✓ merged_data_k4.csv 保存")
print("\n完了")
