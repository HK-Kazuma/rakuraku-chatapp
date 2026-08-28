import {
  CLIENT_EVENT,
  ERROR,
  RESERVATION_KIND,
  RESERVATION_STATUS,
  ROLE,
  SERVER_EVENT,
  SLOT_DURATION_MS,
} from "../constants.js"
import { fail, ok } from "../result.js"
import { withAuth } from "../session.js"
import store from "../store.js"

const KINDS = Object.values(RESERVATION_KIND)

/**
 * 予約開始時刻として妥当かを検証する
 * 枠は事前定義せず、SLOT_DURATION_MS の境界に揃っていることのみを条件とする
 * JST(+09:00) はミリ秒に直すと 30 分の倍数なので、epoch 上での剰余判定で JST の境界と一致する
 */
const isValidStartAt = (startAt) =>
  Number.isInteger(startAt) && startAt > 0 && startAt % SLOT_DURATION_MS === 0

export const register = (io, socket) => {
  // 面談・面接を予約する（仮予約として作成される）
  // 採用担当は1人固定のため、宛先はサーバ側で解決する
  // payload: { startAt: number, kind: "interview" | "meeting" }
  // ack:     { ok: true, data: { reservation } } | { ok: false, error }
  socket.on(
    CLIENT_EVENT.RESERVATION_CREATE,
    withAuth(socket, ({ userId, payload, respond }) => {
      const student = store.getUser(userId)
      if (student?.profile.role !== ROLE.STUDENT) {
        respond(fail(ERROR.FORBIDDEN))
        return
      }

      const startAt = payload?.startAt
      const kind = payload?.kind
      if (!isValidStartAt(startAt) || !KINDS.includes(kind)) {
        respond(fail(ERROR.INVALID_PAYLOAD))
        return
      }

      // クライアント側の判定をすり抜けた過去日時をサーバでも弾く
      if (startAt <= Date.now()) {
        respond(fail(ERROR.SLOT_IN_PAST))
        return
      }

      const recruiter = store.getRecruiter()
      if (!recruiter) {
        respond(fail(ERROR.NOT_FOUND))
        return
      }

      // ダブルブッキング制御
      if (store.isSlotBooked(recruiter.id, startAt)) {
        respond(fail(ERROR.SLOT_ALREADY_BOOKED))
        return
      }

      const reservation = store.addReservation({
        id: store.createId(),
        recruiterId: recruiter.id,
        studentId: student.id,
        startAt,
        endAt: startAt + SLOT_DURATION_MS,
        kind,
        // 状態はクライアントから受け取らず、必ず仮予約として作成する
        status: RESERVATION_STATUS.TENTATIVE,
        createdAt: Date.now(),
      })

      // 枠が埋まった事実のみを全接続へ配信する（誰が予約したかは含めない）
      io.emit(SERVER_EVENT.SLOT_UPDATED, {
        recruiterId: reservation.recruiterId,
        startAt: reservation.startAt,
        isBooked: true,
      })

      // 予約内容は採用担当にのみ通知する
      io.to(recruiter.id).emit(SERVER_EVENT.RESERVATION_CREATED, { reservation })

      respond(ok({ reservation }))
    })
  )

  // 仮予約を承認して本予約にする
  // 枠は仮予約の時点で既に占有されているため、slot:updated は配信しない
  // payload: { reservationId: string }
  // ack:     { ok: true, data: { reservation } } | { ok: false, error }
  // 副作用: 予約した学生と担当の採用担当へ reservation:approved を配信する
  socket.on(
    CLIENT_EVENT.RESERVATION_APPROVE,
    withAuth(socket, ({ userId, payload, respond }) => {
      const recruiter = store.getUser(userId)
      if (recruiter?.profile.role !== ROLE.RECRUITER) {
        respond(fail(ERROR.FORBIDDEN))
        return
      }

      const reservationId = payload?.reservationId
      if (typeof reservationId !== "string") {
        respond(fail(ERROR.INVALID_PAYLOAD))
        return
      }

      const reservation = store.getReservation(reservationId)
      if (!reservation) {
        respond(fail(ERROR.NOT_FOUND))
        return
      }

      // 自分が担当する予約のみ承認できる
      if (reservation.recruiterId !== recruiter.id) {
        respond(fail(ERROR.FORBIDDEN))
        return
      }

      // 二重承認は UI の競合を示すため、黙って成功させずに拒否する
      if (reservation.status === RESERVATION_STATUS.CONFIRMED) {
        respond(fail(ERROR.ALREADY_CONFIRMED))
        return
      }

      const updated = store.updateReservationStatus(
        reservation.id,
        RESERVATION_STATUS.CONFIRMED
      )

      // 学生は仮予約が本予約に変わったことを知る手段がこれしかない
      // 採用担当にも配信するのは、ack が承認を実行したタブにしか返らず、
      // 同一ユーザーの他のタブの表示が古いままになるため
      io.to(updated.studentId).emit(SERVER_EVENT.RESERVATION_APPROVED, {
        reservation: updated,
      })
      io.to(updated.recruiterId).emit(SERVER_EVENT.RESERVATION_APPROVED, {
        reservation: updated,
      })

      respond(ok({ reservation: updated }))
    })
  )
}
