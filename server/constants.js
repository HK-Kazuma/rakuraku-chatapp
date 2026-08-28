// 予約1枠の長さ（30分固定）
// 変更する場合はここだけを直せばよい
export const SLOT_DURATION_MS = 30 * 60 * 1000

// メッセージ本文の最大文字数
export const MESSAGE_MAX_LENGTH = 1000

// ack で返すエラーコード
export const ERROR = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  INVALID_PAYLOAD: "INVALID_PAYLOAD",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  SLOT_IN_PAST: "SLOT_IN_PAST",
  SLOT_ALREADY_BOOKED: "SLOT_ALREADY_BOOKED",
  ALREADY_CONFIRMED: "ALREADY_CONFIRMED",
}

// ユーザーの役割
export const ROLE = {
  STUDENT: "student",
  RECRUITER: "recruiter",
}

// 選考ステータス（学生のみ）
export const SELECTION_STATUS = {
  DOCUMENT: "document",
  FIRST: "first",
}

// 予約の種別
export const RESERVATION_KIND = {
  INTERVIEW: "interview",
  MEETING: "meeting",
}

// 予約の状態
// 学生が作成した時点では仮予約、採用担当が承認すると本予約になる
export const RESERVATION_STATUS = {
  TENTATIVE: "tentative",
  CONFIRMED: "confirmed",
}

// クライアント -> サーバ
export const CLIENT_EVENT = {
  LOGIN: "loginEvent",
  CHAT_SEND: "chat:send",
  CHAT_BROADCAST: "chat:broadcast",
  RESERVATION_CREATE: "reservation:create",
  RESERVATION_APPROVE: "reservation:approve",
}

// サーバ -> クライアント
export const SERVER_EVENT = {
  CHAT_MESSAGE: "chat:message",
  SLOT_UPDATED: "slot:updated",
  RESERVATION_CREATED: "reservation:created",
  RESERVATION_APPROVED: "reservation:approved",
}
