import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import os

def plot_distributions():
    print("Loading data...")
    df = pd.read_csv("data/coffee_7d_features.csv")
    taste_cols = ['Aroma', 'Flavor', 'Aftertaste', 'Acidity', 'Body', 'Balance']

    # アーティファクトディレクトリのパス（絶対パス）
    out_dir = r"C:\Users\mirac_yny\.gemini\antigravity-ide\brain\fb053abd-064b-48e1-ab76-2c8d92862532\artifacts"
    os.makedirs(out_dir, exist_ok=True)
    
    # 1. 全体の偏差分布ヒストグラム
    out_path_global = os.path.join(out_dir, "deviation_histograms_global.png")
    fig, axes = plt.subplots(2, 3, figsize=(15, 10))
    axes = axes.flatten()

    for i, col in enumerate(taste_cols):
        df[col].plot(kind='hist', bins=40, ax=axes[i], color='skyblue', edgecolor='black', alpha=0.7)
        axes[i].set_title(f'Overall Distribution of {col} (Deviation)')
        axes[i].axvline(x=0, color='red', linestyle='--', alpha=0.5, label='Mean=0')
        axes[i].set_xlim(-1.5, 1.5)
        axes[i].legend()

    plt.tight_layout()
    plt.savefig(out_path_global, dpi=150)
    plt.close()
    print(f"Saved global distribution to {out_path_global}")

    # 2. 全グループの偏差分布比較（1枚に重ねる）
    df['Group'] = df['Country.of.Origin'].fillna('Unknown') + " (" + df['Processing.Method'].fillna('Unknown') + ")"
    # KDEプロットは少なくとも2サンプル以上必要
    group_counts = df['Group'].value_counts()
    valid_groups = group_counts[group_counts >= 2].index.tolist()
    
    out_path_all = os.path.join(out_dir, "deviation_histograms_all_groups_v2.png")
    fig2, axes2 = plt.subplots(2, 3, figsize=(18, 10))
    axes2 = axes2.flatten()
    
    # 多数の線を引くためカラーマップを使用
    cmap = plt.get_cmap('tab20')
    
    # KDEの評価範囲を固定し、線が途中で切れないようにする
    eval_points = np.linspace(-1.5, 1.5, 500)
    
    for i, col in enumerate(taste_cols):
        for j, grp in enumerate(valid_groups):
            subset = df[df['Group'] == grp]
            color = cmap(j % 20)
            
            # 分散が完全ゼロの場合のエラー回避のため、ごく微小なノイズを足す
            data_series = subset[col].copy()
            if data_series.std() == 0:
                data_series += np.random.normal(0, 1e-4, size=len(data_series))
                
            # ind=eval_points を指定して裾野まで強制的に描画させる
            # bw_method=0.15 を指定して平滑化の度合いを固定し、針のように高くならないようにする
            data_series.plot(kind='kde', ax=axes2[i], color=color, alpha=0.7, linewidth=1.5, ind=eval_points, bw_method=0.15)
            
        axes2[i].set_title(f'{col} (All Valid Groups)')
        axes2[i].axvline(x=0, color='black', linestyle='--', linewidth=2)
        axes2[i].set_xlim(-1.5, 1.5)
        # 異常な密度（100など）によってY軸がスケールアウトし、大半の分布が見えなくなるのを防ぐため、
        # Y軸の上限を強制的に固定（クリッピング）する
        axes2[i].set_ylim(0, 10)
        # グループ数が多すぎるため凡例は非表示

    plt.tight_layout()
    plt.savefig(out_path_all, dpi=150)
    plt.close()
    print(f"Saved all groups distribution to {out_path_all}")

if __name__ == "__main__":
    plot_distributions()

if __name__ == "__main__":
    plot_distributions()
