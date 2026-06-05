# 1. 必要なライブラリのインストール（未インストールの場合は実行してください）
# !pip install umap-learn hdbscan

file_path = '/content/drive/MyDrive/merged_data_cleaned.csv'

from google.colab import output
output.enable_custom_widget_manager()

import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
import umap
import hdbscan
from sklearn.preprocessing import StandardScaler
import matplotlib.colors as mcolors

# ==========================================
# 1. データの読み込みと前処理
# ==========================================
df = pd.read_csv(file_path)

# ★エラーの原因修正：集計キーにしっかりと 'Variety' を含める
group_cols = ['Country.of.Origin', 'Processing.Method', 'Variety']
taste_cols = ['Aroma', 'Flavor', 'Aftertaste', 'Acidity', 'Body', 'Balance']

df_clean = df.dropna(subset=group_cols).copy()
# 産地・精製方法・品種ごとに味を平均化
grouped = df_clean.groupby(group_cols)[taste_cols].mean().reset_index()

# 安定したクラスタを作るため、同じ「産地×精製方法」でサンプル数が3以上のグループに絞る
valid_counts = df_clean.groupby(['Country.of.Origin', 'Processing.Method']).size()
valid_groups = valid_counts[valid_counts >= 3].reset_index()
grouped = pd.merge(grouped, valid_groups[['Country.of.Origin', 'Processing.Method']], on=['Country.of.Origin', 'Processing.Method'])

# グラフ上のテキストラベル（産地と精製方法を表示）
grouped['Label'] = grouped['Country.of.Origin'] + " (" + grouped['Processing.Method'].str.split('/').str[0].str.strip() + ")"

# 相対評価化（品質バイアス除去）
X = grouped[taste_cols]
row_means = X.mean(axis=1)
X_relative = X.div(row_means, axis=0)
X_scaled = StandardScaler().fit_transform(X_relative)

# ==========================================
# 2. UMAPによる2次元配置
# ==========================================
reducer = umap.UMAP(n_neighbors=5, min_dist=0.05, metric='euclidean', random_state=42)
umap_result = reducer.fit_transform(X_scaled)
grouped['UMAP_X'] = umap_result[:, 0]
grouped['UMAP_Y'] = umap_result[:, 1]

# ==========================================
# 3. HDBSCANによるソフトクラスタリング（確率計算）
# ==========================================
clusterer = hdbscan.HDBSCAN(min_cluster_size=4, min_samples=3, cluster_selection_epsilon=0.5, prediction_data=True)
clusterer.fit(umap_result)

membership_probs = hdbscan.all_points_membership_vectors(clusterer)
n_clusters = membership_probs.shape[1]

# ==========================================
# 4. 各クラスタの味覚特性の同定と自動命名
# ==========================================
cluster_names_map = {}
for j in range(n_clusters):
    c_mean = X_relative[membership_probs.argmax(axis=1) == j].mean()
    top_feature = c_mean.idxmax()
    if top_feature == 'Aroma': name = "🌸 香り特化型"
    elif top_feature == 'Body': name = "☕ ボディ・コク重視"
    elif top_feature in ['Flavor', 'Acidity']: name = "🍋 風味・酸味際立ち"
    else: name = "⚖️ マイルド・調和型"
    cluster_names_map[j] = name

cluster_descriptions = {
    "🌸 香り特化型": "：ドリップした瞬間の華やかなアロマが際立つタイプ",
    "☕ ボディ・コク重視": "：口当たりが重厚で、心地よい苦味やコクが続くタイプ",
    "🍋 風味・酸味際立ち": "：フルーティーで爽やかな酸味や果実感が広がるタイプ",
    "⚖️ マイルド・調和型": "：酸味・苦味の調和が取れた、すっきりプレーンなタイプ",
    "ノイズ (独自路線)": "：どの型にも当てはまらない、ユニークな独自の味わい"
}

# ★カラーパレットを10色以上に拡張 (14色)
hex_palette = [
    '#EF553B', '#00CC96', '#AB63FA', '#FFA15A', '#19D3F3',
    '#FF6692', '#B6E880', '#FF97FF', '#FECB52', '#636EFA',
    '#32CD32', '#FFD700', '#1E90FF', '#FF4500'
]
base_colors = [np.array(mcolors.to_rgb(hex_palette[i % len(hex_palette)])) for i in range(n_clusters)]
noise_color = np.array(mcolors.to_rgb('lightgrey'))

blended_colors = []
dominant_clusters = []
max_probs = []
hover_texts = []

# ==========================================
# 5. 全特徴量・全確率を含んだホバーテキストの作成
# ==========================================
for i, row in grouped.iterrows():
    probs = membership_probs[i]
    sum_probs = np.sum(probs)

    # グラデーション色の計算
    c = np.zeros(3)
    for j in range(n_clusters):
        c += probs[j] * base_colors[j]
    if sum_probs < 1.0:
        c += (1.0 - sum_probs) * noise_color
    c = np.clip(c, 0, 1)
    blended_colors.append(f"rgb({int(c[0]*255)}, {int(c[1]*255)}, {int(c[2]*255)})")

    # 確率の内訳テキストの生成
    prob_details = ""
    for j in range(n_clusters):
        c_display_name = cluster_names_map[j]
        prob_details += f"  ・{c_display_name}: {probs[j]*100:.1f}%<br>"
    noise_p = (1.0 - sum_probs) * 100
    prob_details += f"  ・⚪ 独自路線 (Noise): {noise_p:.1f}%"

    # 最有力クラスタの特定
    if sum_probs > 0.1:
        best_idx = np.argmax(probs)
        name = cluster_names_map[best_idx]
        dominant_clusters.append(name)
        max_probs.append(probs[best_idx] * 100)
    else:
        dominant_clusters.append("ノイズ (独自路線)")
        max_probs.append(noise_p)

    # HTMLによる詳細なホバーテキストの構築
    h_text = (
        f"<b>【豆の詳細情報】</b><br>"
        f"産地 (Country): {row['Country.of.Origin']}<br>"
        f"精製方法 (Method): {row['Processing.Method']}<br>"
        f"品種 (Variety): {row['Variety']}<br><br>"
        f"<b>【味覚クラスタ所属確率】</b><br>"
        f"{prob_details}<br><br>"
        f"<b>【基本味覚スコア（平均）】</b><br>"
        f"  ・Aroma (香り): {row['Aroma']:.2f}<br>"
        f"  ・Flavor (風味): {row['Flavor']:.2f}<br>"
        f"  ・Acidity (酸味): {row['Acidity']:.2f}<br>"
        f"  ・Body (コク): {row['Body']:.2f}"
    )
    hover_texts.append(h_text)

grouped['Blended_Color'] = blended_colors
grouped['Dominant_Cluster'] = dominant_clusters
grouped['Max_Probability'] = np.round(max_probs, 1)
grouped['Hover_Text'] = hover_texts

# ==========================================
# 6. トレースの追加と描画（ピュアな凡例の維持）
# ==========================================
fig = go.Figure()
unique_clusters = sorted(grouped['Dominant_Cluster'].unique(), key=lambda x: "ZZZ" if "ノイズ" in x else x)

pure_color_map = {"ノイズ (独自路線)": "lightgrey"}
for j in range(n_clusters):
    pure_color_map[cluster_names_map[j]] = hex_palette[j % len(hex_palette)]

for c_name in unique_clusters:
    df_c = grouped[grouped['Dominant_Cluster'] == c_name]
    legend_text = c_name + cluster_descriptions.get(c_name, "")
    pure_c = pure_color_map[c_name]

    # 凡例用のダミートレース（透明な点にピュアな色を設定）
    fig.add_trace(go.Scatter(
        x=[None], y=[None],
        mode='markers',
        name=legend_text,
        legendgroup=c_name,
        marker=dict(size=14, color=pure_c, line=dict(width=1, color='white'))
    ))

    # 実際のデータトレース（グラデーション色）
    fig.add_trace(go.Scatter(
        x=df_c['UMAP_X'], y=df_c['UMAP_Y'],
        mode='markers',
        name=c_name,
        text=df_c['Label'],
        hovertext=df_c['Hover_Text'],
        hoverinfo='text',
        showlegend=False,   # ダミーと運命を共にするため自身の凡例は隠す
        legendgroup=c_name,
        marker=dict(
            size=13,
            color=df_c['Blended_Color'],
            line=dict(width=1, color='white'),
            opacity=0.9
        )
    ))

fig.update_layout(
    title='HDBSCAN ソフトクラスタリング味覚マップ（詳細確率・産地情報ホバー付き）',
    xaxis=dict(showgrid=False, zeroline=False, showticklabels=False, title=''),
    yaxis=dict(showgrid=False, zeroline=False, showticklabels=False, title=''),
    template='plotly_white',
    width=1100, height=800,
    showlegend=True,
    legend=dict(orientation="v", yanchor="top", y=-0.02, xanchor="left", x=0, font=dict(size=11))
)

fig.show()