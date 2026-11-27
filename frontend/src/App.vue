<script setup>
import { computed, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppNotice from './components/AppNotice.vue'
import { isOnline, sessionCheckFailed } from './state/connection.js'

const route = useRoute()
const connectionDismissed = ref(false)
const connectionNotice = computed(() => {
  if (!isOnline.value && route.name && route.name !== 'offline') return 'Нет подключения. Загруженные данные могут быть неактуальны.'
  if (sessionCheckFailed.value) return 'Нет связи с сервером. Повторите переход, когда связь восстановится.'
  return ''
})
watch(connectionNotice, () => { connectionDismissed.value = false })
</script>

<template>
  <AppNotice v-if="connectionNotice && !connectionDismissed" class="connection-notice" kind="error" @dismiss="connectionDismissed = true">
    {{ connectionNotice }}
  </AppNotice>
  <div :class="route.meta.layout === 'auth' ? 'auth-shell' : 'app-shell'">
    <main :class="route.meta.layout === 'auth' ? 'auth-content' : 'page-content'">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.connection-notice {
  position: sticky;
  top: 0;
  z-index: 5;
  width: min(450px, calc(100% - 24px));
  margin-inline: auto 12px;
}
</style>
