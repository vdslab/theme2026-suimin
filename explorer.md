# フレーバー探索画面 現行仕様（ネットワーク以外）

調査日：2026-11-14。現行コードから確認した実装仕様。対象は `#sunburst` で開くフレーバー探索画面と、そのデータ供給・一覧・日本語化。遷移元の世界地図アプリ自体の詳細は対象外。ネットワーク図の生成・配置・操作は [flavor_graph_explorer.md](flavor_graph_explorer.md) に記載する。過去メモより現行コードを優先する。

## 1. 起動と画面構成

[src/App.jsx](src/App.jsx) が `window.location.hash === "#sunburst"` の場合に [FlavorExplorerPage](src/FlavorExplorerPage.jsx) を表示する。`hashchange` に追従する。地図側の導線から移動でき、探索画面の「地図に戻る ↗」は `#` に移動する。

```sh
npm install
npm run dev
# http://localhost:5173/#sunburst
```

`npm run build` でビルド、`npm run preview` でプレビュー。React、Vite、D3、Tailwind CSSを使う。

画面はヘッダー、概要、サンバースト、ネットワーク、豆一覧、出典フッターで構成する。概要にはタグ付き豆数、ルートを除く階層ノード数、統合後の商品数、CSV行数を表示する。「2026年10月」の年月と分類参考「SCAフレーバーホイール」は固定表示で、データから推定しない。

### パネル切り替え

- 幅1024px以上：画面全体を100dvhに収める。サンバースト約44.44%、ネットワーク約55.56%、豆一覧約44.44%の3パネルを18px間隔で横に並べ、通常は先頭2枚を見せる。
- 「リストを表示 ≫」でトラックを横移動し、ネットワークと豆一覧を表示する。移動アニメーションは0.45秒。
- 幅1023px以下：縦並び。通常はサンバーストとネットワークを表示し、一覧を開いたときはサンバーストを隠して一覧を表示する。
- 戻るボタン、一覧の閉じるボタン、一覧表示中のEscapeで一覧を閉じる。
- 豆一覧は内部スクロールを使う。パネル寸法の詳細は [src/flavor-explorer.css](src/flavor-explorer.css) を参照。

## 2. データ供給

[vite.config.js](vite.config.js) の独自middlewareが開発サーバーとpreviewに `/api/flavor-data.csv` を追加する。元CSVは次のローカルファイル。

```text
data/private/roasterdb/2026.10/roasterdb_export.csv
```

- CSV先頭のBOMを除いて `csvParse` する。
- CSVに `tasting_notes_raw` 列自体がなければ、同ディレクトリの `roasterdb_export.json` を配列として読み、`source_roaster` と `product_id` の組で原文説明を補完する。
- JSON側で商品IDがあり、説明が空白だけではない行を使用する。同じキーが複数あれば後の値を採用する。
- 列が既にある場合は、空欄の説明であってもJSONで補完しない。
- 補完JSONが存在しない場合は補完せず続行する。それ以外の読み込み・解析エラーは外側のエラー処理に渡る。
- 応答は再CSV化し、`Content-Type: text/csv; charset=utf-8`、`Cache-Control: no-store` を付ける。エラー時は404と `Local RoasterDB CSV is missing.` を返す。
- 元CSVはpublicやビルド成果物へコピーしない。静的ホスティングだけでは当該エンドポイントを供給できない。

画面は `${import.meta.env.BASE_URL}api/flavor-data.csv` をfetchし、非成功ステータスならエラーとする。取得中は構築中メッセージを表示する。アンマウント時はAbortControllerで取得を中止する。

有効な末端タグがない場合もエラーとし、配置先と `npm run dev` / `npm run preview` の案内を表示する。自動リトライUIはない。

## 3. 共通データモデルと選択

[src/lib/flavorData.js](src/lib/flavorData.js) が商品を焙煎所・商品IDで統合する。タグは `;`、階層は `>` で区切る。元の英語パス・IDを維持し、同一商品の同一パスを重複排除する。詳細な統合条件はネットワーク仕様書の第2節を参照。

各階層ノードは `id`、`name`、`path`、`children`、子孫を含むユニーク豆の `beanIds` を持つ。ルート以外は、そのパスが元タグの終端である豆集合 `directIds` も持つ。ルート名は「すべての味」。

初期選択は元データ階層の末端ノードのうち豆数が最多の味。同数の場合は安定ソートにより構築時の順序を維持する。

選択味は最大3つで、親子関係のある選択は後から選んだ味に置き換える。選択チップの×、再クリック、全選択解除がある。3味選択時だけ「3つすべて一致のみ」を表示する。

通常の味選択では、選択豆、展開カード、グラフ起点選択、ホバーをクリアし、3味全一致条件を解除する。全選択解除の処理は選択味・選択豆・全一致条件・通知をクリアするが、展開カードIDなど全状態を明示的にリセットする実装ではない。検索・並び順・一覧の開閉状態は味の選択を変えても保持する。

## 4. サンバースト図

実装：[SunburstFlavorChart.jsx](src/components/SunburstFlavorChart.jsx)、[sunburstLayout.js](src/lib/sunburstLayout.js)、[sunburstLabels.js](src/lib/sunburstLabels.js)。

### 階層と面積

CSVから構築した階層を `d3.hierarchy` に渡し、`partition().size([2π, radius])` で分割する。**表示階層の末端1個を重み1として集計するため、角度・面積は豆の件数やタグ付与回数を表さない。** 区画や読み上げに表示する件数は `beanIds.size` のユニーク豆数。

深さ2のノードに子が1つだけあり、その子が親と同名の末端なら、表示上は子を省略して深さ2を末端にする。元データのノード、ID、豆数は変更しない。省略された子のIDから対応する表示ノードを引く処理もある。ただし区画の選択強調は表示ノード自身のIDが選択配列にあるかで判定する。

兄弟は原則として表示上の重みの降順。以下は固定順を優先する。

| 親パス | 優先順 |
| --- | --- |
| `Fruity` | Citrus Fruit → Berry → Dried Fruit → Other Fruit |
| `Spices > Spices` | Black Tea → Earl Grey → Cinnamon → Nutmeg → Clove → Cardamom |

### 寸法と区画

ResizeObserverで描画領域を測定する。半径は `max(0, min(width, height) / 2 - 12)`、中心はSVG中央。半径が0の間は図を描かない。`d3.arc` のpadAngleは0.008、padRadiusは半径の半分、内半径は `y0 + 1`、外半径は `y1 - 1`。ルート区画は描かず、中心円に「味の全体像」と対象豆数を表示する。

ズーム・パン操作はこのコンポーネントには実装されていない。

### ラベルと操作

- ラベルは区画の角度・半径の中点に置き、放射方向／接線方向と文字サイズを調整する。位置をずらして収める処理はない。
- 12、11、10pxを試し、末端ラベルはさらに24回の二分探索で縮小する。収まらない中間分類のラベルは非表示になり得る。
- Blackberry、Dark Chocolate等の一部名称は固定の2行改行辞書を使う。画面幅によって改行位置は変更しない。
- 区画ごとのclipPathで文字のはみ出しを防ぐ。
- クリック／Enter／Spaceで共通の味選択を実行する。ホバーとフォーカスで表示色を変える。
- `role=button`、`tabIndex=0`、`aria-pressed`、日本語パスと件数の `aria-label`、SVGのtitleを設定する。
- 上部パンくずは最後に選択した味の階層を表示する。祖先名のボタンでも味を選択できる。

## 5. 色

[flavorColors.json](src/data/flavorColors.json) と [flavorColorUtils.js](src/lib/flavorColorUtils.js) が共通色を管理する。

| 大分類 | 基準色 |
| --- | --- |
| Fruity | `#E3454F` |
| Sour/Fermented | `#B4A20B` |
| Green/Vegetative | `#278344` |
| Other | `#168FA8` |
| Roasted | `#57372E` |
| Spices | `#8240A6` |
| Nutty/Cocoa | `#A76A32` |
| Sweet | `#EEA020` |
| Floral | `#E14A98` |

子階層は親色をHSL化し、階層ごとに明度+0.065、彩度−0.035とする。明度は0.2〜0.76、彩度は0.25〜0.95に制限する。同じ親・深さの兄弟は同色。未定義の大分類は `#98552F`。

サンバーストではホバー時に明度+0.06、選択時に−0.035。両方なら塗りはホバーを優先する。枠幅は通常1、ホバー2、選択3で、選択が優先される。文字は明暗のコントラストを比較して選び、Roasted系列は常に白。ネットワークは独自の文字・枠設定を持つ。

## 6. 豆一覧と検索

実装：[FlavorBeanList.jsx](src/components/FlavorBeanList.jsx)。一覧にはネットワークに表示する豆と同じ最大40件を渡す。検索対象を全該当豆へ拡張する処理やページ送りはない。

検索語をtrim・小文字化し、日本語国名、元の国名、地域、商品名、焙煎所、日本語化した精製方法・焙煎度・味パスへの部分一致で絞る。件数は「絞り込み後 / 表示対象件数」。0件の場合はメッセージと検索解除ボタンを表示する。

並び順は次の4種類。

1. 味との一致数降順 → 信頼度降順 → 豆ID順（初期値）。
2. 信頼度降順 → 豆ID順。
3. 信頼度昇順 → 豆ID順。
4. 豆名の `localeCompare` 順。ロケールは明示指定していない。

グラフの豆を選ぶと検索を解除し、220ms待って一覧内のカード上端へスクロールする。通常はsmooth、`prefers-reduced-motion: reduce` ではinstant。一覧の検索・並べ替えによってグラフの集合は変わらない。

## 7. 豆カード

実装：[FlavorBeanCard.jsx](src/components/FlavorBeanCard.jsx)。商品名ボタン／カード余白の操作で選択し、詳細を展開・折り畳みする。展開対象IDは1つだけ管理する。ポインタホバーはグラフと同期する。

| 領域 | 内容 |
| --- | --- |
| 通常表示 | 商品名、一致数/選択味数、産地、精製、価格、味タグ |
| 詳細 | 焙煎所、地域、品種、焙煎度、内容量、標高、販売元説明、抽出信頼度、商品ページ |

- 味タグは選択パスに前方一致するものを優先して全て表示し、それ以外は最初の3件まで表示する。残りは件数を表示し、展開時に全タグを見せる。タグボタンから味を選択できる。
- カード価格は通貨を大文字化したコード＋小数2桁。グラフの読み上げ用価格は `formatPrice` を使うため、表示形式が異なる。
- 内容量は数値ならg表示。標高は上下限が同値なら単一値、両方あれば範囲、片方だけなら「以上／以下」とする。
- 品種が配列なら空値を除いて「、」で結合する。CSV由来の文字列はそのまま表示する。
- 欠損や `unknown`、`unspecified`、`null`、`none`、`n/a`、`不明` 等の値は「データなし」とする。
- 信頼度は `tasting_notes_confidence` が数値として存在する場合に表示し、統合後の `confidence` を優先して100倍・四捨五入した%とする。品質評価ではなく、味タグ抽出の指標である旨をツールチップで説明する。
- 商品リンクはHTTP(S)の `product_url` を優先し、なければ `source_url`。別タブで開き `noopener noreferrer` を付ける。
- 折り畳み領域は `inert` / `aria-hidden`、開閉ボタンは `aria-expanded` / `aria-controls` を持つ。

## 8. 固定辞書による日本語化

[flavorJapanese.js](src/lib/flavorJapanese.js) は味名、精製方法、焙煎度を表示時に変換する。元の識別子やパスは変更しない。味の未登録名は原文のまま、味パスは「 ＞ 」で結合する。商品名、焙煎所名、地域、品種を翻訳する処理はない。

| 区分 | 例・フォールバック |
| --- | --- |
| 味名 | Fruity→果実の風味、Strawberry→いちご。未登録は原文 |
| 精製 | Anaerobic→嫌気性発酵、Honey→ハニー、Natural→ナチュラル、Other→その他、Washed→ウォッシュド。空は不明 |
| 焙煎 | Light→浅煎り、Light-Medium→浅煎り〜中煎り、Medium→中煎り、Medium-Dark→中煎り〜深煎り、Dark→深煎り、Unknown→不明。空は不明 |
| 国名 | [countryNames.js](src/lib/countryNames.js) の完全一致辞書。未登録は原文、空は空文字 |

共通の `formatPrice` はUSD/JPY/EUR/GBPと各記号に対応し、JPYは整数、それ以外は小数2桁。欠損・非数値は「価格不明」。`formatConfidence` は%と小数2桁を併記し、欠損・非数値は「不明」。いずれも値域を0〜1に制限する処理はない。

## 9. 販売元説明のブラウザ翻訳

実装：[descriptionTranslation.js](src/lib/descriptionTranslation.js)、[SellerDescription.jsx](src/components/SellerDescription.jsx)。対象は `tasting_notes_raw`。アプリ用翻訳サーバーやAPIキーは使用せず、ブラウザが提供する `Translator` / `LanguageDetector` を使う。

### 翻訳開始と表示

- カードを開くクリック／キーボード操作内で可能なら翻訳を先行開始し、詳細コンポーネントの展開時にも同じ関数を呼ぶ。
- 翻訳中は原文を表示する。成功後は日本語訳を表示し、訳が原文と異なる場合は「原文を表示／日本語訳を表示」を用意する。
- 説明が空なら「データなし」。長文はCSSで省略し、実測であふれていれば「続きを読む」、展開後は「閉じる」を出す。
- カードを閉じると原文切り替え・続きを読む状態を解除する。
- 非同期応答は閉じたカード等に適用しないようactiveフラグやリクエスト番号で判定する。翻訳処理自体をキャンセルする実装ではない。

### 言語判定とキャッシュ

1. 空白だけの入力は空文字を返す。
2. 同じ原文の処理中／成功Promiseがあれば再利用する。
3. `Translator` がなければ `TRANSLATION_UNSUPPORTED` で失敗する。この判定は日本語原文の判定より先に行う。
4. `LanguageDetector` があれば検出結果の先頭言語を使用する。未検出・`und` はエラー。
5. 検出APIがなければ、ひらがな・カタカナを含む原文はja、それ以外はenとする。漢字のみの日本語を判定する仕組みはない。
6. jaなら原文をそのまま返す。それ以外は `Translator.create({ sourceLanguage, targetLanguage: "ja" })` を言語ごとに共有し、`translate(text)` を呼ぶ。空の訳文はエラー。

翻訳結果と検出言語はメモリ内で各最大200原文。追加順に古いものを削除し、永続保存しない。失敗した翻訳Promiseは削除して再試行可能にする。翻訳器の作成失敗時は当該言語のPromise、検出器の作成失敗時は検出器Promiseを破棄する。作成済み翻訳器の言語数上限や明示的destroyは実装されていない。

### 状態とエラー

| 状態 | 表示 |
| --- | --- |
| loading | 日本語に翻訳中。初回の言語データ取得に時間がかかる旨 |
| ready | 訳文または日本語原文。状態メッセージは空 |
| unsupported | 内蔵翻訳非対応の案内と原文。対応するデスクトップ版Chromeを案内 |
| retry | 開始失敗の案内、原文、「日本語に翻訳」再試行ボタン |

再試行はボタン操作の中で開始し、ブラウザのユーザー操作要件に対応する。ブラウザの対応状況を保証する仕様ではなく、APIの存在確認と失敗時のフォールバックを実装している。

## 10. 関連テストと確認範囲

データ処理、サンバースト配置、色、翻訳のテストは `src/lib/` の `*.test.js` にある。実装変更時の確認には次を使える。

```sh
node --test src/lib/*.test.js
npm run build
```

本仕様書はコードの静的調査に基づく。実CSVの内容・ブラウザ内蔵翻訳の利用可否・画面操作の実機検証を実施済みとするものではない。
