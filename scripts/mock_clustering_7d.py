import pandas as pd
import numpy as np
import umap
import hdbscan
from sklearn.preprocessing import StandardScaler
import matplotlib.colors as mcolors
import os

def run_clustering_7d():
    # 1. データの読み込み
    df = pd.read_csv("data/coffee_7d_features.csv")
    df['Variety'] = df['Variety'].fillna('Unknown')
    group_cols = ['Country.of.Origin', 'Processing.Method', 'Variety']
    
    # 新しい7次元特徴量
    taste_cols = ['Aroma', 'Flavor', 'Aftertaste', 'Acidity', 'Body', 'Balance', 'Average.Score']

    df_clean = df.dropna(subset=['Country.of.Origin', 'Processing.Method']).copy()

    # ==========================================
    # フェーズ1: 個別データに対するUMAP座標計算
    # ==========================================
    print("Calculating individual UMAP coordinates (2D)...")
    # 2次元描画（座標計算）には、Average.Scoreを除いた偏差の6次元データのみを使用する
    X_all = df_clean[['Aroma', 'Flavor', 'Aftertaste', 'Acidity', 'Body', 'Balance']]
    
    # 既に各特徴量が「平均からの偏差」となっており、7次元目は「平均評価値」なので
    # 相対値化（各行の平均で割る処理）は行わず、各カラムのスケールを揃える標準化のみ行う
    X_all_scaled = StandardScaler().fit_transform(X_all)

    visual_mapper_all = umap.UMAP(n_components=2, min_dist=0.1, n_neighbors=5, random_state=42)
    X_all_2d = visual_mapper_all.fit_transform(X_all_scaled)
    df_clean['UMAP_X'] = X_all_2d[:, 0]
    df_clean['UMAP_Y'] = X_all_2d[:, 1]

    # ==========================================
    # フェーズ2: 集約データに対するクラスタリング（色の決定）
    # ==========================================
    print("Calculating group clusters (3D UMAP + HDBSCAN)...")
    # 産地・精製方法・品種で集約し、平均値をとる
    grouped = df_clean.groupby(group_cols)[taste_cols].mean().reset_index()

    # サンプル数3以上のグループに絞り込む（ノイズ削減のため）
    valid_counts = df_clean.groupby(group_cols).size()
    valid_groups = valid_counts[valid_counts >= 3].reset_index()
    grouped = pd.merge(grouped, valid_groups[group_cols], on=group_cols)

    X_grouped = grouped[taste_cols]
    X_grouped_scaled = StandardScaler().fit_transform(X_grouped)

    # UMAP(3D)で密度空間を作成
    cluster_mapper = umap.UMAP(n_components=3, min_dist=0.0, n_neighbors=5, random_state=42)
    X_clusterable = cluster_mapper.fit_transform(X_grouped_scaled)

    # HDBSCANでクラスタリング
    clusterer = hdbscan.HDBSCAN(min_cluster_size=4, min_samples=3, prediction_data=True)
    cluster_labels = clusterer.fit_predict(X_clusterable)
    membership_probs = hdbscan.all_points_membership_vectors(clusterer)
    n_clusters = membership_probs.shape[1]

    # クラスタ名の割り当て（最有力特徴量で命名）
    cluster_names_map = {}
    for c in np.unique(cluster_labels):
        if c == -1:
            cluster_names_map[c] = "ノイズ (独自路線)"
        else:
            c_mean = X_grouped.loc[cluster_labels == c].mean()
            top = c_mean.idxmax()
            if top == 'Average.Score': name = f"全体高評価 (C{c})"
            elif top == 'Aroma': name = f"香り特化型 (C{c})"
            elif top == 'Body': name = f"ボディ・コク重視 (C{c})"
            elif top in ['Flavor', 'Acidity']: name = f"風味・酸味際立ち (C{c})"
            else: name = f"マイルド・調和型 (C{c})"
            cluster_names_map[c] = name

    # カラーブレンド計算
    hex_palette = ['#EF553B', '#00CC96', '#AB63FA', '#FFA15A', '#19D3F3', '#FF6692', '#B6E880']
    base_colors = [np.array(mcolors.to_rgb(hex_palette[i % len(hex_palette)])) for i in range(n_clusters)]
    noise_color = np.array(mcolors.to_rgb('lightgrey'))

    blended_colors = []
    dominant_clusters = []
    probs_list = []

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

        p_dict = {cluster_names_map[j]: float(probs[j]) for j in range(n_clusters)}
        p_dict["noise"] = float(1.0 - sum_probs)
        probs_list.append(p_dict)

    grouped['Blended_Color'] = blended_colors
    grouped['Cluster_Name'] = dominant_clusters
    grouped['Probs'] = probs_list

    # ==========================================
    # フェーズ3: 結果のマージと出力
    # ==========================================
    print("Merging results and saving JSON...")
    os.makedirs("src/data", exist_ok=True)

    # grouped から色と所属クラスタだけを元の全データにマージ (left join)
    merge_cols = ['Country.of.Origin', 'Processing.Method', 'Variety', 'Blended_Color', 'Cluster_Name', 'Probs']
    merged_df = pd.merge(df_clean, grouped[merge_cols], on=['Country.of.Origin', 'Processing.Method', 'Variety'], how='left')

    # サンプル数が少なくてクラスタリングから弾かれたグループはノイズとして扱う
    merged_df['Blended_Color'] = merged_df['Blended_Color'].fillna('rgb(211, 211, 211)')
    merged_df['Cluster_Name'] = merged_df['Cluster_Name'].fillna('ノイズ (少数派)')
    merged_df['Probs'] = merged_df['Probs'].apply(lambda x: x if isinstance(x, dict) else {"noise": 1.0})

    # 各ノードが一意になるようにラベルを付与
    merged_df['Label'] = merged_df['Country.of.Origin'] + " (" + merged_df['Processing.Method'].str.split('/').str[0].str.strip() + ") #" + merged_df.index.astype(str)

    merged_df.to_json("src/data/coffee_clusters.json", orient="records", force_ascii=False, indent=2)
    print(f"[OK] src/data/coffee_clusters.json saved (Total nodes: {len(merged_df)})")

if __name__ == "__main__":
    run_clustering_7d()
