# フレーバー配色の調整

通常は `flavorColors.json` だけを編集します。色は6桁のHEX形式で指定してください。

- `level1`：第1階層の基準色。
- `level2`：第2階層の基準色。キーは `Fruity > Berry` のような完全な階層パス。同名でも親ごとに設定できます。実データの13カテゴリと、参考ホイールの第2階層を定義しています。新しい第2階層が増えた場合はここに追加してください。未定義の場合は第1階層の色を使用します。
- `derived`：第3階層以降の派生色。色相は第2階層から引き継ぎます。`lightnessPerLevel` / `saturationPerLevel` は階層が1つ深くなるごとの明度・彩度の変化量。`siblingLightnessSpread` / `siblingSaturationSpread` はパスごとの変化幅。各値は0〜1の尺度で、明度・彩度は `min…` / `max…` で制限します。第3階層以降の個別色をJSONに追加する必要はありません。
- `interaction`：ホバー・キーボードフォーカス時と選択時の明度差・枠線幅。同時に有効な場合、明度はホバー、枠線幅は選択を優先します。
- `ui`：区画の境界線、強調枠線、文字、中心円、未定義カテゴリの代替色。ページ全体の背景やカードは従来どおり `src/flavor-explorer.css` で調整します。

計算ルールを変更する場合のみ `src/lib/flavorColorUtils.js` を編集します。派生色は階層パスのハッシュから決まり、CSVの行順、タグ順、兄弟の表示順や追加によって既存ノードの色は変わりません。兄弟の数や並び順を色計算に使用していません。

`getFlavorColor(path)` は通常色、`getFlavorAppearance(path, state)` はホバー・選択・ラベルを含めた描画色を返します。`SunburstFlavorChart.jsx` は描画と操作だけを担当します。凡例や豆のネットワークでも `data.color` 経由で同じ基準色・派生色を使用します。

確認：`node --test src/lib/flavorColorUtils.test.js src/lib/flavorData.test.js`、`npm run build`。
