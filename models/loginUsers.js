// socket.id -> ユーザー情報（password除く）のログイン中ユーザーを保持する
const loginUsers = new Map()

const add = (socketId, profile) => {
  loginUsers.set(socketId, { ...profile })
}

const remove = (socketId) => {
  loginUsers.delete(socketId)
}

const get = (socketId) => {
  return loginUsers.get(socketId)
}

const isAdmin = (socketId) => {
  return loginUsers.get(socketId)?.role === "official"
}

export default { add, remove, get, isAdmin }
