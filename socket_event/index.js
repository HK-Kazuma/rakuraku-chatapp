import loginUsers from "../models/loginUsers.js"
import { registerHandlers } from "../server/index.js"

export default (io, socket) => {
  // 本アプリのイベント（loginEvent / chat:* / reservation:*）を登録する
  registerHandlers(io, socket)

  // 入室メッセージをクライアントに送信する
  socket.on("enterEvent", (data) => {
    socket.broadcast.emit("enterEvent", data)
  })

  // 退室メッセージをクライアントに送信する
  socket.on("exitEvent", (data) => {
    loginUsers.remove(socket.id)
    socket.broadcast.emit("exitEvent", data)
  })

  // 投稿メッセージを送信する
  socket.on("publishEvent", (data) => {
    io.sockets.emit("publishEvent", data)
  })

  // 切断時にログイン中ユーザーの情報を削除する
  socket.on("disconnect", () => {
    loginUsers.remove(socket.id)
  })
}
