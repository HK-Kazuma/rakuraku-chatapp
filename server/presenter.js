import { ROLE } from "./constants.js"
import store from "./store.js"

/**
 * password を除いた、クライアントへ送出してよい形へ変換する
 * @param {import("./types.js").User} user
 * @returns {import("./types.js").PublicUser}
 */
export const toPublicUser = (user) => ({
  id: user.id,
  profile: { ...user.profile },
})

/**
 * ログイン直後にクライアントが必要とする初期データを組み立てる
 * 採用担当は全ルーム・全予約を、学生は自分の分のみを受け取る
 *
 * @param {import("./types.js").User} user
 */
export const buildInitialState = (user) => {
  const isRecruiter = user.profile.role === ROLE.RECRUITER

  const rooms = isRecruiter ? store.listRooms() : store.listRoomsOf(user.id)

  const messages = rooms.flatMap((room) => store.listMessages(room.id))

  const reservations = isRecruiter
    ? store.listReservations()
    : store.listReservationsOf(user.id)

  return {
    me: toPublicUser(user),
    users: store.listUsers().map(toPublicUser),
    rooms,
    messages,
    reservations,
  }
}
