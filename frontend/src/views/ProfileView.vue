<script setup>
import { onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import ProfileSettings from '../components/ProfileSettings.vue'
import { auth, signOut } from '../state/auth.js'
import { createProfileState } from '../state/profile.js'

const router = useRouter()
const profile = createProfileState({
  user: auth.user,
  getToken: () => auth.token,
  onProfileUpdated: user => { auth.user = user },
  onUnauthorized: () => {
    signOut()
    auth.notice = 'Сессия истекла. Войдите снова, чтобы открыть профиль.'
    return router.replace({ name: 'login' })
  },
})
onBeforeUnmount(profile.dispose)

function logout() {
  signOut()
  auth.notice = ''
  return router.replace({ name: 'login' })
}
</script>

<template>
  <ProfileSettings v-if="auth.user" :user="auth.user" :form="profile.state" @change="Object.assign(profile.state, $event)" @save="profile.save" @back="router.push({ name: 'dashboard' })" @logout="logout" />
</template>
