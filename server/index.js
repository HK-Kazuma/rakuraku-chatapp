import * as auth from "./handlers/auth.js"
import * as chat from "./handlers/chat.js"
import * as reservation from "./handlers/reservation.js"
import { seed } from "./mock.js"

// モックデータの投入はプロセス起動時に一度だけ行う
seed()

/**
 * 接続してきた socket に対して、本アプリのイベントハンドラを登録する
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 */
export const registerHandlers = (io, socket) => {
  auth.register(io, socket)
  chat.register(io, socket)
  reservation.register(io, socket)
}
