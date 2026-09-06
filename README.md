Japanese follows English
# 楽楽新卒Chat
新卒採用担当者がターゲット
候補者一人ひとりに丁寧に向き合うためのワークフロー最適化アプリ

### ペルソナ（顧客プロフィール）

新卒採用担当者の属性と業務実態

**基本情報・体制**
- 役割：新卒の採用担当。連絡・面接調整・フォローが主務
- 所属・体制：新卒採用課（課長1名／メンバー5名）
- 担当候補者数：1担当者あたり常時20名を並行対応

**やり取り頻度・手段**
- 対応頻度：1日に何度も、こまめに繰り返し対応
- 連絡手段：チャット中心（メール、電話は補助）
- 対応件数目安：1日あたり20件ほどのやり取りが発生

**繁忙期の状況**（インターン期：5〜7月／本選考期：10〜1月）
選考段階に合わせた各種案内やイベント登壇、面接・面談の日程調整で忙殺。自身も面談を担当するため連絡対応に割ける時間は極めて限定的。

**1日の流れ（例）**
- 朝一：前夜からの学生問い合わせ対応、面接官への共有・引継ぎ
- 日中：学生との面談（1日3件程）、社内MTG、採用イベント企画
- 夕方以降：日中に届いた学生からの問い合わせ対応、面接官への共有

**大切にしていること**
候補者に「丁寧に対応してもらえた」と感じてほしい。一方で、件数が多く一人ひとりに手が回らないジレンマがある。

## 私が担当した実装

- 面接・面談調整画面の実装
- 学生カルテの実装

## 私が工夫したこと

### プランニング：曖昧な議論を前に進める
3日間（うち1日はほぼ資料作成）という限られた時間の中、「あの機能もいいのでは」「この機能はどう？」という意見が次々出て議論が停滞することがあった。そこで、出てきたアイデアに対して以下を都度問い直すようにした。

- その機能は本当に必要か
- その機能によって何が解決できるのか、目的は何か
- （例）「丁寧に対応したい」の「丁寧」とは具体的に何を指すのか

ヒアリングで聞ききれなかった点は仮定を置いて先に進め、中間レビューでその仮定が合っていたかを検証する、という進め方に方針を修正した。軸が曖昧なまま止まっていた議論を、仮説を明示することで前進させることを意識した。

### チーム内での役割：得意分野をサポートする立ち回り
チーム4人はそれぞれ「技術力とチーム開発経験がある人」「議論を活発にする人」「真の課題を言語化する人」といった得意分野を持っていた。自分自身に突出した強みがあるわけではなかったからこそ、各メンバーの動きをサポートする形で参画することを意識した。

- ヒアリングでは書記・タイムキーパーを自ら率先して担当
- 手が空いたタイミングでメンバーに「何をすればよいか」を確認し、資料作成なども対応

### 実装：フロントエンド開発でのAI活用
実装はフロントエンドを中心に担当。AIにコーディングを依頼する際は、「現状どういう状態で、理想はどうなってほしいか」を明確に指示することを意識した。

特に修正依頼の際は、
- 現状どういう表示・仕様になっているか
- どう変えたいか
- 修正後、どういう表示・仕様になっていればベストか

をあらかじめ言語化することで、「思っていたのと違う直され方をした」という手戻りを防ぐようにした。

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

# Rakuraku Fresh Recruit Chat
**Target Audience:** New graduate recruiters  
**Overview:** A workflow optimization app designed to help recruiters give personalized attention to every candidate.

---

### Persona (Customer Profile)
Attributes and Operational Realities of New Graduate Recruiters

**Basic Information & Team Structure**
- **Role:** New graduate recruiter. Primary duties include communication, interview coordination, and candidate follow-ups.
- **Department & Structure:** New Graduate Recruitment Section (1 Section Manager / 5 Team Members).
- **Candidate Volume:** Each recruiter concurrently manages roughly 20 candidates at any given time.

**Communication Frequency & Channels**
- **Frequency:** Frequent, ongoing interactions throughout the day.
- **Primary Channel:** Centered on direct messaging/chat (emails and phone calls serve as secondary support).
- **Daily Volume:** Handles approximately 20 interactions per day.

**Peak Season Workload** *(Internship Season: May–July / Main Selection Season: October–January)*  
Extremely busy sending out announcements, presenting at recruiting events, and coordinating schedules for interviews and casual chats across various selection stages. Because recruiters also conduct candidate interviews themselves, their time available for candidate communication is severely limited.

**Sample Daily Schedule**
- **First Thing in the Morning:** Respond to student inquiries sent overnight; brief and hand off updates to interviewers.
- **During the Day:** Conduct candidate interviews (approx. 3 sessions/day), attend internal meetings, and plan recruitment events.
- **Late Afternoon & Evening:** Address student inquiries received during the day; share updates with interviewers.

**Core Values & Priorities**  
Recruiters want candidates to feel they are receiving thoughtful, attentive care. However, due to high volume, they face the constant dilemma of not having enough bandwidth for personalized engagement.

---

## My Contributions to Implementation

- Implementation of the Interview & Meeting Scheduling Screen
- Implementation of the Candidate Profile (Medical-chart-style record) Screen

## Technical & Process Innovations

### Planning: Driving Ambiguous Discussions Forward
During a tight 3-day window (including nearly 1 full day dedicated to document creation), discussions frequently stalled as team members churned out endless ideas like "Wouldn't this feature be nice?" or "What about that one?" To regain momentum, I consistently challenged each proposed idea with the following questions:

- Is this feature truly necessary?
- What problem does this solve, and what is its ultimate goal?
- *(Example)* When we say we want to provide "thoughtful candidate care," what specific actions does that entail?

For items that could not be fully clarified through initial hearings, I modified our strategy: we made explicit assumptions to keep moving forward and validated them during intermediate reviews. By articulating clear hypotheses, I helped propel discussions that had previously ground to a halt back on track.

### Team Role: Supporting Members in Their Areas of Expertise
Our four-person team consisted of individuals with clear strengths—one excelled in technical skills and collaborative development, another energized group discussions, and another articulated root challenges. Recognizing that I did not possess a single standout specialty, I intentionally focused on playing a supportive role to empower the others.

- Voluntarily took the initiative to serve as the note-taker and timekeeper during hearing sessions.
- Proactively checked in with teammates whenever I had downtime to ask, "How can I help?" and took on tasks like documentation.

### Implementation: Leveraging AI for Frontend Development
I primarily handled frontend development. When prompting AI to generate code, I made a conscious effort to clearly communicate both the current state and the desired outcome.

Specifically, when requesting code revisions, I articulated:
- The current UI display and behavioral specification
- The exact changes required
- The ideal post-correction state and functional requirements

By defining these parameters upfront, I eliminated rework caused by mismatched expectations.

---

# System & Repository Documentation

Source code for the chat and interview scheduling application connecting recruiters with candidates.

- **Frontend:** Vue 3 + Vue Router + Vuetify 3 (Built with [Vite](https://vitejs.dev/))
- **Real-time Communication:** Socket.IO v4 (Runs directly on Vite dev server's `configureServer`, requiring no separate process)
- **Data Persistence:** In-memory. Restarting the server resets all posts and reservations to initial mock data.

For detailed server-side specifications, refer to [`docs/backend-spec.md`](docs/backend-spec.md).

## Prerequisites

- VS Code (Latest version)
- Git
- Node.js 22 LTS (Requires `>=22 <23` in `package.json` `engines`)
- Web Browser

Recommended VS Code Extensions ([`.vscode/extensions.json`](.vscode/extensions.json)):  
Vue (Volar) / ESLint / Prettier / GitHub Pull Requests.

*Note: Docker Desktop / Dev Containers are not used.*

## Repository Location

Avoid placing the project in synchronized folders, as file watching may become unstable.

- **Windows:** Recommended to place directly under the Ubuntu home directory in WSL2 (`~/<repo-name>`). Do NOT place under `/mnt/c` or OneDrive.
  - *Note:* While execution via native Windows (PowerShell) is possible, the reference environment for instructors is WSL2.
- **Mac:** Place directly under the home directory (`~/<repo-name>`). Do NOT place under iCloud Drive.

## Getting Started

1. **Open the repository in VS Code**
   - On Windows: Open the Ubuntu folder via Remote - WSL (or directly if using native Windows).
   - On Mac: Open the folder as usual.

2. *(Optional)* **Verify initial setup**
   ```bash
   bash ./check-env.sh
