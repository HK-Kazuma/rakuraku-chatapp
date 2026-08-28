import { randomUUID } from "node:crypto"
import { ROLE } from "./constants.js"

/**
 * オンメモリのデータストア
 * Vite の dev server が再起動すると内容は失われ、モックから作り直される
 */

/** @type {Map<string, import("./types.js").User>} userId -> User */
const users = new Map()

/** @type {Map<string, string>} profile.name -> userId */
const userIdByName = new Map()

/** @type {Map<string, import("./types.js").ChatRoom>} roomId -> ChatRoom */
const rooms = new Map()

/** @type {Map<string, import("./types.js").Message[]>} roomId -> Message[]（古い順） */
const messagesByRoom = new Map()

/** @type {Map<string, import("./types.js").Reservation>} reservationId -> Reservation */
const reservations = new Map()

/** @type {Map<string, string>} ダブルブッキング判定用の索引。`recruiterId:startAt` -> reservationId */
const reservationIdBySlot = new Map()

const slotKey = (recruiterId, startAt) => `${recruiterId}:${startAt}`

// #region 書き込み
/** @param {import("./types.js").User} user */
const addUser = (user) => {
  users.set(user.id, user)
  userIdByName.set(user.profile.name, user.id)
  return user
}

/** @param {import("./types.js").ChatRoom} room */
const addRoom = (room) => {
  rooms.set(room.id, room)
  if (!messagesByRoom.has(room.id)) messagesByRoom.set(room.id, [])
  return room
}

/** @param {import("./types.js").Message} message */
const addMessage = (message) => {
  const list = messagesByRoom.get(message.roomId)
  if (!list) return null
  list.push(message)
  return message
}

/** @param {import("./types.js").Reservation} reservation */
const addReservation = (reservation) => {
  reservations.set(reservation.id, reservation)
  reservationIdBySlot.set(slotKey(reservation.recruiterId, reservation.startAt), reservation.id)
  return reservation
}

/**
 * 予約の状態のみを更新する
 * 枠の占有状態は仮予約の時点で確定しているため、reservationIdBySlot は変更しない
 * @param {string} reservationId
 * @param {import("./types.js").ReservationStatus} status
 */
const updateReservationStatus = (reservationId, status) => {
  const reservation = reservations.get(reservationId)
  if (!reservation) return null
  reservation.status = status
  return reservation
}
// #endregion

// #region 参照
const getUser = (userId) => users.get(userId) ?? null

const findUserByName = (name) => {
  const userId = userIdByName.get(name)
  return userId ? users.get(userId) ?? null : null
}

const listUsers = () => [...users.values()]

/** 採用担当は1人のみ存在する前提 */
const getRecruiter = () => listUsers().find((u) => u.profile.role === ROLE.RECRUITER) ?? null

const getRoom = (roomId) => rooms.get(roomId) ?? null

const listRooms = () => [...rooms.values()]

const listRoomsOf = (userId) => listRooms().filter((room) => room.userIds.includes(userId))

const listMessages = (roomId) => messagesByRoom.get(roomId) ?? []

/** 指定ユーザーがそのルームの参加者かどうか */
const isMember = (roomId, userId) => getRoom(roomId)?.userIds.includes(userId) ?? false

const listReservations = () => [...reservations.values()]

const listReservationsOf = (userId) =>
  listReservations().filter((r) => r.studentId === userId || r.recruiterId === userId)

const isSlotBooked = (recruiterId, startAt) => reservationIdBySlot.has(slotKey(recruiterId, startAt))

const getReservation = (reservationId) => reservations.get(reservationId) ?? null
// #endregion

const createId = () => randomUUID()

/** モックの再投入時に使う */
const clear = () => {
  users.clear()
  userIdByName.clear()
  rooms.clear()
  messagesByRoom.clear()
  reservations.clear()
  reservationIdBySlot.clear()
}

export default {
  addUser,
  addRoom,
  addMessage,
  addReservation,
  updateReservationStatus,
  getUser,
  findUserByName,
  listUsers,
  getRecruiter,
  getRoom,
  listRooms,
  listRoomsOf,
  listMessages,
  isMember,
  listReservations,
  listReservationsOf,
  isSlotBooked,
  getReservation,
  createId,
  clear,
}
