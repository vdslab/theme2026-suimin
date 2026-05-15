import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

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

country_order = ['メキシコ', 'グアテマラ', 'コロンビア', 'ブラジル', '台湾', 'ハワイ', 'ホンジュラス', 'コスタリカ']
method_order = ['その他', 'ハニー', 'セミウォッシュド', 'ナチュラル', 'ウォッシュド']

cluster_colors = {
    '酸味系':        '#5B8FD4',
    'バランス系':    '#F5C842',
    'コク・バランス系': '#9B6BCC',
    '香り系':        '#5BBD72',
}
all_clusters = list(cluster_colors.keys())

n_rows = len(method_order)
n_cols = len(country_order)

specs = [[{'type': 'domain'} for _ in range(n_cols)] for _ in range(n_rows)]
subplot_titles = []
for method in method_order:
    for country in country_order:
        sub = df[(df['Country_JP'] == country) & (df['Method_JP'] == method)]
        subplot_titles.append(f'n={len(sub)}' if len(sub) > 0 else '')

fig = make_subplots(
    rows=n_rows, cols=n_cols,
    specs=specs,
    subplot_titles=subplot_titles,
    vertical_spacing=0.06,
    horizontal_spacing=0.02,
)

# subplot_titlesのフォントを小さく
for ann in fig.layout.annotations:
    ann.font.size = 9
    ann.font.color = '#888888'

shown_legends = set()

for row_i, method in enumerate(method_order):
    for col_i, country in enumerate(country_order):
        sub = df[(df['Country_JP'] == country) & (df['Method_JP'] == method)]
        total = len(sub)

        if total == 0:
            fig.add_trace(
                go.Pie(
                    values=[1],
                    marker_colors=['#F0F0F0'],
                    showlegend=False,
                    hoverinfo='none',
                    textinfo='none',
                ),
                row=row_i + 1, col=col_i + 1,
            )
        else:
            counts = sub['ClusterName'].value_counts()
            sizes = [counts.get(c, 0) for c in all_clusters]
            colors = [cluster_colors[c] for c in all_clusters]

            show_legend_flags = []
            for c in all_clusters:
                if c not in shown_legends:
                    shown_legends.add(c)
                    show_legend_flags.append(True)
                else:
                    show_legend_flags.append(False)

            fig.add_trace(
                go.Pie(
                    labels=all_clusters,
                    values=sizes,
                    marker_colors=colors,
                    showlegend=True,
                    legendgroup=all_clusters[0],
                    name='',
                    hovertemplate=(
                        f'<b>{country} × {method}</b><br>'
                        '%{label}: %{percent}<br>'
                        f'合計: {total}件'
                        '<extra></extra>'
                    ),
                    textinfo='none',
                    hole=0,
                ),
                row=row_i + 1, col=col_i + 1,
            )

# 凡例を個別トレースで管理（重複しないように）
fig.data = list(fig.data)
legend_added = set()
for trace in fig.data:
    if hasattr(trace, 'labels') and trace.labels is not None:
        key = tuple(trace.labels)
        if key in legend_added:
            trace.showlegend = False
        else:
            legend_added.add(key)
            trace.showlegend = True
            trace.name = '味クラスター'

# 手動で凡例トレースを追加（ダミー）
for cluster, color in cluster_colors.items():
    fig.add_trace(go.Scatter(
        x=[None], y=[None],
        mode='markers',
        marker=dict(size=12, color=color, symbol='circle'),
        name=cluster,
        showlegend=True,
        legendgroup=cluster,
    ))

# 全パイチャートのshowlegendをFalseに（ダミー凡例だけ表示）
for trace in fig.data:
    if isinstance(trace, go.Pie):
        trace.showlegend = False

# Y軸（精製方法）ラベルを左端に annotations で追加
row_label_x = -0.01
for row_i, method in enumerate(method_order):
    y_pos = 1 - (row_i + 0.5) / n_rows
    fig.add_annotation(
        x=row_label_x, y=y_pos,
        xref='paper', yref='paper',
        text=f'<b>{method}</b>',
        showarrow=False,
        font=dict(size=12, color='#333333'),
        xanchor='right',
        yanchor='middle',
    )

# X軸（産地）ラベルを上部に annotations で追加
for col_i, country in enumerate(country_order):
    x_pos = (col_i + 0.5) / n_cols
    fig.add_annotation(
        x=x_pos, y=1.02,
        xref='paper', yref='paper',
        text=f'<b>{country}</b>',
        showarrow=False,
        font=dict(size=11, color='#333333'),
        xanchor='center',
        yanchor='bottom',
    )

fig.update_layout(
    title=dict(
        text='コーヒー豆 マトリクスバブルチャート<br>'
             '<sup>バブルサイズ = 産地×精製方法の中での味クラスター割合　色 = 味クラスター</sup>',
        font=dict(size=17, family='Hiragino Sans'),
        x=0.5, y=0.98,
    ),
    height=700,
    width=1200,
    plot_bgcolor='white',
    paper_bgcolor='white',
    legend=dict(
        title=dict(text='味クラスター', font=dict(size=12)),
        font=dict(size=11),
        x=1.01, y=0.5,
        xanchor='left',
        yanchor='middle',
        bgcolor='rgba(255,255,255,0.9)',
        bordercolor='#CCCCCC',
        borderwidth=1,
    ),
    margin=dict(l=120, r=140, t=100, b=40),
    font=dict(family='Hiragino Sans'),
)

fig.write_html('grid_pie_matrix.html')
print('保存完了: grid_pie_matrix.html')
