import { reactive } from "vue"
import socketManager from "../socketManager.js"

// ログイン時にサーバから受け取った初期データ（me / users / rooms / messages / reservations）を
// アプリ全体で共有する。オンメモリのため、リロードすると失われて再ログインが必要になる。

let socketBound = false

export const appStore = reactive({
  me: null,
  users: [],
  rooms: [],
  // roomId -> Message[]（古い順）
  messagesByRoom: {},
  // 予約の内容。採用担当は全件、学生は自分の分のみ（reservation:created は採用担当にしか届かない）
  reservations: [],
  // 埋まっている枠の開始時刻（epoch ミリ秒）の集合。
  // slot:updated（全接続へ配信・予約者情報なし）と自分の予約から組み立てる
  bookedStartAts: new Set(),

  get isRecruiter() {
    return this.me?.profile.role === "recruiter"
  },

  get isStudent() {
    return this.me?.profile.role === "student"
  },

  userById(id) {
    return this.users.find((u) => u.id === id) ?? null
  },

  roomById(id) {
    return this.rooms.find((r) => r.id === id) ?? null
  },

  // 指定ユーザーと自分の1対1ルーム
  roomWith(userId) {
    return this.rooms.find(
      (r) => r.userIds.includes(userId) && r.userIds.includes(this.me?.id)
    ) ?? null
  },

  messagesOf(roomId) {
    return this.messagesByRoom[roomId] ?? []
  },

  reservationAt(startAt) {
    return this.reservations.find((r) => r.startAt === startAt) ?? null
  },

  isSlotBooked(startAt) {
    return this.bookedStartAts.has(startAt)
  },

  // loginEvent の ack.data をそのまま渡す
  initFromLogin(data) {
    this.me = data.me
    this.users = data.users ?? []
    this.rooms = data.rooms ?? []

    this.messagesByRoom = {}
    for (const room of this.rooms) {
      this.messagesByRoom[room.id] = []
    }
    for (const message of data.messages ?? []) {
      this.appendMessage(message)
    }

    this.reservations = []
    this.bookedStartAts.clear()
    for (const reservation of data.reservations ?? []) {
      this.addReservation(reservation)
    }

    bindSocket()
  },

  appendMessage(message) {
    const list = (this.messagesByRoom[message.roomId] ??= [])
    // 送信者は ack と chat:message の両方で同じメッセージを受け取るため重複を防ぐ
    if (list.some((m) => m.id === message.id)) return
    list.push(message)
  },

  addReservation(reservation) {
    if (!this.reservations.some((r) => r.id === reservation.id)) {
      this.reservations.push(reservation)
    }
    this.bookedStartAts.add(reservation.startAt)
  },

  markSlotBooked(startAt) {
    this.bookedStartAts.add(startAt)
  },

  // 予約の承認（仮予約→本予約）をローカルへ反映する
  updateReservationStatus(reservationId, status) {
    const reservation = this.reservations.find((r) => r.id === reservationId)
    if (reservation) {
      reservation.status = status
    }
  },

  reset() {
    this.me = null
    this.users = []
    this.rooms = []
    this.messagesByRoom = {}
    this.reservations = []
    this.bookedStartAts.clear()
  },
})

// サーバ -> クライアントのイベントを一度だけ購読する
function bindSocket() {
  if (socketBound) return
  socketBound = true

  const socket = socketManager.getInstance()

  socket.on("chat:message", ({ message }) => {
    appStore.appendMessage(message)
  })

  // 枠が埋まった事実のみ（誰が予約したかは含まれない）。全接続へ配信される
  socket.on("slot:updated", ({ startAt }) => {
    appStore.markSlotBooked(startAt)
  })

  // 予約の内容。その予約の当事者（学生・採用担当）の personal room にのみ配信される
  socket.on("reservation:created", ({ reservation }) => {
    appStore.addReservation(reservation)
  })

  // 仮予約が本予約になった事実。承認した本人のタブには ack と両方届くため冪等に扱う
  socket.on("reservation:approved", ({ reservation }) => {
    appStore.addReservation(reservation)
    appStore.updateReservationStatus(reservation.id, reservation.status)
  })
}
