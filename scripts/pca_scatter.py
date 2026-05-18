import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
import plotly.graph_objects as go

df = pd.read_csv("../data/merged_data_full.csv", index_col=0).reset_index(drop=True)

taste_cols = ["Aroma", "Flavor", "Aftertaste", "Acidity", "Body", "Balance"]
df_taste = df[taste_cols].dropna()
valid_idx = df_taste.index
X = StandardScaler().fit_transform(df_taste)

# --- 3種の座標を事前計算 ---
pca = PCA(n_components=2, random_state=42)
coords_pca = pca.fit_transform(X)
explained = pca.explained_variance_ratio_ * 100

coords_tsne10 = TSNE(n_components=2, perplexity=10, random_state=42).fit_transform(X)
coords_tsne30 = TSNE(n_components=2, perplexity=30, random_state=42).fit_transform(X)

df_plot = df.loc[valid_idx].copy().reset_index(drop=True)

country_jp = {
    "Mexico": "メキシコ", "Colombia": "コロンビア", "Guatemala": "グアテマラ",
    "Brazil": "ブラジル", "Taiwan": "台湾", "United States (Hawaii)": "ハワイ",
    "Honduras": "ホンジュラス", "Costa Rica": "コスタリカ", "Ethiopia": "エチオピア",
    "Tanzania, United Republic Of": "タンザニア", "Uganda": "ウガンダ",
    "Thailand": "タイ", "Nicaragua": "ニカラグア", "Kenya": "ケニア",
    "El Salvador": "エルサルバドル",
}
df_plot["Country_JP"] = df_plot["Country.of.Origin"].map(country_jp).fillna(df_plot["Country.of.Origin"])

color_map = {
    "酸味系":        "#5B8FD4",
    "香り系":        "#5BBD72",
    "バランス系":     "#F0A830",
    "コク・バランス系": "#B06FCC",
    "丸み系":        "#E07070",
}

top_countries_en = df_plot["Country.of.Origin"].value_counts().head(15).index.tolist()

def make_hover(row):
    variety = row["Variety"] if pd.notna(row["Variety"]) else "不明"
    proc = row["ProcessingGroup"] if pd.notna(row["ProcessingGroup"]) else "不明"
    return (
        f"<b>{row['Country_JP']}</b><br>"
        f"品種: {variety}　精製: {proc}<br>"
        f"味クラスター: {row['ClusterName']}<br>"
        f"Acidity: {row['Acidity']:.2f} / Body: {row['Body']:.2f}<br>"
        f"Aroma: {row['Aroma']:.2f} / Flavor: {row['Flavor']:.2f}"
    )

df_plot["hover"] = df_plot.apply(make_hover, axis=1)

# --- 座標セットを辞書で管理 ---
coord_sets = {
    "PCA":           (coords_pca,    f"PC1 ({explained[0]:.1f}%)", f"PC2 ({explained[1]:.1f}%)"),
    "t-SNE (広め)":  (coords_tsne10, "t-SNE 軸1",                   "t-SNE 軸2"),
    "t-SNE (標準)":  (coords_tsne30, "t-SNE 軸1",                   "t-SNE 軸2"),
}

# デフォルト座標
default_key = "t-SNE (広め)"
coords_default = coords_tsne10

for key, (coords, _, _) in coord_sets.items():
    df_plot[f"x_{key}"] = coords[:, 0]
    df_plot[f"y_{key}"] = coords[:, 1]

# ========== Figure ==========
fig = go.Figure()

# ベーストレース（薄い全体）
for cluster, color in color_map.items():
    sub = df_plot[df_plot["ClusterName"] == cluster]
    if sub.empty:
        continue
    fig.add_trace(go.Scatter(
        x=sub[f"x_{default_key}"], y=sub[f"y_{default_key}"],
        mode="markers",
        marker=dict(size=7, color=color, opacity=0.2, line=dict(width=0)),
        hovertext=sub["hover"], hoverinfo="text",
        name=cluster, legendgroup=cluster,
        customdata=np.stack([
            sub[f"x_{k}"] for k in coord_sets
        ] + [
            sub[f"y_{k}"] for k in coord_sets
        ], axis=1),
    ))

# ハイライトトレース（産地別）
for country_en in top_countries_en:
    country_name = country_jp.get(country_en, country_en)
    sub = df_plot[df_plot["Country.of.Origin"] == country_en]
    for cluster, color in color_map.items():
        csub = sub[sub["ClusterName"] == cluster]
        if csub.empty:
            continue
        fig.add_trace(go.Scatter(
            x=csub[f"x_{default_key}"], y=csub[f"y_{default_key}"],
            mode="markers",
            marker=dict(size=14, color=color, opacity=0.95,
                        line=dict(width=2, color="white")),
            hovertext=csub["hover"], hoverinfo="text",
            name=f"{country_name}_{cluster}",
            legendgroup=cluster, showlegend=False,
            visible=False,
            customdata=np.stack([
                csub[f"x_{k}"] for k in coord_sets
            ] + [
                csub[f"y_{k}"] for k in coord_sets
            ], axis=1),
        ))

n_base = sum(1 for c in color_map if not df_plot[df_plot["ClusterName"]==c].empty)
n_total = len(fig.data)

def vis_country(selected_en):
    vis = [True] * n_base
    i = n_base
    for c_en in top_countries_en:
        sub = df_plot[df_plot["Country.of.Origin"] == c_en]
        for cluster in color_map:
            if sub[sub["ClusterName"] == cluster].empty:
                continue
            vis.append(c_en == selected_en)
            i += 1
    return vis

# --- ボタン: 座標切り替え ---
keys = list(coord_sets.keys())

def make_coord_update(key):
    xs = [df_plot.loc[fig.data[i].customdata is not None and True, f"x_{key}"] for i in range(n_base)]
    # Plotly updateで全トレースのx/yを切り替え
    all_x, all_y = [], []
    for trace in fig.data:
        # customdataからインデックスを逆引きするより、直接df_plotを使う
        all_x.append(None)
        all_y.append(None)
    return []

# 座標切り替えはupdatemenus 2つ目で実装
# --- 産地ボタン ---
country_buttons = [dict(
    label="（産地を選ぶ）",
    method="update",
    args=[{"visible": [True]*n_base + [False]*(n_total-n_base)}]
)]
for c_en in top_countries_en:
    c_name = country_jp.get(c_en, c_en)
    country_buttons.append(dict(
        label=c_name, method="update",
        args=[{"visible": vis_country(c_en)}]
    ))

# --- 座標切り替えボタン（x/yを直接差し替え）---
# トレースごとに各座標セットのx,y配列を用意
def build_xy_for_key(key):
    xs, ys = [], []
    i_hi = 0
    country_iter = iter(top_countries_en)
    current_en = None
    hi_counts = {c_en: sum(
        1 for cl in color_map
        if not df_plot[(df_plot["Country.of.Origin"]==c_en)&(df_plot["ClusterName"]==cl)].empty
    ) for c_en in top_countries_en}

    for ti, trace in enumerate(fig.data):
        if ti < n_base:
            cluster = list(color_map.keys())[ti]
            sub = df_plot[df_plot["ClusterName"] == cluster]
            xs.append(sub[f"x_{key}"].tolist())
            ys.append(sub[f"y_{key}"].tolist())
        else:
            # ハイライトトレース → 産地×クラスター順
            idx = ti - n_base
            c_idx = 0
            offset = 0
            for c_en in top_countries_en:
                cnt = hi_counts[c_en]
                if offset + cnt > idx:
                    c_idx_in = idx - offset
                    sub = df_plot[df_plot["Country.of.Origin"] == c_en]
                    cl_list = [cl for cl in color_map if not sub[sub["ClusterName"]==cl].empty]
                    cl = cl_list[c_idx_in] if c_idx_in < len(cl_list) else cl_list[0]
                    csub = sub[sub["ClusterName"] == cl]
                    xs.append(csub[f"x_{key}"].tolist())
                    ys.append(csub[f"y_{key}"].tolist())
                    break
                offset += cnt
    return xs, ys

coord_buttons = []
labels = {"PCA": "PCA（線形）", "t-SNE (広め)": "t-SNE 広め（重なり少）", "t-SNE (標準)": "t-SNE 標準"}
for key in keys:
    xs, ys = build_xy_for_key(key)
    _, xl, yl = coord_sets[key]
    coord_buttons.append(dict(
        label=labels[key], method="update",
        args=[{"x": xs, "y": ys},
              {"xaxis.title.text": xl, "yaxis.title.text": yl}]
    ))

fig.update_layout(
    title=dict(
        text="コーヒー豆 散布図 — 産地を選んで似た豆を探す",
        font=dict(size=17), x=0.5,
    ),
    updatemenus=[
        dict(
            buttons=country_buttons, direction="down",
            x=0.01, y=1.15, xanchor="left", yanchor="top",
            bgcolor="white", bordercolor="#aaa",
            font=dict(size=13),
            pad=dict(r=10),
        ),
        dict(
            buttons=coord_buttons, direction="down",
            x=0.28, y=1.15, xanchor="left", yanchor="top",
            bgcolor="white", bordercolor="#aaa",
            font=dict(size=12),
        ),
    ],
    annotations=[
        dict(text="産地を選ぶ:", xref="paper", yref="paper",
             x=0.01, y=1.2, showarrow=False, font=dict(size=12)),
        dict(text="表示方法:", xref="paper", yref="paper",
             x=0.28, y=1.2, showarrow=False, font=dict(size=12)),
        dict(
            text="💡 ハイライトされた点の<b>周囲</b>にある点が「味が似た豆」です。ホバーで詳細を確認できます。",
            xref="paper", yref="paper", x=0.5, y=-0.07,
            showarrow=False, font=dict(size=12, color="#555"), align="center",
        ),
    ],
    xaxis=dict(title=coord_sets[default_key][1], showgrid=True, gridcolor="#eee", zeroline=False),
    yaxis=dict(title=coord_sets[default_key][2], showgrid=True, gridcolor="#eee", zeroline=False),
    plot_bgcolor="white", paper_bgcolor="white",
    height=650, width=1050,
    legend=dict(title="味クラスター", font=dict(size=12), itemsizing="constant"),
    margin=dict(l=60, r=40, t=140, b=70),
)

fig.write_html("../outputs/html/pca_scatter.html")
print("保存完了: pca_scatter.html")
