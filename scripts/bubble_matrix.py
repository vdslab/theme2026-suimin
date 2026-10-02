import pandas as pd
import numpy as np
from sklearn.preprocessing import normalize
from sklearn.cluster import AgglomerativeClustering
import plotly.graph_objects as go

df = pd.read_csv('../data/merged_data_full.csv', index_col=0).reset_index(drop=True)
taste_cols = ['Aroma','Flavor','Aftertaste','Acidity','Body','Balance']
df_taste = df[taste_cols].dropna()
valid_idx = df_taste.index

X_norm = normalize(df_taste.values, norm='l2')
labels = AgglomerativeClustering(n_clusters=8, linkage='ward').fit_predict(X_norm)

df_plot = df.loc[valid_idx].copy().reset_index(drop=True)
df_plot['Cluster8'] = labels

cluster_names = {
    0: '低スコア系', 1: '鮮やか酸味系', 2: 'まろやかバランス系',
    3: 'コク重視系',  4: '高バランス系',  5: '外れ値',
    6: '標準バランス系', 7: 'コク・バランス系',
}
df_plot['ClusterName8'] = df_plot['Cluster8'].map(cluster_names)

# 国名日本語
country_jp = {
    'Mexico':'メキシコ','Colombia':'コロンビア','Guatemala':'グアテマラ',
    'Brazil':'ブラジル','Taiwan':'台湾','United States (Hawaii)':'ハワイ',
    'Honduras':'ホンジュラス','Costa Rica':'コスタリカ','Ethiopia':'エチオピア',
    'Tanzania, United Republic Of':'タンザニア','Uganda':'ウガンダ',
    'Thailand':'タイ','Nicaragua':'ニカラグア','Kenya':'ケニア',
    'El Salvador':'エルサルバドル',
}
df_plot['Country_JP'] = df_plot['Country.of.Origin'].map(country_jp)
df_plot = df_plot[df_plot['Country_JP'].notna()].copy()

# 国の順序（件数降順）
country_order = df_plot['Country_JP'].value_counts().index.tolist()

# 味クラスターの順序・色
taste_order = [
    '鮮やか酸味系','まろやかバランス系','標準バランス系',
    'コク・バランス系','コク重視系','高バランス系','低スコア系','外れ値',
]
color_map = {
    '鮮やか酸味系':    '#5B8FD4',
    'まろやかバランス系': '#A8D86E',
    '標準バランス系':   '#B06FCC',
    'コク・バランス系': '#5BBD72',
    'コク重視系':      '#C17F3E',
    '高バランス系':    '#F0A830',
    '低スコア系':      '#AAAAAA',
    '外れ値':          '#FF6666',
}

# 集計: 国内での味クラスター割合
counts = df_plot.groupby(['Country_JP','ClusterName8']).size().reset_index(name='count')
totals = df_plot.groupby('Country_JP').size().reset_index(name='total')
counts = counts.merge(totals, on='Country_JP')
counts['pct'] = counts['count'] / counts['total'] * 100

MAX_SIZE = 58
max_pct = counts['pct'].max()

fig = go.Figure()

for taste in taste_order:
    sub = counts[counts['ClusterName8'] == taste].set_index('Country_JP')
    color = color_map[taste]

    x_vals, y_vals, sizes, texts, hovers = [], [], [], [], []
    for country in country_order:
        if country not in sub.index:
            continue
        row = sub.loc[country]
        p = row['pct']
        c = int(row['count'])
        x_vals.append(country)
        y_vals.append(taste)
        sizes.append((p / max_pct) * MAX_SIZE)
        texts.append(f"{p:.0f}%" if p >= 8 else '')
        hovers.append(
            f"<b>{country}</b><br>味: {taste}<br>"
            f"割合: {p:.1f}%<br>件数: {c}件 / {int(row['total'])}件"
        )

    fig.add_trace(go.Scatter(
        x=x_vals, y=y_vals,
        mode='markers+text',
        marker=dict(size=sizes, color=color, opacity=0.82,
                    line=dict(width=1.5, color='white')),
        text=texts,
        textfont=dict(size=10, color='white'),
        textposition='middle center',
        hovertext=hovers, hoverinfo='text',
        name=taste,
    ))

fig.update_layout(
    title=dict(
        text='コーヒー豆 マトリクスバブルチャート（k=8）<br>'
             '<sup>バブルサイズ = 各国内での味クラスター割合　色 = 味クラスター</sup>',
        font=dict(size=17), x=0.5,
    ),
    xaxis=dict(
        title='国',
        categoryorder='array', categoryarray=country_order,
        tickfont=dict(size=11), tickangle=-35,
        showgrid=True, gridcolor='#ebebeb',
    ),
    yaxis=dict(
        title='味クラスター',
        categoryorder='array', categoryarray=taste_order,
        tickfont=dict(size=12),
        showgrid=True, gridcolor='#ebebeb',
    ),
    plot_bgcolor='white', paper_bgcolor='white',
    height=580, width=1150,
    legend=dict(title='味クラスター', font=dict(size=11), itemsizing='constant'),
    margin=dict(l=140, r=40, t=110, b=110),
)

fig.write_html('../outputs/html/bubble_matrix.html')
print('保存完了: bubble_matrix.html')
