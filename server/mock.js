import { ROLE, SELECTION_STATUS } from "./constants.js"
import store from "./store.js"

/**
 * オンメモリストアへ投入する初期データ
 * ID は固定文字列にしてデバッグしやすくする（実行時に生成する ID は UUID）
 * 予約可能枠は事前定義しないため、予約は0件から始まる
 */

const RECRUITER = {
  id: "recruiter-01",
  password: "recruiter123",
  profile: {
    name: "recruiter01",
    displayName: "佐藤 健一",
    role: ROLE.RECRUITER,
    iconUrl: "/images/user-solid.svg",
    bio: "人事部 採用担当。エンジニア採用を担当しています。",
  },
}

const STUDENTS = [
  {
    id: "student-01",
    password: "student123",
    profile: {
      name: "student01",
      displayName: "田中 太郎",
      status: SELECTION_STATUS.DOCUMENT,
      bio: "東京大学 工学部 情報工学科 学部4年。強化学習を研究しています。趣味は競技プログラミング。",
    },
  },
  {
    id: "student-02",
    password: "student123",
    profile: {
      name: "student02",
      displayName: "鈴木 花子",
      status: SELECTION_STATUS.DOCUMENT,
      bio: "京都大学 理学部 数学科 修士1年。数理最適化が専門です。趣味は登山。",
    },
  },
  {
    id: "student-03",
    password: "student123",
    profile: {
      name: "student03",
      displayName: "高橋 美咲",
      status: SELECTION_STATUS.DOCUMENT,
      bio: "大阪大学 情報学部 知能システム学科 学部3年。自然言語処理に興味があります。",
    },
  },
  {
    id: "student-04",
    password: "student123",
    profile: {
      name: "student04",
      displayName: "伊藤 健太",
      status: SELECTION_STATUS.FIRST,
      bio: "東北大学 工学部 電気電子工学科 修士2年。分散システムの耐障害性を研究。Kaggle Expert。",
    },
  },
  {
    id: "student-05",
    password: "student123",
    profile: {
      name: "student05",
      displayName: "渡辺 陽菜",
      status: SELECTION_STATUS.FIRST,
      bio: "名古屋大学 経済学部 学部4年。データ分析基盤の構築を独学。TOEIC 890。",
    },
  },
  {
    id: "student-06",
    password: "student123",
    profile: {
      name: "student06",
      displayName: "山本 大輝",
      status: SELECTION_STATUS.FIRST,
      bio: "九州大学 理工学部 修士1年。画像認識モデルの精度向上がテーマ。趣味は写真撮影。",
    },
  },
  {
    id: "student-07",
    password: "student123",
    profile: {
      name: "student07",
      displayName: "中村 結衣",
      status: SELECTION_STATUS.FIRST,
      bio: "早稲田大学 基幹理工学部 学部4年。OSS コントリビュート経験あり。趣味はマラソン。",
    },
  },
]

// ルームごとの初期メッセージ（送信者は "student" または "recruiter" で指定する）
const SEED_CONVERSATIONS = {
  "student-01": [
    ["student", "田中太郎です。この度は書類選考の機会をいただきありがとうございます。"],
    ["recruiter", "ご応募ありがとうございます。ぜひ一度お話しさせてください。"],
    ["student", "ぜひお願いいたします。日程を調整させていただきます。"],
  ],
  "student-02": [
    ["recruiter", "鈴木さん、書類を拝見しました。数理最適化のご研究に興味があります。"],
    ["student", "ありがとうございます。詳しくお話しできればと思います。"],
  ],
  "student-03": [
    ["student", "高橋美咲と申します。よろしくお願いいたします。"],
    ["recruiter", "こちらこそよろしくお願いします。まずはカジュアルにお話ししましょう。"],
  ],
  "student-04": [
    ["recruiter", "伊藤さん、一次選考の通過おめでとうございます。"],
    ["student", "ありがとうございます。次の面接もよろしくお願いいたします。"],
    ["recruiter", "面接の候補日をカレンダーからご予約ください。"],
  ],
  "student-05": [
    ["student", "渡辺です。一次選考の結果を確認しました。ありがとうございます。"],
    ["recruiter", "引き続きよろしくお願いします。ご不明点があればいつでもどうぞ。"],
  ],
  "student-06": [
    ["recruiter", "山本さん、研究内容についてもう少し伺いたいです。"],
    ["student", "承知しました。面談の場で詳しくご説明いたします。"],
  ],
  "student-07": [
    ["student", "中村結衣です。OSS 活動について話せる機会があれば嬉しいです。"],
    ["recruiter", "ぜひお聞かせください。面接の日程をご調整ください。"],
    ["student", "ありがとうございます。カレンダーから予約いたします。"],
  ],
}

/** オンメモリストアへモックデータを投入する */
export const seed = () => {
  store.clear()

  const recruiter = store.addUser(RECRUITER)

  // 会話の時刻がすべて同一にならないよう、少しずつ過去にずらして並べる
  const baseTime = Date.now() - 60 * 60 * 1000
  let offset = 0

  STUDENTS.forEach((student) => {
    store.addUser({
      ...student,
      profile: {
        ...student.profile,
        role: ROLE.STUDENT,
        iconUrl: "/images/user-solid.svg",
      },
    })

    const room = store.addRoom({
      id: `room-${student.id}`,
      userIds: [student.id, recruiter.id],
      createdAt: baseTime,
    })

    SEED_CONVERSATIONS[student.id].forEach(([sender, text], i) => {
      offset += 1
      store.addMessage({
        id: `message-${student.id}-${String(i + 1).padStart(2, "0")}`,
        roomId: room.id,
        userId: sender === "recruiter" ? recruiter.id : student.id,
        text,
        createdAt: baseTime + offset * 60 * 1000,
      })
    })
  })
}
