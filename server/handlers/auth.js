import { CLIENT_EVENT, ERROR } from "../constants.js"
import { buildInitialState } from "../presenter.js"
import { fail, ok, toResponder } from "../result.js"
import store from "../store.js"

/**
 * ログインを処理する
 * 成功時は socket に userId を紐づけ、userId 名の personal room へ join する
 * これにより、同一ユーザーが複数タブで接続していても全てへ配信できる
 *
 * payload: { name: string, password: string }
 * ack:     { ok: true, data: { me, users, rooms, messages, reservations } } | { ok: false, error }
 */
export const register = (io, socket) => {
  socket.on(CLIENT_EVENT.LOGIN, (payload, ack) => {
    const respond = toResponder(ack)

    if (
      !payload ||
      typeof payload.name !== "string" ||
      typeof payload.password !== "string"
    ) {
      respond(fail(ERROR.INVALID_PAYLOAD))
      return
    }

    const user = store.findUserByName(payload.name)
    if (!user || user.password !== payload.password) {
      respond(fail(ERROR.INVALID_CREDENTIALS))
      return
    }

    socket.data.userId = user.id
    socket.join(user.id)

    respond(ok(buildInitialState(user)))
  })
}
