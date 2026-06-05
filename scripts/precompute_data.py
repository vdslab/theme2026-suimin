import pandas as pd
import numpy as np
import json
import umap
import hdbscan
from sklearn.preprocessing import StandardScaler
import matplotlib.colors as mcolors
import os

def process_coffee_data(csv_path, group_cols, output_path):
    print(f"Processing {csv_path} with grouping {group_cols}...")
    df = pd.read_csv(csv_path)
    
    taste_cols = ['Aroma', 'Flavor', 'Aftertaste', 'Acidity', 'Body', 'Balance']
    
    # Drop rows missing grouping columns or taste columns
    df_clean = df.dropna(subset=group_cols + taste_cols).copy()
    
    # Check sample size for each (Country, Processing Method)
    # The Colab code groups by country & method & variety, but filters on country & method count >= 3
    valid_counts = df_clean.groupby(['Country.of.Origin', 'Processing.Method']).size()
    valid_groups = valid_counts[valid_counts >= 3].reset_index()
    
    df_filtered = pd.merge(df_clean, valid_groups[['Country.of.Origin', 'Processing.Method']], on=['Country.of.Origin', 'Processing.Method'])
    
    # Perform grouping
    grouped = df_filtered.groupby(group_cols)[taste_cols].mean().reset_index()
    
    # Add mean altitude
    altitudes = df_filtered.groupby(group_cols)['altitude_mean_meters'].mean().reset_index()
    grouped = pd.merge(grouped, altitudes, on=group_cols)
    
    # Add count of samples in each group
    group_sizes = df_filtered.groupby(group_cols).size().reset_index(name='sample_count')
    grouped = pd.merge(grouped, group_sizes, on=group_cols)
    
    # If Variety is not in grouping columns (Mode A), collect varieties as a list
    if 'Variety' not in group_cols:
        varieties = df_filtered.groupby(group_cols)['Variety'].apply(lambda x: sorted(list(set(x.dropna().astype(str))))).reset_index()
        grouped = pd.merge(grouped, varieties, on=group_cols)
        grouped.rename(columns={'Variety': 'varieties'}, inplace=True)
    else:
        # If Variety is in grouping columns (Mode B), it is already a column, convert to list for consistency
        grouped['Variety'] = grouped['Variety'].apply(lambda v: [str(v)] if pd.notna(v) else [])
        grouped.rename(columns={'Variety': 'varieties'}, inplace=True)
    
    # Rename column names for output compatibility
    grouped.rename(columns={
        'Country.of.Origin': 'country',
        'Processing.Method': 'method'
    }, inplace=True)
    
    # Check if we have enough points to cluster
    num_points = len(grouped)
    print(f"Number of grouped nodes: {num_points}")
    if num_points < 5:
        print("Too few points to cluster.")
        return
        
    # Relative scaling (quality bias removal)
    X = grouped[taste_cols]
    row_means = X.mean(axis=1)
    X_relative = X.div(row_means, axis=0)
    X_scaled = StandardScaler().fit_transform(X_relative)
    
    # UMAP dimensional reduction (2D)
    # n_neighbors=5, min_dist=0.05, metric='euclidean', random_state=42
    # Adjust n_neighbors if number of points is very small
    n_neighbors = min(5, num_points - 1)
    reducer = umap.UMAP(n_neighbors=n_neighbors, min_dist=0.05, metric='euclidean', random_state=42)
    umap_result = reducer.fit_transform(X_scaled)
    grouped['UMAP_X'] = umap_result[:, 0]
    grouped['UMAP_Y'] = umap_result[:, 1]
    
    # HDBSCAN clustering
    # min_cluster_size=4, min_samples=3
    # Adjust clustering parameters if num_points is small
    min_cluster_size = min(4, max(2, num_points // 5))
    min_samples = min(3, max(1, min_cluster_size - 1))
    print(f"HDBSCAN parameters: min_cluster_size={min_cluster_size}, min_samples={min_samples}")
    
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        cluster_selection_epsilon=0.5,
        prediction_data=True
    )
    clusterer.fit(umap_result)
    
    membership_probs = hdbscan.all_points_membership_vectors(clusterer)
    n_clusters = membership_probs.shape[1]
    print(f"Number of clusters found: {n_clusters}")
    
    # Identify taste profiles and auto-name clusters based on top 2 features
    feature_translation = {
        'Aroma': '香り',
        'Flavor': '風味',
        'Aftertaste': '後味',
        'Acidity': '酸味',
        'Body': 'コク',
        'Balance': 'バランス'
    }
    
    cluster_names_map = {}
    for j in range(n_clusters):
        cluster_nodes = X_relative[membership_probs.argmax(axis=1) == j]
        if len(cluster_nodes) > 0:
            c_mean = cluster_nodes.mean()
            top_2 = c_mean.nlargest(2).index.tolist()
            name = f"✨ {feature_translation[top_2[0]]}・{feature_translation[top_2[1]]}型"
        else:
            name = "⚖️ マイルド型"
            
        # Ensure uniqueness
        base_name = name
        suffix = 1
        while name in cluster_names_map.values():
            suffix += 1
            name = f"{base_name} ({suffix})"
        cluster_names_map[j] = name
        
    cluster_descriptions = {}
    for j in range(n_clusters):
        c_name = cluster_names_map[j]
        raw_name = c_name.split(" (")[0].replace("✨ ", "")
        cluster_descriptions[c_name] = f"：{raw_name}が際立つ個性的な味わい"
    cluster_descriptions["ノイズ (独自路線)"] = "：どの型にも当てはまらない、ユニークな独自の味わい"
    
    hex_palette = [
        '#EF553B', '#00CC96', '#AB63FA', '#FFA15A', '#19D3F3',
        '#FF6692', '#B6E880', '#FF97FF', '#FECB52', '#636EFA',
        '#32CD32', '#FFD700', '#1E90FF', '#FF4500'
    ]
    base_colors = [np.array(mcolors.to_rgb(hex_palette[i % len(hex_palette)])) for i in range(n_clusters)]
    noise_color = np.array(mcolors.to_rgb('lightgrey'))
    
    # Build nodes list
    nodes = []
    for i, row in grouped.iterrows():
        probs = membership_probs[i]
        sum_probs = np.sum(probs)
        
        # Color blending
        c = np.zeros(3)
        for j in range(n_clusters):
            c += probs[j] * base_colors[j]
        if sum_probs < 1.0:
            c += (1.0 - sum_probs) * noise_color
        c = np.clip(c, 0, 1)
        rgb_color = f"rgb({int(c[0]*255)}, {int(c[1]*255)}, {int(c[2]*255)})"
        
        # Dominant cluster
        if sum_probs > 0.1:
            best_idx = np.argmax(probs)
            dom_cluster = cluster_names_map[best_idx]
            max_prob = probs[best_idx] * 100
        else:
            dom_cluster = "ノイズ (独自路線)"
            max_prob = (1.0 - sum_probs) * 100
            
        prob_dict = {}
        for j in range(n_clusters):
            prob_dict[cluster_names_map[j]] = float(probs[j])
        prob_dict["ノイズ (独自路線)"] = float(1.0 - sum_probs)
        
        # Clean method text for label
        method_short = str(row['method']).split('/')[0].strip() if pd.notna(row['method']) else 'Unknown'
        label = f"{row['country']} ({method_short})"
        if 'Variety' in group_cols:
            var_name = row['varieties'][0] if len(row['varieties']) > 0 else 'Unknown'
            label += f" - {var_name}"
        
        taste_dict = {col: float(row[col]) for col in taste_cols}
        
        mean_alt = row['altitude_mean_meters']
        altitude_text = f"{int(mean_alt):,}m" if pd.notna(mean_alt) and mean_alt > 0 else "1,200m - 1,800m"
        
        node = {
            "id": f"node_{i}",
            "country": str(row['country']),
            "method": str(row['method']),
            "varieties": [v for v in row['varieties'] if v != 'nan' and str(v) != 'None' and str(v) != 'Other'],
            "altitude": altitude_text,
            "x": float(row['UMAP_X']),
            "y": float(row['UMAP_Y']),
            "taste": taste_dict,
            "dominant_cluster": dom_cluster,
            "max_prob": float(max_prob),
            "probs": prob_dict,
            "color": rgb_color,
            "label": label,
            "sample_count": int(row['sample_count'])
        }
        nodes.append(node)
        
    # Build cluster legend info
    unique_clusters = list(set([n['dominant_cluster'] for n in nodes]))
    unique_clusters = sorted(unique_clusters, key=lambda x: "ZZZ" if "ノイズ" in x else x)
    
    cluster_metadata = []
    for c_name in unique_clusters:
        if c_name == "ノイズ (独自路線)":
            pure_c = "lightgrey"
        else:
            # Find which index this cluster corresponds to
            idx = None
            for k, name in cluster_names_map.items():
                if name == c_name:
                    idx = k
                    break
            pure_c = hex_palette[idx % len(hex_palette)] if idx is not None else "lightgrey"
            
        cluster_metadata.append({
            "name": c_name,
            "description": cluster_descriptions.get(c_name, ""),
            "color": pure_c
        })
        
    output_data = {
        "nodes": nodes,
        "clusters": cluster_metadata
    }
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    print(f"Saved precomputed data to {output_path}")

if __name__ == "__main__":
    csv_file = "data/merged_data_cleaned.csv"
    
    # Mode A: Group by Country + Method
    process_coffee_data(csv_file, ['Country.of.Origin', 'Processing.Method'], "src/data/coffee_data_grouped.json")
    
    # Mode B: Group by Country + Method + Variety
    process_coffee_data(csv_file, ['Country.of.Origin', 'Processing.Method', 'Variety'], "src/data/coffee_data_variety.json")
