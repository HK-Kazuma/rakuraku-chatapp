// ack で返す共通レスポンス形式
export const ok = (data) => ({ ok: true, data })

export const fail = (error) => ({ ok: false, error })

// ack が渡されなかった場合でも落ちないようにする
export const toResponder = (ack) => (typeof ack === "function" ? ack : () => {})
