import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib
import numpy as np

matplotlib.rcParams['font.family'] = 'Hiragino Sans'

df = pd.read_csv('merged_data_k4.csv', index_col=0)

country_jp = {
    'Mexico': 'メキシコ', 'Guatemala': 'グアテマラ', 'Colombia': 'コロンビア',
    'Brazil': 'ブラジル', 'Taiwan': '台湾', 'United States (Hawaii)': 'ハワイ',
    'Honduras': 'ホンジュラス', 'Costa Rica': 'コスタリカ', 'Ethiopia': 'エチオピア',
    'Tanzania, United Republic Of': 'タンザニア',
}
method_jp = {
    'Washed / Wet': 'ウォッシュド',
    'Natural / Dry': 'ナチュラル',
    'Semi-washed / Semi-pulped': 'セミウォッシュド',
    'Pulped natural / honey': 'ハニー',
    'Other': 'その他',
}

df['Country_JP'] = df['Country.of.Origin'].map(country_jp)
df['Method_JP'] = df['Processing.Method'].map(method_jp)
df = df[df['Country_JP'].notna() & df['Method_JP'].notna()].copy()

# 国の順序（件数降順）
country_order = df.groupby('Country_JP').size().sort_values(ascending=False).index.tolist()
# 精製方法の順序（件数降順）
method_order = df.groupby('Method_JP').size().sort_values(ascending=False).index.tolist()

cluster_colors = {
    '酸味系':      '#5B8FD4',
    'バランス系':  '#A8D86E',
    'コク・バランス系': '#F0A830',
    '香り系':      '#E8534A',
}
all_clusters = list(cluster_colors.keys())

n_countries = len(country_order)
n_methods = len(method_order)

fig, axes = plt.subplots(
    n_methods, n_countries,
    figsize=(n_countries * 1.8 + 1.5, n_methods * 1.8 + 2.0),
)
fig.patch.set_facecolor('#F8F8F8')

for row_i, method in enumerate(method_order):
    for col_i, country in enumerate(country_order):
        ax = axes[row_i, col_i]
        ax.set_facecolor('#F8F8F8')

        sub = df[(df['Country_JP'] == country) & (df['Method_JP'] == method)].copy()
        total = len(sub)

        if total == 0:
            ax.text(0.5, 0.5, '—', ha='center', va='center',
                    fontsize=12, color='#CCCCCC',
                    transform=ax.transAxes)
            ax.axis('off')
        else:
            counts = sub['ClusterName'].value_counts()
            sizes = [counts.get(c, 0) for c in all_clusters]
            colors = [cluster_colors[c] for c in all_clusters]

            # 0件のスライスを除外
            nonzero = [(s, c) for s, c in zip(sizes, colors) if s > 0]
            if nonzero:
                sz, co = zip(*nonzero)
                wedgeprops = dict(linewidth=0.8, edgecolor='white')
                ax.pie(sz, colors=co, wedgeprops=wedgeprops,
                       startangle=90, radius=0.9)

            ax.text(0.5, -0.08, f'n={total}', ha='center', va='top',
                    fontsize=7.5, color='#555555', transform=ax.transAxes)
            ax.set_aspect('equal')

        # 列ヘッダー（国名）
        if row_i == 0:
            ax.set_title(country, fontsize=9, fontweight='bold',
                         pad=6, color='#333333')
        # 行ラベル（精製方法）
        if col_i == 0:
            ax.set_ylabel(method, fontsize=9, fontweight='bold',
                          color='#333333', rotation=0,
                          ha='right', va='center', labelpad=60)

fig.suptitle(
    'コーヒー豆 産地×精製方法 × 味クラスター分布\n（各セルのパイチャート = 味クラスター割合）',
    fontsize=14, fontweight='bold', y=1.01, color='#222222'
)

legend_patches = [
    mpatches.Patch(color=cluster_colors[c], label=c) for c in all_clusters
]
fig.legend(
    handles=legend_patches, title='味クラスター',
    loc='lower center', ncol=5,
    bbox_to_anchor=(0.5, -0.04),
    fontsize=9, title_fontsize=10,
    framealpha=0.9, edgecolor='#CCCCCC',
)

plt.tight_layout(rect=[0, 0.04, 1, 1])
plt.savefig('grid_pie_matrix.png', dpi=150, bbox_inches='tight',
            facecolor='#F8F8F8')
print('保存完了: grid_pie_matrix.png')
