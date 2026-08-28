# 楽楽新卒Chat

採用担当者と学生をつなぐ、チャット・面談予約アプリのソースコード。

- フロントエンド: Vue 3 + Vue Router + Vuetify 3（[Vite](https://vitejs.dev/) でビルド）
- リアルタイム通信: Socket.IO v4（Vite dev server の `configureServer` 上でサーバを起動するため、別プロセスは不要）
- データ保持: オンメモリ。サーバを再起動すると投稿・予約は失われ、モックデータから作り直される

サーバサイドの詳細仕様は [`docs/backend-spec.md`](docs/backend-spec.md) を参照。

## 事前準備

- VS Code（最新版）
- Git
- Node.js 22 LTS（`package.json` の `engines` で `>=22 <23` を要求）
- ブラウザ

VS Code の推奨拡張（[`.vscode/extensions.json`](.vscode/extensions.json)）:
Vue (Volar) / ESLint / Prettier / GitHub Pull Requests。

Docker Desktop / Dev Container は使いません。

## 配置場所

同期フォルダ配下に置くとファイル監視が不安定になるため避けてください。

- Windows: WSL2 上の Ubuntu のホーム直下（`~/<リポジトリ名>`）を推奨。`/mnt/c` や OneDrive 配下には置かない。
  - Windows ネイティブ（PowerShell）でも起動はできますが、講師のリファレンス環境は WSL2 です。
- Mac: ホーム直下（`~/<リポジトリ名>`）に配置する。iCloud Drive 配下には置かない。

## 起動手順

1. VS Code でリポジトリを開く
   - Windows は Remote - WSL で Ubuntu 側のフォルダを開く（ネイティブの場合はそのまま開く）
   - Mac は通常どおりフォルダを開く

2. （任意）初回セットアップの確認を行う

   ```bash
   bash ./check-env.sh
   ```

   Node.js のバージョンやポート 3000 の空きを確認するスクリプトです。`bash` が必要なため、Windows ネイティブでは Git Bash か WSL で実行してください（このチェックはスキップしても起動には影響しません）。

3. 依存パッケージをインストールする

   ```bash
   npm install
   ```

4. アプリを起動する

   ```bash
   npm start
   ```

5. ブラウザで `http://localhost:3000/` を開く

lockfile 通りに再現できることを確認する場合は `npm ci` を使います。

## ログイン情報

モックデータ（[`server/mock.js`](server/mock.js)）で投入されるアカウント。ユーザー名は `username` 欄に入力する `name` の値です。

| 役割 | username | パスワード | 表示名 |
|---|---|---|---|
| 採用担当（1人） | `recruiter01` | `recruiter123` | 佐藤 健一 |
| 学生（7人） | `student01`〜`student07` | `student123` | 田中 太郎 ほか |

## 機能

### ログイン画面

- ユーザー名が未入力で「ログインする」が押されたらエラーメッセージを表示する
- ユーザー名・パスワードをサーバで照合し、初期表示データ（自分・ユーザー一覧・ルーム・メッセージ・予約）を一括で受け取る
- 認証に失敗した場合はエラーメッセージを表示する

### チャット画面

- ログインしたユーザーの役割（学生 / 採用担当）で表示が切り替わる
- 学生 ↔ 採用担当の 1 対 1 チャット。メッセージはそのルームの参加者にだけリアルタイムで表示される
- 採用担当は複数の学生へ同一本文を一斉送信できる
- 学生は面談・面接の日時を予約できる（仮予約）。同じ枠は他の学生の画面で即座に予約不可になる
- 採用担当は学生の仮予約を承認して本予約にできる

詳細な仕様・イベント定義・エラーコードは [`docs/backend-spec.md`](docs/backend-spec.md) を参照。

## 補足

- 投稿・予約はオンメモリ保持のため、`npm start` を再起動するとモックデータの初期状態に戻ります。
- サーバ側のコード（`server/` や `socket_event/`）を編集すると Vite ごと再起動し、同様にデータが初期化されます。
- `socket_event/index.js` に残る `enterEvent` / `exitEvent` / `publishEvent` は演習の元要件由来で、本アプリでは使用していません（[`docs/backend-spec.md`](docs/backend-spec.md) §8）。
