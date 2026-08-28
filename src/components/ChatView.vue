<script setup>
import Chat from "./Chat.vue"
import StudentChat from "./StudentChat.vue"
import { appStore } from "../store/appStore.js"
</script>

<template>
  <StudentChat v-if="appStore.isStudent" />
  <Chat v-else />
</template>
