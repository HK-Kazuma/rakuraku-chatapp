<script setup>
import { ref } from "vue"
import { useRouter } from "vue-router"
import socketManager from "../socketManager.js"
import { appStore } from "../store/appStore.js"
import appIcon from "../images/icon.jpeg"

// #region local variable
const router = useRouter()
const socket = socketManager.getInstance()
// #endregion

// #region reactive variable
const inputUserName = ref("")
const inputPassword = ref("")
const errorMessage = ref("")
// #endregion

// #region browser event handler
// サーバーでユーザー名・パスワードを認証し、初期データを受け取ってチャット画面へ遷移する
const onEnter = () => {
  if (inputUserName.value === "") {
    errorMessage.value = "ユーザー名を入力してください"
    return
  }

  socket.emit(
    "loginEvent",
    { name: inputUserName.value, password: inputPassword.value },
    (res) => {
      if (!res || !res.ok) {
        errorMessage.value =
          res && res.error === "INVALID_CREDENTIALS"
            ? "ユーザー名またはパスワードが違います"
            : "入力内容を確認してください"
        return
      }

      errorMessage.value = ""
      appStore.initFromLogin(res.data)
      router.push({ name: "chat" })
    }
  )
}
// #endregion
</script>

<template>
  <v-sheet class="login-page" color="background">
    <v-container class="fill-height" fluid>
      <v-row justify="center" align="center" class="fill-height">
        <v-col cols="12" sm="8" md="5" lg="4">
          <v-card class="login-card pa-8" elevation="0" rounded="lg">
            <div class="text-center mb-8">
              <v-img :src="appIcon" width="88" height="88" class="login-icon mx-auto mb-4" rounded="lg" />
              <h1 class="text-h5 font-weight-medium login-title">楽楽新卒Chat</h1>
              <div class="login-divider mx-auto mt-4"></div>
            </div>

            <v-text-field
              v-model="inputUserName"
              label="username"
              variant="underlined"
              color="secondary"
              class="mb-5"
              hide-details
            />

            <v-text-field
              v-model="inputPassword"
              label="password"
              type="password"
              variant="underlined"
              color="secondary"
              class="mb-6"
              hide-details
            />

            <v-alert
              v-if="errorMessage"
              density="compact"
              variant="outlined"
              color="secondary"
              class="mb-5 login-alert"
            >
              {{ errorMessage }}
            </v-alert>

            <v-btn
              block
              size="large"
              color="primary"
              class="login-btn"
              elevation="0"
              @click="onEnter"
            >
              ログインする
            </v-btn>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </v-sheet>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
}

.login-card {
  background-color: rgb(var(--v-theme-surface));
  border: 1px solid #e0e0e0;
}

.login-title {
  letter-spacing: 0.08em;
  color: #212121;
}

.login-divider {
  width: 40px;
  height: 2px;
  background-color: #212121;
}

.login-btn {
  letter-spacing: 0.15em;
}

.login-alert {
  color: #424242;
}
</style>
