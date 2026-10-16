# data/private — 有料データ置き場

このディレクトリの中身は **このREADME以外すべて Git 管理外** です（`.gitignore` 参照）。
リポジトリは公開されているので、ここにあるファイルをコミット・共有しないでください。

## 配置

```
data/private/
└── roasterdb/
    └── 2026.10/                  ← RoasterDB Full Snapshot 2026.10（受領物をそのまま置く・編集しない）
        ├── roasterdb.sqlite      ← スクリプトが読む正本
        ├── roasterdb.sql
        ├── roasterdb_export.csv
        ├── roasterdb_export.json
        ├── COMMERCIAL_LICENSE.md
        └── README.txt
```

新しいスナップショットを入手したら `roasterdb/<バージョン>/` を並べて置き、スクリプト側のパス定数を切り替えます。

## 入手方法

RoasterDB（DataEngineered）の有料スナップショット。購入済みのファイルはチーム内で受け渡してください。
問い合わせ: roasterdb@dataengineered.io

## 扱いのルール（ライセンス要約。正確な条文は同梱の COMMERCIAL_LICENSE.md）

- OK: 分析、可視化、集計値、アプリ機能などの派生物の公開
- NG: 生データや軽く加工しただけのデータの大部分を再配布すること、ダウンロードしたファイルを組織外へ共有すること
- `src/data/` に出力するのは、アプリで使う最小限のフィールドだけにする
- 表示する豆の `source_url`（出典リンク）は消さない
- 味覚分類を表示するときは "SCA Flavor Wheel" とクレジットする
- 中間生成物は `data/interim/`（こちらも Git 管理外）に置く
