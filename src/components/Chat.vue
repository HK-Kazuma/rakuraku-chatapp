<script setup>
import { ref, reactive, computed, watch } from "vue"
import userIcon from "../images/user-solid.svg"
import { SLOTS, getWeekDates, slotStartAt, slotRangeLabel } from "../utils/weekCalendar"
import socketManager from "../socketManager.js"
import { appStore } from "../store/appStore.js"

// #region server state
const socket = socketManager.getInstance()

// 選考ステータス（バックエンドは document / first の2値）
const STATUS_LABEL = { document: "書類選考", first: "一次選考" }
const statusList = Object.keys(STATUS_LABEL)
const statusLabel = (status) => STATUS_LABEL[status] ?? status
const statusClass = (status) => `status-${status}`

// 一斉送信の全選択チェックON時に入力欄へ差し込む下書きテンプレート
// 選考段階を絞り込んでいる場合はその段階向けのお礼、「すべて」の場合はリマインドの文言にする
// {name} は送信先ごとの候補者名に置き換わるプレースホルダー（展開はサーバー側で行う）
const THANKS_TEMPLATE = {
  document: "{name}さん、書類選考にご応募いただき、ありがとうございました。",
  first: "{name}さん、本日は一次選考にお時間をいただき、ありがとうございました。",
}
const REMINDER_TEMPLATE =
  "{name}さん、まだご返信いただいていない内容がございましたら、お手数ですがご確認のうえご返信いただけますと幸いです。"
const checkboxTemplate = (status) => THANKS_TEMPLATE[status] ?? REMINDER_TEMPLATE

// 予約種別（バックエンドは interview / meeting）
const KIND_LABEL = { interview: "面接", meeting: "面談" }
const kindLabel = (kind) => KIND_LABEL[kind] ?? kind

// 予約ステータス（バックエンドは tentative / confirmed）
const RESERVATION_STATUS_LABEL = { tentative: "仮予約", confirmed: "本予約" }
const reservationStatusLabel = (status) => RESERVATION_STATUS_LABEL[status] ?? status
const reservationStatusChar = (status) => (status === "confirmed" ? "本" : "仮")

// 学生一覧をサーバのユーザー・ルームから組み立てる
const students = computed(() =>
  appStore.users
    .filter((u) => u.profile.role === "student")
    .map((u) => {
      const room = appStore.roomWith(u.id)
      return {
        id: u.id,
        roomId: room?.id ?? null,
        name: u.profile.displayName,
        status: u.profile.status,
        bio: u.profile.bio ?? "",
      }
    })
)
// #endregion

// #region reactive variable
const selectedStudentId = ref(null)
const chatContent = ref("")
const statusFilter = ref("all")
const isCalendarOpen = ref(false)
const checkedStudentIds = reactive(new Set())
// #endregion

// 絞り込みの選考段階を変更したら、チェック内容が絞り込み結果と食い違わないようすべて解除する
watch(statusFilter, () => {
  checkedStudentIds.clear()
})

// #region computed
const selectedStudent = computed(
  () =>
    students.value.find((s) => s.id === selectedStudentId.value) ??
    students.value[0] ??
    null
)

const selectedMessages = computed(() =>
  selectedStudent.value?.roomId
    ? appStore.messagesOf(selectedStudent.value.roomId)
    : []
)

// メッセージ本文中の {name} プレースホルダーを、表示するチャット相手の名前に展開する
const displayMessageText = (text) =>
  selectedStudent.value ? text.replaceAll("{name}", selectedStudent.value.name) : text

const filteredStudents = computed(() =>
  statusFilter.value === "all"
    ? students.value
    : students.value.filter((s) => s.status === statusFilter.value)
)

// チェック済みの人数。1人以上チェックされたら一斉送信モード
const checkedCount = computed(() => checkedStudentIds.size)
const isBroadcastMode = computed(() => checkedCount.value >= 1)
const checkedStudents = computed(() =>
  students.value.filter((s) => checkedStudentIds.has(s.id))
)

// 絞り込み結果全員がチェック済みかどうか。チェック時は絞り込み結果を一括ON/OFFする
const isSelectAllFilteredChecked = computed({
  get: () =>
    filteredStudents.value.length > 0 &&
    filteredStudents.value.every((s) => checkedStudentIds.has(s.id)),
  set: (checked) => {
    filteredStudents.value.forEach((s) => {
      if (checked) {
        checkedStudentIds.add(s.id)
      } else {
        checkedStudentIds.delete(s.id)
      }
    })
    chatContent.value = checked ? checkboxTemplate(statusFilter.value) : ""
  },
})
// #endregion

// #region calendar state
const weekOffset = ref(0)
const selectedBooking = ref(null) // クリックした予約枠の詳細（ポップアップ表示用）
const isApproving = ref(false)
// #endregion

// #region calendar computed
const weekDates = computed(() => getWeekDates(weekOffset.value))
const weekRangeLabel = computed(() => {
  const dates = weekDates.value
  return `${dates[0].month}/${dates[0].day} 〜 ${dates[6].month}/${dates[6].day}`
})
// #endregion

// #region browser event handler
// 学生を選択する（一斉送信モード中はカードのクリックでチェックを切り替える）
const onSelectStudent = (id) => {
  if (isBroadcastMode.value) {
    onToggleStudentChecked(id)
    return
  }
  selectedStudentId.value = id
  chatContent.value = ""
}

// 学生個別のチェックボックスを切り替える
const onToggleStudentChecked = (id) => {
  if (checkedStudentIds.has(id)) {
    checkedStudentIds.delete(id)
  } else {
    checkedStudentIds.add(id)
  }
}

// チェックをすべて解除する（一斉送信モードを終了する）
const onClearChecked = () => {
  checkedStudentIds.clear()
}

// カレンダーパネルの開閉を切り替える
const onToggleCalendar = () => {
  isCalendarOpen.value = !isCalendarOpen.value
}

// 週を移動する
const onChangeWeek = (diff) => {
  weekOffset.value += diff
}

// カレンダーの枠をクリックし、予約があれば誰との面談・面接かを表示する
// 予約の内容は採用担当にのみ配信される（reservation:created / ログイン時の初期データ）
const onSelectSlot = (dateInfo, slot) => {
  const startAt = slotStartAt(dateInfo, slot)
  const reservation = appStore.reservationAt(startAt)
  if (!reservation) return
  selectedBooking.value = { reservation, dateInfo, startAt }
}

// 予約者の表示名
const bookedStudentName = (reservation) =>
  appStore.userById(reservation.studentId)?.profile.displayName ?? "（不明な学生）"

// カレンダーセルに表示する予約状態のクラス・文字（仮予約=仮、本予約=本）
const slotCellClass = (dateInfo, slot) => {
  const reservation = appStore.reservationAt(slotStartAt(dateInfo, slot))
  if (!reservation) return {}
  return {
    "has-booking": true,
    "is-tentative": reservation.status === "tentative",
    "is-confirmed": reservation.status === "confirmed",
  }
}
const slotCellChar = (dateInfo, slot) => {
  const reservation = appStore.reservationAt(slotStartAt(dateInfo, slot))
  return reservation ? reservationStatusChar(reservation.status) : ""
}

// 予約詳細ポップアップを閉じる
const onCloseBookingDetail = () => {
  selectedBooking.value = null
}

// 仮予約を承認して本予約にする。成功時はローカルの予約状態を更新し、
// チャット欄に承認した旨の文面を入れる（変更の可能性があるため送信はしない）
const onApproveReservation = () => {
  if (!selectedBooking.value || isApproving.value) return
  const { reservation, dateInfo, startAt } = selectedBooking.value

  isApproving.value = true
  socket.emit(
    "reservation:approve",
    { reservationId: reservation.id },
    (res) => {
      isApproving.value = false
      if (!res || !res.ok) return

      appStore.updateReservationStatus(reservation.id, res.data.reservation.status)
      selectedStudentId.value = reservation.studentId
      chatContent.value = `${bookedStudentName(reservation)}さん、${dateInfo.month}月${dateInfo.day}日(${dateInfo.weekday}) ${slotRangeLabel(startAt)}の${kindLabel(reservation.kind)}を承認しました。`
      selectedBooking.value = null
    }
  )
}

// メッセージを送信する
// 1人以上チェックされている場合は、チェックされた全員へ一斉送信する
const onPublish = () => {
  const text = chatContent.value.trim()
  if (!text) return

  if (isBroadcastMode.value) {
    const userIds = checkedStudents.value.map((s) => s.id)
    socket.emit("chat:broadcast", { userIds, text }, (res) => {
      if (!res || !res.ok) return
      onClearChecked()
      chatContent.value = ""
    })
    return
  }

  if (!selectedStudent.value?.roomId) return
  socket.emit(
    "chat:send",
    { roomId: selectedStudent.value.roomId, text },
    (res) => {
      if (!res || !res.ok) return
      chatContent.value = ""
    }
  )
}
// #endregion
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header">学生一覧（{{ filteredStudents.length }}）</div>

      <div class="filter-bar">
        <input
          type="checkbox"
          class="select-all-checkbox"
          v-model="isSelectAllFilteredChecked"
        />
        <select class="filter-select" v-model="statusFilter">
          <option value="all">すべて</option>
          <option v-for="status in statusList" :key="status" :value="status">
            {{ statusLabel(status) }}
          </option>
        </select>
      </div>

      <ul class="student-list">
        <li
          v-for="student in filteredStudents"
          :key="student.id"
          class="student-item"
          :class="{ 'is-selected': !isBroadcastMode && student.id === selectedStudent?.id }"
          @click="onSelectStudent(student.id)"
        >
          <input
            type="checkbox"
            class="student-checkbox"
            :checked="checkedStudentIds.has(student.id)"
            @click.stop="onToggleStudentChecked(student.id)"
          />
          <span class="student-name">{{ student.name }}</span>
          <span class="status-tag" :class="statusClass(student.status)">{{ statusLabel(student.status) }}</span>
        </li>
      </ul>
    </aside>

    <main class="chat-area">
      <div class="chat-header">
        <span>{{
          isBroadcastMode
            ? (checkedCount === 1 ? `${checkedStudents[0].name}に送信` : `${checkedCount}人に一斉送信`)
            : `${selectedStudent?.name}さんとのチャット`
        }}</span>
        <button
          v-if="isBroadcastMode"
          type="button"
          class="button-outline"
          @click="onClearChecked"
        >
          解除
        </button>
      </div>

      <div v-if="!isBroadcastMode" class="message-list">
        <div
          v-for="msg in selectedMessages"
          :key="msg.id"
          class="message"
          :class="msg.userId === appStore.me?.id ? 'message-recruiter' : 'message-student'"
        >
          {{ displayMessageText(msg.text) }}
        </div>
      </div>

      <div class="composer" :class="{ 'is-broadcast': isBroadcastMode }">
        <textarea
          v-model="chatContent"
          placeholder="メッセージを入力してください"
          rows="6"
          class="composer-input"
        ></textarea>
        <p v-if="isBroadcastMode" class="composer-hint">
          {name} と入力すると、送信先ごとの候補者名に置き換わります。
        </p>
        <button
          type="button"
          class="button-normal"
          :class="{ 'is-broadcast': isBroadcastMode }"
          @click="onPublish"
        >
          送信
        </button>
      </div>
    </main>

    <aside class="personal-panel">
      <div class="personal-header">パーソナライズ情報</div>

      <div class="personal-body" v-if="selectedStudent">
        <div class="detail-head">
          <img :src="userIcon" alt="学生アイコン" class="detail-icon" />
          <div class="detail-name">{{ selectedStudent.name }}</div>
          <span class="status-tag" :class="statusClass(selectedStudent.status)">{{ statusLabel(selectedStudent.status) }}</span>
        </div>

        <dl class="detail-list">
          <dt>プロフィール</dt>
          <dd class="detail-bio">{{ selectedStudent.bio || "登録されていません" }}</dd>
        </dl>
      </div>
    </aside>

    <button
      type="button"
      class="calendar-tab"
      :class="{ 'is-open': isCalendarOpen }"
      @click="onToggleCalendar"
    >
      カレンダー
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
                  :class="slotCellClass(dateInfo, slot)"
                  @click="onSelectSlot(dateInfo, slot)"
                >{{ slotCellChar(dateInfo, slot) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="calendar-note">色のついた枠をクリックすると、予約者の詳細が表示されます。</p>
      </aside>
    </Transition>

    <div v-if="selectedBooking" class="modal-backdrop" @click.self="onCloseBookingDetail">
      <div class="modal-box">
        <div class="modal-title">予約の詳細</div>
        <div class="modal-datetime">
          {{ selectedBooking.dateInfo.month }}月{{ selectedBooking.dateInfo.day }}日({{ selectedBooking.dateInfo.weekday }})
          {{ slotRangeLabel(selectedBooking.startAt) }}
        </div>
        <div class="modal-booking-info">
          <span class="modal-booking-name">{{ bookedStudentName(selectedBooking.reservation) }}</span>
          さんとの{{ kindLabel(selectedBooking.reservation.kind) }}
          <span
            class="status-tag reservation-status-tag"
            :class="`reservation-status-${selectedBooking.reservation.status}`"
          >{{ reservationStatusLabel(selectedBooking.reservation.status) }}</span>
        </div>

        <div class="modal-actions">
          <button
            v-if="selectedBooking.reservation.status === 'tentative'"
            type="button"
            class="button-normal"
            :disabled="isApproving"
            @click="onApproveReservation"
          >
            承認する
          </button>
          <button type="button" class="button-outline" @click="onCloseBookingDetail">閉じる</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  /* body の padding: 2em ぶんを差し引き、画面全体はスクロールさせない */
  height: calc(100vh - 4em);
  /* パーソナライズ画面を画面の右端まで寄せる（body の右 padding を打ち消す） */
  margin-right: -2em;
  overflow: hidden;
  color: #1a1a1a;
  background-color: #fff;
}

.sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid #ccc;
  height: 100%;
  overflow-y: auto;
  background-color: #f5f5f5;
}

.sidebar-header {
  padding: 12px 16px;
  font-weight: bold;
  border-bottom: 1px solid #ccc;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #ccc;
}

.select-all-checkbox {
  flex-shrink: 0;
  cursor: pointer;
}

.filter-select {
  flex: 1;
  font-size: 13px;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #999;
  background-color: #fff;
  color: #333;
  cursor: pointer;
}

.student-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.student-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid #e0e0e0;
}

.student-item:hover {
  background-color: #eaeaea;
}

.student-item.is-selected {
  background-color: #ddd;
  font-weight: bold;
}

.student-checkbox {
  flex-shrink: 0;
  cursor: pointer;
}

.student-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* パーソナライズ情報パネル（右側） */
.personal-panel {
  width: 300px;
  flex-shrink: 0;
  border-left: 1px solid #ccc;
  background-color: #f5f5f5;
  height: 100%;
  overflow-y: auto;
}

.personal-header {
  position: sticky;
  top: 0;
  padding: 12px 16px;
  font-weight: bold;
  border-bottom: 1px solid #ccc;
  background-color: #f5f5f5;
}

.personal-body {
  padding: 16px;
}

.detail-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  padding: 16px 0;
  border-bottom: 1px solid #ddd;
}

.detail-icon {
  width: 72px;
  height: 72px;
  padding: 16px;
  box-sizing: border-box;
  border-radius: 50%;
  background-color: #ddd;
}

.detail-name {
  font-weight: bold;
  font-size: 16px;
}

.detail-list {
  margin: 16px 0 0;
  font-size: 13px;
}

.detail-list dt {
  font-weight: bold;
  color: #555;
  margin-top: 12px;
}

.detail-list dd {
  margin: 4px 0 0;
  line-height: 1.5;
}

.detail-bio {
  white-space: pre-wrap;
  line-height: 1.7;
}

.status-tag {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
}

/* 選考の進み具合をグレーの濃淡で表現（薄い＝書類選考 → 濃い＝一次選考） */
.status-document {
  background-color: #eee;
  color: #333;
  border-color: #ccc;
}

.status-first {
  background-color: #888;
  color: #fff;
  border-color: #777;
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #ccc;
  font-weight: bold;
}

.button-outline {
  flex-shrink: 0;
  font-weight: normal;
  font-size: 14px;
  padding: 8px 18px;
  border: 1px solid #999;
  border-radius: 4px;
  background-color: #fff;
  color: #333;
  cursor: pointer;
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

.message-student {
  align-self: flex-start;
  background-color: #f0f0f0;
}

.message-recruiter {
  align-self: flex-end;
  background-color: #ddd;
}

.composer {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #ccc;
}

.composer.is-broadcast {
  flex-direction: column;
}

.composer-input {
  flex: 1;
  border: 1px solid #888;
  padding: 8px;
  resize: none;
}

.composer-hint {
  margin: 0;
  font-size: 12px;
  color: #888;
}

.button-normal.is-broadcast {
  width: 100%;
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
  font-size: 11px;
  color: #fff;
}

/* 予約済み（面談・面接）の枠。仮予約=オレンジ、本予約=グリーンで表示する */
.slot-cell.has-booking {
  cursor: pointer;
}

.slot-cell.is-tentative {
  background-color: #f5a623;
}

.slot-cell.is-tentative:hover {
  background-color: #e0951a;
}

.slot-cell.is-confirmed {
  background-color: #4a8f4a;
}

.slot-cell.is-confirmed:hover {
  background-color: #3d7a3d;
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
  margin-bottom: 8px;
}

.modal-booking-info {
  font-size: 14px;
  margin-bottom: 20px;
}

.modal-booking-name {
  font-weight: bold;
}

.reservation-status-tag {
  margin-left: 6px;
}

.reservation-status-tentative {
  background-color: #fdf0dc;
  color: #a15c00;
  border-color: #f5a623;
}

.reservation-status-confirmed {
  background-color: #e6f3e6;
  color: #2d6b2d;
  border-color: #4a8f4a;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.modal-actions .button-normal:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
