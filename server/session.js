import { ERROR } from "./constants.js"
import { fail, toResponder } from "./result.js"

/**
 * ログイン済みかどうかを検証してからハンドラを呼び出す
 * ログイン状態は socket.data.userId に保持する（loginEvent で設定される）
 * 既存の enterEvent / exitEvent / publishEvent には適用しない
 *
 * @param {import("socket.io").Socket} socket
 * @param {(ctx: { userId: string, payload: any, respond: (res: any) => void }) => void} handler
 */
export const withAuth = (socket, handler) => (payload, ack) => {
  const respond = toResponder(ack)
  const userId = socket.data.userId

  if (!userId) {
    respond(fail(ERROR.UNAUTHENTICATED))
    return
  }

  handler({ userId, payload, respond })
}
