import pandas as pd
import os

def create_7d_features():
    print("Loading data...")
    # データの読み込み
    df = pd.read_csv("data/merged_data_cleaned.csv")
    
    # 6つの味覚特徴量
    taste_cols = ['Aroma', 'Flavor', 'Aftertaste', 'Acidity', 'Body', 'Balance']
    
    # 1. 各豆の特徴量すべて（6種類）の平均値を取り、"平均評価値"として保存（第7特徴量）
    print("Calculating Average.Score...")
    df['Average.Score'] = df[taste_cols].mean(axis=1)
    
    # 2. 6種類の各特徴量に対して、その特徴量の値から"平均評価値"の値を引いて偏差にし、元のデータを上書き
    print("Calculating deviations...")
    for col in taste_cols:
        df[col] = df[col] - df['Average.Score']
        
    # 保存ファイル名の設定
    output_path = "data/coffee_7d_features.csv"
    
    # 保存
    print(f"Saving to {output_path}...")
    df.to_csv(output_path, index=False)
    
    print("Done! The new 7D feature dataset has been created.")
    
    # 念のため先頭数行の特徴量だけを表示して確認
    print("\n[Preview of features (First 3 rows)]")
    preview_cols = ['Country.of.Origin', 'Processing.Method', 'Variety'] + taste_cols + ['Average.Score']
    print(df[preview_cols].head(3))

if __name__ == "__main__":
    create_7d_features()
