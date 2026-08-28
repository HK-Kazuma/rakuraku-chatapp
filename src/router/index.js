import { createRouter, createWebHistory } from "vue-router"
import ChatView from "../components/ChatView.vue"
import Login from "../components/Login.vue"
import { appStore } from "../store/appStore.js"

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "login",
      component: Login,
    },
    {
      path: "/chat/",
      name: "chat",
      component: ChatView,
      // 未ログイン（リロード等でストアが空）ならログイン画面へ戻す
      beforeEnter: (to, from, next) => {
        if (appStore.me) {
          next()
        } else {
          next({ name: "login" })
        }
      },
    },
  ],
})

export default router
