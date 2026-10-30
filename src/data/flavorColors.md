# フレーバー配色の調整

通常は `flavorColors.json` だけを編集します。色は6桁のHEX形式で指定してください。

- `level1`：第1階層の基準色。
- `derived`：第2階層以降の派生色。直接の親から色相を継承し、明度・彩度だけを一定量変えます。同じ親の子ノードはすべて同じ通常色です。`lightnessPerLevel` / `saturationPerLevel` は階層が1つ深くなるごとの変化量。各値は0〜1の尺度で、明度・彩度は `min…` / `max…` で制限します。個別カテゴリの追加設定は不要です。
- `interaction`：ホバー・キーボードフォーカス時と選択時の明度差・枠線幅。同時に有効な場合、明度はホバー、枠線幅は選択を優先します。
- `ui`：区画の境界線、強調枠線、文字、中心円、未定義カテゴリの代替色。ページ全体の背景やカードは従来どおり `src/flavor-explorer.css` で調整します。

計算ルールを変更する場合のみ `src/lib/flavorColorUtils.js` を編集します。派生色は親の色と階層から決まり、タグ名ごとの明度・彩度差は設けません。CSVの行順、タグ順、兄弟の表示順や追加によって既存ノードの色は変わりません。ホバー・選択中は従来どおり強調色になります。

`getFlavorColor(path)` は通常色、`getFlavorAppearance(path, state)` はホバー・選択・ラベルを含めた描画色を返します。ラベルは背景とのコントラスト比が高い方の暗色・白色を使います。`SunburstFlavorChart.jsx` は描画と操作を担当します。豆のネットワークでも `data.color` 経由で同じ基準色・派生色を使用します。

確認：`node --test src/lib/flavorColorUtils.test.js src/lib/flavorData.test.js`、`npm run build`。
