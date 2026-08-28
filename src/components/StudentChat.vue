<script setup>
import { ref, computed, onUnmounted } from "vue"
import userIcon from "../images/user-solid.svg"
import {
  SLOTS,
  getWeekDates,
  isPastSlot,
  slotStartAt,
  slotRangeLabel,
} from "../utils/weekCalendar"
import socketManager from "../socketManager.js"
import { appStore } from "../store/appStore.js"

// #region socket / server state
const socket = socketManager.getInstance()

// 学生は自分と採用担当の1対1ルームを1つだけ持つ
const myRoom = computed(() => appStore.rooms[0] ?? null)

const recruiter = computed(() => {
  const room = myRoom.value
  if (!room) return null
  const otherId = room.userIds.find((id) => id !== appStore.me?.id)
  return appStore.userById(otherId)
})

const chatMessages = computed(() =>
  myRoom.value ? appStore.messagesOf(myRoom.value.id) : []
)

const myDisplayName = computed(() => appStore.me?.profile.displayName ?? "")
// #endregion

// #region reservation
// バックエンドの予約種別（server/constants.js の RESERVATION_KIND）と揃える
const KIND_LABEL = { meeting: "面談", interview: "面接" }
const kindLabel = (kind) => KIND_LABEL[kind] ?? kind

// 予約ステータス（バックエンドは tentative / confirmed）。自分の予約のみ判別できる
const reservationStatusChar = (status) => (status === "confirmed" ? "本" : "仮")

const RESERVATION_ERROR = {
  SLOT_ALREADY_BOOKED: "この枠はすでに予約されています。",
  SLOT_IN_PAST: "過去の時間は予約できません。",
  INVALID_PAYLOAD: "予約内容を確認してください。",
  FORBIDDEN: "予約の権限がありません。",
  UNAUTHENTICATED: "ログインし直してください。",
  NOT_FOUND: "採用担当が見つかりませんでした。",
}
const reservationErrorMessage = (code) =>
  RESERVATION_ERROR[code] ?? "予約に失敗しました。"
// #endregion

// #region reactive variable
const chatContent = ref("")
const isCalendarOpen = ref(false)
const weekOffset = ref(0)
const pendingSlot = ref(null) // { dateInfo, slot, startAt, kind }
const isSubmitting = ref(false)
const toastMessage = ref("") // 予約完了などの一時的なポップアップ表示
let toastTimer = null
// #endregion

// #region computed
const weekDates = computed(() => getWeekDates(weekOffset.value))
const weekRangeLabel = computed(() => {
  const dates = weekDates.value
  return `${dates[0].month}/${dates[0].day} 〜 ${dates[6].month}/${dates[6].day}`
})
// #endregion

// #region browser event handler
// メッセージを送信する
const onPublish = () => {
  const text = chatContent.value.trim()
  if (!text || !myRoom.value) return

  socket.emit("chat:send", { roomId: myRoom.value.id, text }, (res) => {
    if (!res || !res.ok) return
    // 送信したメッセージは chat:message で配信されて表示される
    chatContent.value = ""
  })
}

// カレンダーパネルの開閉を切り替える
const onToggleCalendar = () => {
  isCalendarOpen.value = !isCalendarOpen.value
}

// 週を移動する
const onChangeWeek = (diff) => {
  weekOffset.value += diff
}

// 予約可能な枠か判定する
const isSlotBookable = (startAt) =>
  !isPastSlot(startAt) && !appStore.isSlotBooked(startAt)

// 自分が予約した枠か
const isMySlot = (startAt) => appStore.reservationAt(startAt) !== null

// 自分の予約枠に表示する文字（仮予約=仮、本予約=本）。他者の予約は状態が分からないため空文字
const mySlotChar = (startAt) => {
  const reservation = appStore.reservationAt(startAt)
  return reservation ? reservationStatusChar(reservation.status) : ""
}

// 自分の予約枠のステータスに応じたクラス
const mySlotStatusClass = (startAt) => {
  const reservation = appStore.reservationAt(startAt)
  if (!reservation) return {}
  return {
    "is-tentative": reservation.status === "tentative",
    "is-confirmed": reservation.status === "confirmed",
  }
}

// 面談・面接の候補枠を選択する
const onSelectSlot = (dateInfo, slot) => {
  const startAt = slotStartAt(dateInfo, slot)
  if (!isSlotBookable(startAt)) return
  pendingSlot.value = { dateInfo, slot, startAt, kind: "meeting" }
}

// 確認ポップアップを閉じる
const onCancelBooking = () => {
  pendingSlot.value = null
}

// 予約を確定する
const onConfirmBooking = () => {
  if (!pendingSlot.value || isSubmitting.value) return
  const { dateInfo, slot, startAt, kind } = pendingSlot.value

  isSubmitting.value = true
  socket.emit("reservation:create", { startAt, kind }, (res) => {
    isSubmitting.value = false

    if (!res || !res.ok) {
      showToast(reservationErrorMessage(res && res.error))
      // 他者に先を越されていた場合は枠を非活性化して閉じる
      if (res && res.error === "SLOT_ALREADY_BOOKED") {
        appStore.markSlotBooked(startAt)
        pendingSlot.value = null
      }
      return
    }

    appStore.addReservation(res.data.reservation)

    const label = kindLabel(kind)
    showToast(
      `${dateInfo.month}月${dateInfo.day}日(${dateInfo.weekday}) ${slotRangeLabel(startAt)}に${label}の予約を完了しました。`
    )
    chatContent.value = `${dateInfo.month}月${dateInfo.day}日(${dateInfo.weekday}) ${slot.label}から${label}を予約しましたので、よろしくお願いいたします。`

    // カレンダーは開いたままにして、予約した枠が即座に色づくのを見せる
    pendingSlot.value = null
  })
}

// ポップアップを表示し、数秒後に自動で消す
const showToast = (message) => {
  toastMessage.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMessage.value = ""
    toastTimer = null
  }, 3500)
}

onUnmounted(() => {
  if (toastTimer) clearTimeout(toastTimer)
})
// #endregion
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="recruiter-card">
        <img :src="userIcon" alt="担当者アイコン" class="recruiter-icon" />
        <div class="recruiter-name">{{ recruiter?.profile.displayName }}</div>
        <div class="recruiter-bio">{{ recruiter?.profile.bio }}</div>
      </div>
    </aside>

    <main class="chat-area">
      <div class="chat-header">{{ recruiter?.profile.displayName }}さんとのチャット</div>

      <div class="message-list">
        <div
          v-for="msg in chatMessages"
          :key="msg.id"
          class="message"
          :class="msg.userId === appStore.me?.id ? 'message-self' : 'message-other'"
        >
          {{ msg.text }}
        </div>
      </div>

      <div class="composer">
        <textarea
          v-model="chatContent"
          placeholder="メッセージを入力してください"
          rows="3"
          class="composer-input"
        ></textarea>
        <button type="button" class="button-normal" @click="onPublish">送信</button>
      </div>
    </main>

    <button
      type="button"
      class="calendar-tab"
      :class="{ 'is-open': isCalendarOpen }"
      @click="onToggleCalendar"
    >
      面談・面接を予約
    </button>

    <Transition name="slide-panel">
      <aside v-if="isCalendarOpen" class="calendar-panel">
        <div class="calendar-header">
          <button type="button" class="week-nav-button" @click="onChangeWeek(-1)">＜前の週</button>
          <span class="week-range-label">{{ weekRangeLabel }}</span>
          <button type="button" class="week-nav-button" @click="onChangeWeek(1)">次の週＞</button>
        </div>

        <div class="week-table-wrap">
          <table class="week-table">
            <thead>
              <tr>
                <th class="hour-col"></th>
                <th
                  v-for="dateInfo in weekDates"
                  :key="dateInfo.dateKey"
                  :class="{ 'is-today': dateInfo.isToday }"
                >
                  <div class="date-label">{{ dateInfo.month }}/{{ dateInfo.day }}</div>
                  <div class="weekday-label">({{ dateInfo.weekday }})</div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="slot in SLOTS" :key="slot.minutes" :class="{ 'is-half': !slot.isHour }">
                <th class="hour-col">{{ slot.label }}</th>
                <td
                  v-for="dateInfo in weekDates"
                  :key="dateInfo.dateKey"
                  class="slot-cell"
                  :class="{
                    'is-bookable': isSlotBookable(slotStartAt(dateInfo, slot)),
                    'is-unavailable': !isSlotBookable(slotStartAt(dateInfo, slot)),
                    'is-booked': appStore.isSlotBooked(slotStartAt(dateInfo, slot)),
                    'is-mine': isMySlot(slotStartAt(dateInfo, slot)),
                    'is-selected':
                      pendingSlot && pendingSlot.startAt === slotStartAt(dateInfo, slot),
                    ...mySlotStatusClass(slotStartAt(dateInfo, slot)),
                  }"
                  @click="onSelectSlot(dateInfo, slot)"
                >{{ mySlotChar(slotStartAt(dateInfo, slot)) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="calendar-note">空いている枠をクリックすると、面談・面接の予約ができます。オレンジは予約済み、濃い色はあなたの予約です。</p>
      </aside>
    </Transition>

    <div v-if="pendingSlot" class="modal-backdrop" @click.self="onCancelBooking">
      <div class="modal-box">
        <div class="modal-title">予約内容の確認</div>
        <div class="modal-datetime">
          {{ pendingSlot.dateInfo.month }}月{{ pendingSlot.dateInfo.day }}日({{ pendingSlot.dateInfo.weekday }})
          {{ slotRangeLabel(pendingSlot.startAt) }}
        </div>

        <div class="modal-type-select">
          <label>
            <input type="radio" value="meeting" v-model="pendingSlot.kind" />
            面談
          </label>
          <label>
            <input type="radio" value="interview" v-model="pendingSlot.kind" />
            面接
          </label>
        </div>

        <div class="modal-actions">
          <button type="button" class="button-outline" @click="onCancelBooking">キャンセル</button>
          <button
            type="button"
            class="button-normal"
            :disabled="isSubmitting"
            @click="onConfirmBooking"
          >
            決定
          </button>
        </div>
      </div>
    </div>

    <Transition name="toast">
      <div v-if="toastMessage" class="toast">{{ toastMessage }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  color: #1a1a1a;
  background-color: #fff;
}

.sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid #ccc;
  overflow-y: auto;
  background-color: #f5f5f5;
}

.recruiter-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 16px;
  gap: 4px;
}

.recruiter-icon {
  width: 72px;
  height: 72px;
  padding: 16px;
  box-sizing: border-box;
  border-radius: 50%;
  background-color: #ddd;
  margin-bottom: 12px;
}

.recruiter-name {
  font-weight: bold;
  font-size: 16px;
}

.recruiter-bio {
  font-size: 13px;
  color: #555;
  line-height: 1.6;
  text-align: left;
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-header {
  padding: 12px 16px;
  border-bottom: 1px solid #ccc;
  font-weight: bold;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message {
  max-width: 60%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #ccc;
}

.message-other {
  align-self: flex-start;
  background-color: #f0f0f0;
}

.message-self {
  align-self: flex-end;
  background-color: #ddd;
}

.composer {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #ccc;
}

.composer-input {
  flex: 1;
  border: 1px solid #888;
  padding: 8px;
  resize: none;
}

.calendar-tab {
  position: fixed;
  top: 24px;
  right: 0;
  z-index: 20;
  writing-mode: vertical-rl;
  padding: 16px 8px;
  border: 1px solid #1a1a1a;
  border-right: none;
  border-radius: 6px 0 0 6px;
  background-color: #333;
  color: #fff;
  cursor: pointer;
  letter-spacing: 0.1em;
}

.calendar-tab.is-open {
  padding: 8px 4px;
  font-size: 11px;
  background-color: #1a1a1a;
}

.calendar-panel {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 640px;
  max-width: 90vw;
  overflow-y: auto;
  background-color: #fff;
  border-left: 1px solid #ccc;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.15);
  padding: 16px;
  z-index: 15;
  box-sizing: border-box;
}

.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: transform 0.25s ease;
}

.slide-panel-enter-from,
.slide-panel-leave-to {
  transform: translateX(100%);
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-weight: bold;
  margin-bottom: 12px;
}

.week-nav-button {
  font-size: 12px;
  padding: 4px 8px;
  border: 1px solid #999;
  background-color: #fff;
  color: #333;
  cursor: pointer;
  border-radius: 4px;
}

.week-range-label {
  min-width: 110px;
  text-align: center;
}

.week-table-wrap {
  overflow-x: auto;
}

.week-table {
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
  text-align: center;
}

.week-table th,
.week-table td {
  border: 1px solid #e0e0e0;
}

.week-table thead th {
  padding: 6px 4px;
  font-weight: normal;
  font-size: 12px;
  background-color: #f5f5f5;
}

.week-table thead th.is-today {
  background-color: #ddd;
  font-weight: bold;
}

/* 30分（:30）の行の区切りを控えめにする */
.week-table tbody tr.is-half td {
  border-top-style: dashed;
  border-top-color: #eee;
}

.hour-col {
  width: 56px;
  font-size: 12px;
  color: #666;
  padding: 4px;
  background-color: #f5f5f5;
  white-space: nowrap;
}

.is-half .hour-col {
  color: #aaa;
}

.slot-cell {
  height: 22px;
  cursor: default;
  font-size: 11px;
  color: #fff;
}

.slot-cell.is-bookable {
  cursor: pointer;
  background-color: #fff;
}

.slot-cell.is-bookable:hover {
  background-color: #eee;
}

.slot-cell.is-unavailable {
  background-color: #f0f0f0;
}

/* 予約済み（他者含む）の枠はオレンジで表示する */
.slot-cell.is-booked {
  background-color: #f5a623;
}

/* 自分の予約はさらに濃く表示する。仮予約=オレンジ、本予約=グリーン */
.slot-cell.is-mine {
  background-color: #b5701a;
}

.slot-cell.is-mine.is-confirmed {
  background-color: #3d7a3d;
}

.slot-cell.is-selected {
  background-color: #1a1a1a;
}

.calendar-note {
  margin-top: 12px;
  font-size: 12px;
  color: #888;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
}

.modal-box {
  background-color: #fff;
  padding: 24px;
  border-radius: 8px;
  width: 320px;
  box-sizing: border-box;
}

.modal-title {
  font-weight: bold;
  margin-bottom: 12px;
}

.modal-datetime {
  font-size: 15px;
  margin-bottom: 16px;
}

.modal-type-select {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  font-size: 14px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.button-outline {
  padding: 6px 14px;
  border: 1px solid #999;
  background-color: #fff;
  color: #333;
  cursor: pointer;
  border-radius: 4px;
}

.button-normal:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toast {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  max-width: 90vw;
  padding: 12px 20px;
  border-radius: 6px;
  background-color: #333;
  color: #fff;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-12px);
}
</style>
