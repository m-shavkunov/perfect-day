<script setup>
import { RouterView, useRoute } from 'vue-router'
import { isOnline, sessionCheckFailed } from './state/connection.js'

const route = useRoute()
</script>

<template>
  <p v-if="!isOnline && route.name && route.name !== 'offline'" class="connection-notice" role="status">
    Нет подключения. Загруженные данные могут быть неактуальны.
  </p>
  <p v-else-if="sessionCheckFailed" class="connection-notice" role="status">
    Нет связи с сервером. Загруженные данные могут быть неактуальны. Повторите переход, когда связь восстановится.
  </p>
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
  margin: 0;
  padding: 8px 16px;
  background: #e4d8a3;
  color: #283f28;
  font-size: 15px;
  text-align: center;
}
</style>
