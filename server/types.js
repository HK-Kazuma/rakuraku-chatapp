// アプリケーション全体で共有するモデル定義（JSDoc typedef）
// 実行時の値を持たない型定義専用のモジュール

/** @typedef {"student" | "recruiter"} Role */

/** @typedef {"document" | "first"} SelectionStatus 選考ステータス（学生のみ） */

/** @typedef {"interview" | "meeting"} ReservationKind */

/** @typedef {"tentative" | "confirmed"} ReservationStatus 仮予約 / 本予約 */

/**
 * ユーザーの公開情報
 * @typedef {Object} Profile
 * @property {string} name ログイン照合に使う一意な名前
 * @property {string} displayName 画面表示用の名前
 * @property {Role} role
 * @property {string} [iconUrl]
 * @property {string} [bio] 経歴・趣味などの自己紹介
 * @property {SelectionStatus} [status] 選考ステータス。学生のみ設定される
 */

/**
 * サーバ内部で保持するユーザー
 * password を含むため、そのままクライアントへ送ってはならない
 * @typedef {Object} User
 * @property {string} id
 * @property {string} password
 * @property {Profile} profile
 */

/**
 * クライアントへ送出してよいユーザー情報
 * @typedef {Object} PublicUser
 * @property {string} id
 * @property {Profile} profile
 */

/**
 * @typedef {Object} Message
 * @property {string} id
 * @property {string} roomId
 * @property {string} userId 送信者
 * @property {string} text
 * @property {number} createdAt epoch ミリ秒
 */

/**
 * 学生と採用担当の1対1のチャットルーム
 * @typedef {Object} ChatRoom
 * @property {string} id
 * @property {string[]} userIds [studentId, recruiterId]
 * @property {number} createdAt epoch ミリ秒
 */

/**
 * 面談・面接の予約
 * 予約可能枠は事前定義せず、Reservation が存在しない日時を空きとみなす
 * 仮予約も枠を占有するため、1つの枠に存在する Reservation は常に1件までとなる
 * @typedef {Object} Reservation
 * @property {string} id
 * @property {string} recruiterId
 * @property {string} studentId
 * @property {number} startAt epoch ミリ秒
 * @property {number} endAt startAt + SLOT_DURATION_MS
 * @property {ReservationKind} kind
 * @property {ReservationStatus} status 作成時は必ず tentative。採用担当の承認で confirmed になる
 * @property {number} createdAt epoch ミリ秒
 */

export {}
