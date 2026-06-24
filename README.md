# theme2026-suimin

Vite + React + Tailwind CSS (daisyUI) で構築したプロジェクトです。

## セットアップ

```bash
npm install      # 依存パッケージのインストール
npm run dev      # 開発サーバーの起動
npm run build    # 本番ビルド
npm run preview  # ビルド結果のプレビュー
```

## Lint / フォーマット

リント・フォーマットには [Biome](https://biomejs.dev/) を使用しています（設定は [`biome.json`](biome.json)）。

```bash
npm run lint     # リントチェックのみ（修正なし）
npm run format   # フォーマットを適用
npm run check    # リント + フォーマット + import 整理をまとめて適用
```

- コミット・PR 前に `npm run check` を実行してください。
- `npm run lint` でエラーが出る場合は修正してから PR を出してください。

---

## 開発ルール

このプロジェクトは **Issue 起点** で開発を進めます。
「Issue を立てる → ブランチを切る → PR を出す → レビューしてもらってマージ」の流れを必ず守ってください。

### 1. Issue を立てる

- 作業を始める前に、まず Issue を作成します。
- 1 つの作業内容につき 1 つの Issue を立てます。
- 以降の作業（ブランチ・PR）は、この **Issue 番号**に紐づけて進めます。

### 2. main からブランチを切る

- 必ず最新の `main` からブランチを切ります。

  ```bash
  git switch main
  git pull origin main
  git checkout -b feature/<issue番号>
  ```

- ブランチ名は **`feature/<issue番号>`** の形式にします。

  | 例 | 説明 |
  | --- | --- |
  | `feature/12` | Issue #12 に対応するブランチ |
  | `feature/34` | Issue #34 に対応するブランチ |

### 3. コミット

- こまめに、意味のある単位でコミットします。
- コミットメッセージは何をしたかが分かるように書きます。

### 4. Pull Request を出す

- 作業が終わったら `main` へ向けて PR を作成します。
- **PR のタイトルは対応する Issue のタイトルと揃え、Issue 番号も含めます。**

  例: `ログイン画面を作成する (#12)`

- PR の説明には、対応する Issue へのリンクを記載します。
  本文に `Closes #12` と書くと、マージ時に Issue が自動でクローズされます。
- 何を変更したか・確認方法を簡潔に書きます。
- PR 作成時には [`.github/pull_request_template.md`](.github/pull_request_template.md) のテンプレートが自動で入ります。空欄を埋めてください。

### 5. レビューとマージ

- **自分ではマージせず、必ず他の人にレビュー・マージしてもらいます。**
- レビューで指摘があれば修正し、再度確認してもらいます。
- マージ後はブランチを削除して、ローカルの `main` を最新化します。

  ```bash
  git switch main
  git pull origin main
  ```

---

## 開発フローまとめ

```
Issue を立てる (#番号)
        │
        ▼
main から feature/<issue番号> ブランチを切る
        │
        ▼
作業 → コミット → push
        │
        ▼
PR を作成（タイトル = Issueタイトル + #番号 / Closes #番号）
        │
        ▼
他の人にレビュー・マージしてもらう
        │
        ▼
main を最新化（ブランチ削除）
```
