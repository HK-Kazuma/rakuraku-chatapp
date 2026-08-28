// 学生側・採用担当者側の週間カレンダー（縦軸:時間 / 横軸:日付と曜日）で共通利用する日付ユーティリティ
export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"]

// 予約1枠の長さ（分）。バックエンド仕様（server/constants.js の SLOT_DURATION_MS）と揃える
export const SLOT_MINUTES = 30
export const SLOT_DURATION_MS = SLOT_MINUTES * 60 * 1000

// 面談・面接の受付時間帯（9:00〜20:00、30分刻み）。最後の枠の開始は 19:30
export const SLOTS = (() => {
  const out = []
  for (let m = 9 * 60; m < 20 * 60; m += SLOT_MINUTES) {
    const h = Math.floor(m / 60)
    const min = m % 60
    out.push({
      minutes: m,
      label: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
      isHour: min === 0,
    })
  }
  return out
})()

export function formatDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// weekOffset: 0 = 今週、1 = 来週、-1 = 先週
export function getWeekDates(weekOffset) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const sunday = new Date(today)
  sunday.setDate(today.getDate() - today.getDay() + weekOffset * 7)

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(sunday)
    date.setDate(sunday.getDate() + i)
    return {
      date,
      dateKey: formatDateKey(date),
      day: date.getDate(),
      month: date.getMonth() + 1,
      weekday: WEEKDAY_LABELS[date.getDay()],
      isToday: formatDateKey(date) === formatDateKey(today),
    }
  })
}

// 指定の日付・枠の開始時刻を epoch ミリ秒で返す（バックエンドは epoch ミリ秒でやり取りする）
export function slotStartAt(dateInfo, slot) {
  const d = new Date(dateInfo.date)
  d.setHours(0, 0, 0, 0)
  return d.getTime() + slot.minutes * 60 * 1000
}

// 枠の「開始〜終了」表示（例: "9:00〜9:30"）
export function slotRangeLabel(startAt) {
  const start = new Date(startAt)
  const end = new Date(startAt + SLOT_DURATION_MS)
  const fmt = (dt) => `${dt.getHours()}:${String(dt.getMinutes()).padStart(2, "0")}`
  return `${fmt(start)}〜${fmt(end)}`
}

// 指定の開始時刻の枠がすでに過去かどうかを判定する
export function isPastSlot(startAt) {
  return startAt <= Date.now()
}
