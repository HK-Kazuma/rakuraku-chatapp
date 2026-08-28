import { CLIENT_EVENT, ERROR, MESSAGE_MAX_LENGTH, ROLE, SERVER_EVENT } from "../constants.js"
import { fail, ok } from "../result.js"
import { withAuth } from "../session.js"
import store from "../store.js"

/**
 * 本文を検証して正規化する
 * @returns {string | null} 不正なら null
 */
const normalizeText = (text) => {
  if (typeof text !== "string") return null
  const trimmed = text.trim()
  if (trimmed === "") return null
  if (trimmed.length > MESSAGE_MAX_LENGTH) return null
  return trimmed
}

/** ルームの参加者全員（personal room）へ配信する */
const emitToRoomMembers = (io, room, message) => {
  room.userIds.forEach((memberId) => {
    io.to(memberId).emit(SERVER_EVENT.CHAT_MESSAGE, { message })
  })
}

const createMessage = (roomId, userId, text) =>
  store.addMessage({
    id: store.createId(),
    roomId,
    userId,
    text,
    createdAt: Date.now(),
  })

export const register = (io, socket) => {
  // 1件のメッセージを送信する
  // payload: { roomId: string, text: string }
  // ack:     { ok: true, data: { message } } | { ok: false, error }
  socket.on(
    CLIENT_EVENT.CHAT_SEND,
    withAuth(socket, ({ userId, payload, respond }) => {
      const text = normalizeText(payload?.text)
      if (!payload || typeof payload.roomId !== "string" || text === null) {
        respond(fail(ERROR.INVALID_PAYLOAD))
        return
      }

      const room = store.getRoom(payload.roomId)
      if (!room) {
        respond(fail(ERROR.NOT_FOUND))
        return
      }
      if (!room.userIds.includes(userId)) {
        respond(fail(ERROR.FORBIDDEN))
        return
      }

      const message = createMessage(room.id, userId, text)
      emitToRoomMembers(io, room, message)
      respond(ok({ message }))
    })
  )

  // 複数の学生へ同一本文を一斉送信する
  // 各学生とのルームに個別のメッセージを複製して投入する
  // payload: { userIds: string[], text: string }
  // ack:     { ok: true, data: { messages } } | { ok: false, error }
  socket.on(
    CLIENT_EVENT.CHAT_BROADCAST,
    withAuth(socket, ({ userId, payload, respond }) => {
      const sender = store.getUser(userId)
      if (sender?.profile.role !== ROLE.RECRUITER) {
        respond(fail(ERROR.FORBIDDEN))
        return
      }

      const text = normalizeText(payload?.text)
      const userIds = payload?.userIds
      if (!Array.isArray(userIds) || userIds.length === 0 || text === null) {
        respond(fail(ERROR.INVALID_PAYLOAD))
        return
      }

      // 1件でも不正な宛先があれば、何も送らずに全体を失敗させる
      const rooms = []
      for (const targetId of userIds) {
        const targetRooms = store.listRoomsOf(targetId)
        const room = targetRooms.find((r) => r.userIds.includes(userId))
        if (!room) {
          respond(fail(ERROR.NOT_FOUND))
          return
        }
        rooms.push(room)
      }

      const messages = rooms.map((room) => {
        const message = createMessage(room.id, userId, text)
        emitToRoomMembers(io, room, message)
        return message
      })

      respond(ok({ messages }))
    })
  )
}
