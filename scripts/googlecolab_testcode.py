import pandas as pd
import numpy as np
import plotly.graph_objects as go
import umap
import hdbscan
from sklearn.preprocessing import StandardScaler
import matplotlib.colors as mcolors

# ==========================================
# 1. データの読み込みと前処理
# ==========================================
df = pd.read_csv(file_path)
group_cols = ['Country.of.Origin', 'Processing.Method', 'Variety']
taste_cols = ['Aroma', 'Flavor', 'Aftertaste', 'Acidity', 'Body', 'Balance']

df_clean = df.dropna(subset=group_cols).copy()
grouped = df_clean.groupby(group_cols)[taste_cols].mean().reset_index()

# サンプル数3以上のグループに絞り込み
valid_counts = df_clean.groupby(['Country.of.Origin', 'Processing.Method']).size()
valid_groups = valid_counts[valid_counts >= 3].reset_index()
grouped = pd.merge(grouped, valid_groups[['Country.of.Origin', 'Processing.Method']], on=['Country.of.Origin', 'Processing.Method'])
grouped['Label'] = grouped['Country.of.Origin'] + " (" + grouped['Processing.Method'].str.split('/').str[0].str.strip() + ")"

# 相対評価化 & 標準化
X = grouped[taste_cols]
row_means = X.mean(axis=1)
X_relative = X.div(row_means, axis=0)
X_scaled = StandardScaler().fit_transform(X_relative)

# ==========================================
# 2. 高次元データ (6次元) に対して HDBSCAN を実行
# ==========================================
# 6次元空間での密度を計算するため、パラメータを少し調整します
clusterer_high = hdbscan.HDBSCAN(min_cluster_size=3, min_samples=1, cluster_selection_epsilon=0.1, prediction_data=True)
clusterer_high.fit(X_scaled)  # ← ここがポイント：元の6次元データを渡す

membership_probs = hdbscan.all_points_membership_vectors(clusterer_high)
n_clusters = membership_probs.shape[1]

# ==========================================
# 3. UMAPによる可視化用2次元配置
# ==========================================
reducer = umap.UMAP(n_neighbors=5, min_dist=0.05, metric='euclidean', random_state=42)
umap_result = reducer.fit_transform(X_scaled)
grouped['UMAP_X'] = umap_result[:, 0]
grouped['UMAP_Y'] = umap_result[:, 1]

# ==========================================
# 4. クラスタ命名とカラー設定
# ==========================================
cluster_names_map = {}
for j in range(n_clusters):
    c_mean = X_relative[membership_probs.argmax(axis=1) == j].mean()
    top_feature = c_mean.idxmax()
    if top_feature == 'Aroma': name = "🌸 香り特化型"
    elif top_feature == 'Body': name = "☕ ボディ・コク重視"
    elif top_feature in ['Flavor', 'Acidity']: name = "🍋 風味・酸味際立ち"
    else: name = "⚖️ マイルド・調和型"
    cluster_names_map[j] = f"{name} (C{j})"

hex_palette = ['#EF553B', '#00CC96', '#AB63FA', '#FFA15A', '#19D3F3', '#FF6692', '#B6E880']
base_colors = [np.array(mcolors.to_rgb(hex_palette[i % len(hex_palette)])) for i in range(n_clusters)]
noise_color = np.array(mcolors.to_rgb('lightgrey'))

blended_colors = []
dominant_clusters = []

for i in range(len(membership_probs)):
    probs = membership_probs[i]
    sum_probs = np.sum(probs)

    c = np.zeros(3)
    for j in range(n_clusters):
        c += probs[j] * base_colors[j]
    if sum_probs < 1.0:
        c += (1.0 - sum_probs) * noise_color

    c = np.clip(c, 0, 1)
    blended_colors.append(f"rgb({int(c[0]*255)}, {int(c[1]*255)}, {int(c[2]*255)})")

    if sum_probs > 0.1:
        dominant_clusters.append(cluster_names_map[np.argmax(probs)])
    else:
        dominant_clusters.append("ノイズ (独自路線)")

grouped['Blended_Color'] = blended_colors
grouped['Dominant_Cluster'] = dominant_clusters

# ==========================================
# 5. プロットの作成
# ==========================================
fig = go.Figure()
unique_clusters = sorted(grouped['Dominant_Cluster'].unique(), key=lambda x: "ZZZ" if "ノイズ" in x else x)

for c_name in unique_clusters:
    df_c = grouped[grouped['Dominant_Cluster'] == c_name]
    fig.add_trace(go.Scatter(
        x=df_c['UMAP_X'], y=df_c['UMAP_Y'],
        mode='markers',
        name=c_name,
        text=df_c['Label'],
        marker=dict(size=12, color=df_c['Blended_Color'], line=dict(width=1, color='white'), opacity=0.9)
    ))

fig.update_layout(
    title='高次元HDBSCAN判定 ＋ UMAP可視化 (6次元の密度でクラスタリング)',
    xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
    yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
    template='plotly_white', width=1000, height=700
)
fig.show()