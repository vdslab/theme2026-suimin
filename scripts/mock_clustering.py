import pandas as pd
import numpy as np
import plotly.express as px
import umap
import hdbscan
from sklearn.preprocessing import StandardScaler

# ==========================================
# 1. データの読み込みと前処理
# ==========================================
df = pd.read_csv("data/merged_data_cleaned.csv")
group_cols = ['Country.of.Origin', 'Processing.Method']
taste_cols = ['Aroma', 'Flavor', 'Aftertaste', 'Acidity', 'Body', 'Balance']

df_clean = df.dropna(subset=group_cols).copy()
grouped = df_clean.groupby(group_cols)[taste_cols].mean().reset_index()

valid_counts = df_clean.groupby(group_cols).size()
valid_groups = valid_counts[valid_counts >= 3].reset_index()
grouped = pd.merge(grouped, valid_groups[group_cols], on=group_cols)
grouped['Label'] = grouped['Country.of.Origin'] + " (" + grouped['Processing.Method'].str.split('/').str[0].str.strip() + ")"

X = grouped[taste_cols]
row_means = X.mean(axis=1)
X_relative = X.div(row_means, axis=0)
X_scaled = StandardScaler().fit_transform(X_relative)

# ==========================================
# 2. 【改善策】クラスタリング用の中次元空間の生成
# ==========================================
# 空間を歪めず（min_dist=0.0）、構造を維持しやすい3次元に圧縮
cluster_mapper = umap.UMAP(
    n_components=3,      # 2Dではなく3Dにして情報損失を防ぐ
    min_dist=0.0,        # ★重要：見た目のためのバラけを一切行わず、真の密度を保持する
    n_neighbors=5,
    random_state=42
)
X_clusterable = cluster_mapper.fit_transform(X_scaled)

# ==========================================
# 3. 中次元空間に対してHDBSCANを実行
# ==========================================
# 抽出された本質的な構造に対して密度を計算
clusterer = hdbscan.HDBSCAN(min_cluster_size=4, min_samples=3)
cluster_labels = clusterer.fit_predict(X_clusterable)

# ==========================================
# 4. 【可視化用】の2次元マップの生成
# ==========================================
# 人間が見やすいように、少し隙間（min_dist=0.1）をあけて2Dに展開
visual_mapper = umap.UMAP(
    n_components=2,
    min_dist=0.1,
    n_neighbors=5,
    random_state=42
)
X_2d = visual_mapper.fit_transform(X_scaled)

grouped['UMAP_X'] = X_2d[:, 0]
grouped['UMAP_Y'] = X_2d[:, 1]

# クラスタ名の割り当て（最有力特徴量で命名）
cluster_names_map = {}
for c in np.unique(cluster_labels):
    if c == -1:
        cluster_names_map[c] = "⚪ ノイズ (独自路線)"
    else:
        c_mean = X_relative[cluster_labels == c].mean()
        top = c_mean.idxmax()
        if top == 'Aroma': name = f"🌸 香り特化型 (Cluster {c})"
        elif top == 'Body': name = f"☕ ボディ・コク重視 (Cluster {c})"
        elif top in ['Flavor', 'Acidity']: name = f"🍋 風味・酸味際立ち (Cluster {c})"
        else: name = f"⚖️ マイルド・調和型 (Cluster {c})"
        cluster_names_map[c] = name

grouped['Cluster_Name'] = [cluster_names_map[l] for l in cluster_labels]

# ==========================================
# 5. マップの描画
# ==========================================
fig = px.scatter(
    grouped, x='UMAP_X', y='UMAP_Y', text='Label',
    color='Cluster_Name', hover_name='Label',
    title='【公式推奨ハイブリッド】クラスタリング用UMAP(3D) ＋ HDBSCAN ＋ 可視化用UMAP(2D)',
    width=1100, height=800
)

# ノイズの色設定
colors = px.colors.qualitative.Plotly
for i, trace in enumerate(fig.data):
    if "ノイズ" in trace.name:
        trace.marker.color = 'lightgrey'
        trace.marker.opacity = 0.5
    else:
        trace.marker.color = colors[i % len(colors)]
        trace.marker.opacity = 0.9

fig.update_traces(
    textposition='top center', textfont=dict(size=10),
    marker=dict(size=12, line=dict(width=1, color='white'))
)

fig.update_layout(
    template='plotly_white',
    xaxis=dict(showgrid=False, zeroline=False, showticklabels=False, title=''),
    yaxis=dict(showgrid=False, zeroline=False, showticklabels=False, title=''),
    legend_title_text='HDBSCAN 判定結果'
)
# fig.show()

# ==========================================
# 6. 結果の保存 (JSON出力)
# ==========================================
import os
os.makedirs("src/data", exist_ok=True)
grouped.to_json("src/data/coffee_clusters.json", orient="records", force_ascii=False, indent=2)
print("[OK] src/data/coffee_clusters.json saved")