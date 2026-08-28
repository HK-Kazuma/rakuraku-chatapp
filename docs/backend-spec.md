# チャット・予約機能 バックエンド仕様書

採用担当者と学生をつなぐチャットアプリケーションのサーバサイド仕様。
本書に記載された内容を正とする。

- 通信方式: WebSocket（Socket.IO v4）
- データ保持: オンメモリ（プロセス再起動で初期化され、モックから再生成される）
- 実行環境: Node.js 22 / Vite dev server の `configureServer` 上で動作する

---

## 1. スコープ

### 対象

- ログイン認証
- 1対1チャット（学生 ↔ 採用担当）
- 一斉送信（採用担当から複数の学生へ）
- 面談・面接の予約（ダブルブッキング制御を含む）
- 予約の承認（学生の仮予約を採用担当が本予約にする）

### 対象外

| 項目 | 備考 |
|---|---|
| ユーザーの追加・削除・並び替え | モックデータ固定 |
| メッセージの編集・削除 | テキストのみ、投稿後の変更不可 |
| 予約のキャンセル・変更 | 予約は不可逆。復旧はサーバ再起動による |
| 予約の却下（不承認） | 承認のみを実装する。却下は枠を空きに戻す必要があり、`slot:updated` が `isBooked: true` 固定であることと整合しない |
| 未読管理 | サーバ側で既読状態を保持しない |
| 予約成立時の自動メッセージ送信 | コミュニケーションを重視するため意図的に実装しない |
| パスワードのハッシュ化 | 平文で保持する |
| オンライン状態・入力中表示 | 実装しない |

---

## 2. モデル定義

型は JSDoc の `@typedef` として [`server/types.js`](../server/types.js) に定義する。

### 2.1 列挙型

| 型 | 値 | 説明 |
|---|---|---|
| `Role` | `"student"` \| `"recruiter"` | ユーザーの役割 |
| `SelectionStatus` | `"document"` \| `"first"` | 選考ステータス。学生のみ |
| `ReservationKind` | `"interview"` \| `"meeting"` | 面接 / 面談 |
| `ReservationStatus` | `"tentative"` \| `"confirmed"` | 仮予約 / 本予約 |

### 2.2 `User`

サーバ内部でのみ保持する。`password` を含むため、そのままクライアントへ送出してはならない。

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | `string` | ○ | ユーザー ID |
| `password` | `string` | ○ | 平文。クライアントへ送出禁止 |
| `profile` | `Profile` | ○ | 公開情報 |

### 2.3 `Profile`

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | `string` | ○ | ログイン照合に使う一意な名前 |
| `displayName` | `string` | ○ | 画面表示用の名前 |
| `role` | `Role` | ○ | |
| `iconUrl` | `string` | | アイコン画像のパス |
| `bio` | `string` | | 経歴・趣味などの自己紹介 |
| `status` | `SelectionStatus` | | 選考ステータス。学生のみ設定される |

### 2.4 `PublicUser`

クライアントへ送出してよい形。`User` から `password` を除去したもの。

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | `string` | |
| `profile` | `Profile` | |

### 2.5 `Message`

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | `string` | |
| `roomId` | `string` | 単体で文脈が完結するよう必ず保持する |
| `userId` | `string` | 送信者 |
| `text` | `string` | 1〜1000 文字（前後の空白は除去済み） |
| `createdAt` | `number` | epoch ミリ秒 |

### 2.6 `ChatRoom`

学生と採用担当の1対1のルーム。学生1人につき必ず1つ存在する。

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | `string` | |
| `userIds` | `string[]` | `[studentId, recruiterId]` |
| `createdAt` | `number` | epoch ミリ秒 |

### 2.7 `Reservation`

**予約可能枠（`TimeSlot`）は事前定義しない。** `Reservation` が存在しない日時を空きとみなす。

**仮予約も枠を占有する。** したがって1つの枠に存在する `Reservation` は状態を問わず常に1件までであり、承認によって枠の空き状況は変化しない。

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | `string` | |
| `recruiterId` | `string` | 採用担当は1人固定のためサーバが解決する |
| `studentId` | `string` | 予約した学生 |
| `startAt` | `number` | epoch ミリ秒。30分の境界に揃っている |
| `endAt` | `number` | `startAt` + 30分 |
| `kind` | `ReservationKind` | |
| `status` | `ReservationStatus` | 作成時は必ず `"tentative"`。採用担当の承認で `"confirmed"` になる |
| `createdAt` | `number` | epoch ミリ秒 |

---

## 3. 共通仕様

### 3.1 時刻

- 全ての時刻は **epoch ミリ秒（`number`）** で保持・送受信する。
- `Date` 型は使用しない。Socket.IO の JSON シリアライズを経ると文字列化され、型定義と実態が乖離するため。
- タイムゾーンは **JST（+09:00）固定**とする。

### 3.2 ack（コールバック）

クライアント → サーバの全イベントは ack を持つ。ack の形式は以下に統一する。

```js
// 成功
{ ok: true, data: { ... } }

// 失敗
{ ok: false, error: "ERROR_CODE" }
```

ack が渡されなかった場合もサーバは異常終了しない。

### 3.3 エラーコード

| コード | 発生条件 |
|---|---|
| `UNAUTHENTICATED` | 未ログインの socket からイベントを受信した |
| `INVALID_CREDENTIALS` | ユーザー名またはパスワードが一致しない |
| `INVALID_PAYLOAD` | 必須項目の欠落、型不正、空文字、文字数超過、列挙値の範囲外、枠境界のずれ |
| `FORBIDDEN` | 権限のない操作（非参加ルームへの送信、学生による一斉送信、採用担当による予約、学生による承認、担当外の予約の承認） |
| `NOT_FOUND` | 指定されたルーム / ユーザー / 採用担当 / 予約が存在しない |
| `SLOT_IN_PAST` | 予約開始時刻が現在時刻以前 |
| `SLOT_ALREADY_BOOKED` | 同一の採用担当・同一時刻の予約が既に存在する |
| `ALREADY_CONFIRMED` | 既に本予約となっている予約を再度承認しようとした |

### 3.4 認証とセッション

- ログイン成功時、`socket.data.userId` にユーザー ID を保持する。
- 同時に `socket.join(userId)` を実行し、**userId を名前とする personal room** へ参加する。
- 配信は常にこの personal room を宛先とする。これにより、同一ユーザーが複数タブで接続していても全てへ届く。
- `loginEvent` を除く全イベントは、ログイン済みであることを検証してから処理する。

### 3.5 配信範囲の原則

| 情報 | 配信先 |
|---|---|
| メッセージ | そのルームの参加者のみ |
| 枠が埋まった事実 | 全接続（予約者の情報は含めない） |
| 予約の内容 | その予約の当事者のみ（予約した学生と担当の採用担当） |

---

## 4. イベント仕様

### 4.1 クライアント → サーバ

#### `loginEvent`

ユーザー名とパスワードを照合し、初期表示に必要なデータを一括で返す。

**payload**

| フィールド | 型 | 説明 |
|---|---|---|
| `name` | `string` | `Profile.name` |
| `password` | `string` | |

**ack（成功時 `data`）**

| フィールド | 型 | 説明 |
|---|---|---|
| `me` | `PublicUser` | ログインしたユーザー |
| `users` | `PublicUser[]` | 全ユーザー（8件） |
| `rooms` | `ChatRoom[]` | 採用担当は全件、学生は自分のルームのみ |
| `messages` | `Message[]` | 上記 `rooms` に属する全メッセージ（古い順） |
| `reservations` | `Reservation[]` | 採用担当は全件、学生は自分の予約のみ |

**エラー**: `INVALID_PAYLOAD`, `INVALID_CREDENTIALS`

---

#### `chat:send`

1件のメッセージを送信する。

**payload**

| フィールド | 型 | 説明 |
|---|---|---|
| `roomId` | `string` | |
| `text` | `string` | 前後の空白を除去して1〜1000文字 |

**ack（成功時 `data`）**: `{ message: Message }`

**副作用**: ルーム参加者全員の personal room へ `chat:message` を配信する（送信者自身を含む）。

**エラー**: `UNAUTHENTICATED`, `INVALID_PAYLOAD`, `NOT_FOUND`, `FORBIDDEN`

---

#### `chat:broadcast`

複数の学生へ同一本文を一斉送信する。**採用担当のみ実行できる。**

各学生とのルームへ、それぞれ別の `id` を持つ `Message` を複製して投入する。通常のメッセージと区別する情報は持たせない。

**payload**

| フィールド | 型 | 説明 |
|---|---|---|
| `userIds` | `string[]` | 宛先の学生 ID。1件以上 |
| `text` | `string` | `chat:send` と同じ制約 |

**ack（成功時 `data`）**: `{ messages: Message[] }`

**副作用**: 対象ルームごとに `chat:message` を配信する。

**原子性**: 宛先を全件検証したうえで送信する。**1件でも該当ルームが存在しない場合は、何も送信せずに全体を失敗させる。**

**エラー**: `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_PAYLOAD`, `NOT_FOUND`

---

#### `reservation:create`

面談・面接を予約する。**学生のみ実行できる。作成される予約は必ず仮予約（`"tentative"`）となる。**
採用担当は1人固定のため、宛先はサーバ側で解決する（クライアントは送らない）。

**payload**

| フィールド | 型 | 説明 |
|---|---|---|
| `startAt` | `number` | epoch ミリ秒。30分の境界に揃っていること |
| `kind` | `ReservationKind` | `"interview"` または `"meeting"` |

> `status` はクライアントから受け取らない。ペイロードに含まれていても無視し、サーバが必ず `"tentative"` を付与する。

**ack（成功時 `data`）**: `{ reservation: Reservation }`

**バリデーション**

1. 実行者が学生であること → 満たさなければ `FORBIDDEN`
2. `startAt` が整数かつ 30分の境界であること → `INVALID_PAYLOAD`
   - JST(+09:00) はミリ秒に直すと30分の倍数のため、epoch 上の剰余判定で JST の境界と一致する
3. `kind` が列挙値の範囲内であること → `INVALID_PAYLOAD`
4. `startAt` が現在時刻より未来であること → `SLOT_IN_PAST`
5. 同一の `recruiterId` × `startAt` の予約が存在しないこと → `SLOT_ALREADY_BOOKED`

**副作用**

- 全接続へ `slot:updated` を配信する
- 採用担当の personal room へ `reservation:created` を配信する

> 受付時間帯（営業時間）の検証は行わない。深夜などの枠も予約できる。

---

#### `reservation:approve`

仮予約を承認して本予約にする。**採用担当のみ実行できる。**

**payload**

| フィールド | 型 | 説明 |
|---|---|---|
| `reservationId` | `string` | 承認する予約の ID |

**ack（成功時 `data`）**: `{ reservation: Reservation }`（`status` が `"confirmed"` になったもの）

**バリデーション**

1. 実行者が採用担当であること → 満たさなければ `FORBIDDEN`
2. `reservationId` が文字列であること → `INVALID_PAYLOAD`
3. 対象の予約が存在すること → `NOT_FOUND`
4. `reservation.recruiterId` が実行者と一致すること → `FORBIDDEN`
5. 対象の予約が `"tentative"` であること → `ALREADY_CONFIRMED`

**副作用**: 予約した学生と担当の採用担当の personal room へ `reservation:approved` を配信する。

`status` 以外のフィールド（`id` / `startAt` / `kind` / `studentId` など）は変更されない。

**承認が失敗した場合は何も配信しない。**

> **`slot:updated` は配信しない。** 仮予約の時点で枠は既に占有されており、承認によって空き状況が変化しないため。

> 開催日時が過ぎた予約でも承認できる。承認は「既に成立した予約の状態遷移」であり、開催日時とは独立した操作として扱う。

> 二重承認は成功として扱わず `ALREADY_CONFIRMED` で拒否する。黙って成功させると UI の競合が隠れるため。

---

### 4.2 サーバ → クライアント

#### `chat:message`

| フィールド | 型 |
|---|---|
| `message` | `Message` |

**配信先**: 該当ルームの参加者の personal room

---

#### `slot:updated`

枠が埋まった事実のみを伝える。**誰が予約したかは含めない。**

| フィールド | 型 | 説明 |
|---|---|---|
| `recruiterId` | `string` | |
| `startAt` | `number` | epoch ミリ秒 |
| `isBooked` | `boolean` | 常に `true` |

**配信先**: 全接続（ブロードキャスト）

**用途**: 他の学生の画面上で該当枠を即座に非活性化し、ダブルブッキングを未然に防ぐ。

---

#### `reservation:created`

| フィールド | 型 |
|---|---|
| `reservation` | `Reservation` |

**配信先**: 採用担当の personal room のみ

**備考**: 予約成立時にチャットへシステムメッセージを自動投稿しないため、採用担当が予約内容を知る唯一の経路となる。

---

#### `reservation:approved`

仮予約が本予約になったことを伝える。

| フィールド | 型 | 説明 |
|---|---|---|
| `reservation` | `Reservation` | `status` は `"confirmed"` |

**配信先**: 予約した学生と、担当の採用担当の personal room

**備考**: 学生が仮予約から本予約への変化を知る唯一の経路となる。

採用担当にも配信するのは、**ack が承認を実行したタブにしか返らない**ためである。同一ユーザーが複数タブで接続している場合、承認していない側のタブの表示が古いままになる。`chat:send` が送信者自身を含むルーム参加者全員へ `chat:message` を配信しているのと同じ考え方に揃えている。

> 承認を実行したタブには **ack とこのイベントの両方**が届く。受信側は冪等に扱うこと（同じ `id` の予約が既にあれば差し替える）。
>
> 無関係の学生には配信されない。

---

## 5. モックデータ

サーバ起動時に一度だけ投入される（[`server/mock.js`](../server/mock.js)）。
ID はデバッグしやすいよう固定文字列とする。実行時に生成する ID は `crypto.randomUUID()` を使う。

### 5.1 採用担当（1人）

| id | name | password | displayName |
|---|---|---|---|
| `recruiter-01` | `recruiter01` | `recruiter123` | 佐藤 健一 |

### 5.2 学生（7人）

パスワードは全員 `student123`。

| id | name | displayName | status |
|---|---|---|---|
| `student-01` | `student01` | 田中 太郎 | `document` |
| `student-02` | `student02` | 鈴木 花子 | `document` |
| `student-03` | `student03` | 高橋 美咲 | `document` |
| `student-04` | `student04` | 伊藤 健太 | `first` |
| `student-05` | `student05` | 渡辺 陽菜 | `first` |
| `student-06` | `student06` | 山本 大輝 | `first` |
| `student-07` | `student07` | 中村 結衣 | `first` |

### 5.3 チャットルーム

- 学生7人分を起動時に自動生成する
- ID は `room-<studentId>`（例: `room-student-01`）
- 各ルームに初期メッセージを2〜3件投入する（全17件）

### 5.4 予約

**0件から始まる。** 全ての未来の枠が予約可能な状態。

---

## 6. データストア

[`server/store.js`](../server/store.js) に以下の Map を保持する。

| 変数 | キー | 値 |
|---|---|---|
| `users` | `userId` | `User` |
| `userIdByName` | `profile.name` | `userId` |
| `rooms` | `roomId` | `ChatRoom` |
| `messagesByRoom` | `roomId` | `Message[]`（古い順） |
| `reservations` | `reservationId` | `Reservation` |
| `reservationIdBySlot` | `recruiterId:startAt` | `reservationId` |

`reservationIdBySlot` はダブルブッキング判定を O(1) で行うための索引。**仮予約・本予約を区別せず1枠につき1件のみ保持する**ため、承認時にこの索引を更新する必要はない。

> **注意**: `socket_event/index.js` は `vite.config.js` から import されているため、サーバ側のコードを編集すると Vite ごと再起動し、投稿したメッセージと予約が全て失われる。モックデータは再生成されるため初期状態には必ず戻る。予約はキャンセルできないため、**枠を使い切った場合の復旧手段はサーバの再起動**となる。

---

## 7. ファイル構成

```
server/
  types.js               モデル定義（JSDoc typedef）
  constants.js           枠の長さ・エラーコード・列挙値・イベント名
  result.js              ack の共通レスポンス形式
  store.js               オンメモリストア
  mock.js                モックデータの投入
  session.js             ログイン済み判定のガード
  presenter.js           password の除去・初期データの組み立て
  index.js               モック投入とハンドラ登録の入口
  handlers/
    auth.js              loginEvent
    chat.js              chat:send / chat:broadcast
    reservation.js       reservation:create / reservation:approve

socket_event/index.js    ハンドラ登録 + 既存イベント（下記参照）
```

---

## 8. 既存イベントの扱い

`socket_event/index.js` に残る以下のイベントは、演習の元要件に由来するもので**本アプリケーションでは使用しない**。

- `enterEvent` — 入室通知
- `exitEvent` — 退室通知
- `publishEvent` — 全体へのメッセージ配信

不要なコンフリクトを避けるため、本ブランチでは変更しない。整理は別ブランチで行う。

同様に、参照されなくなった `users.js` と、実質的に使われなくなった `models/loginUsers.js` の後始末も別途対応する。

> これらのイベントには認証ガードを適用していない。無認証のまま動作する。

---

## 9. フロントエンドとの既知の差異

本ブランチはバックエンド単独で設計しており、現時点のフロントエンド実装とは以下が一致しない。統合時に調整が必要となる。

| 項目 | 本仕様 | 現在のフロントエンド |
|---|---|---|
| 予約枠の長さ | 30分 | 1時間（`src/utils/weekCalendar.js`） |
| 選考ステータス | `"document"` / `"first"` | 選考前 / 選考中 / 面接前 / 面接完了 |
| 予約種別 | `"interview"` / `"meeting"` | `"面接"` / `"面談"` |
| ロール値 | `"student"` / `"recruiter"` | `"member"` / `"official"` |
| 表示名のキー | `displayName` | `displayname` |
| 予約データ | サーバ保持 | `localStorage`（`src/store/bookingStore.js`） |
| 学生一覧 | サーバのモック（7人） | コンポーネント内のモック（25人） |
