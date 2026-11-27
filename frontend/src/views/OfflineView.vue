<script setup>
import { ref } from 'vue'
import { isNavigationFailure, useRoute, useRouter } from 'vue-router'
import { isOnline } from '../state/connection.js'

const route = useRoute()
const router = useRouter()
const retrying = ref(false)
const retryFailed = ref(false)

async function reconnect() {
  if (!isOnline.value || retrying.value) return
  retrying.value = true
  retryFailed.value = false
  const path = route.query.returnTo
  const target = typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
    && (path === '/' || router.resolve(path).meta.requiresAuth) ? path : { name: 'dashboard' }

  try {
    retryFailed.value = isNavigationFailure(await router.replace(target))
  } finally {
    retrying.value = false
  }
}
</script>

<template>
  <section class="offline-page" aria-labelledby="offline-title">
    <div class="offline-panel glass-panel">
      <h1 id="offline-title">Подключитесь к сети</h1>
      <p>Для входа и загрузки данных нужна связь с сервером.</p>
      <button type="button" :disabled="!isOnline || retrying" @click="reconnect">
        {{ retrying ? 'Подключаемся…' : 'Повторить подключение' }}
      </button>
      <p v-if="retryFailed && isOnline" role="status">Сервер пока недоступен. Попробуйте ещё раз.</p>
    </div>
  </section>
</template>

<style scoped>
.offline-page { display: grid; place-items: center; min-height: 100svh; padding: 16px; color: #fff; font: 20px/1.4 'Times New Roman', serif; }
.offline-panel { width: min(100%, 560px); padding: clamp(20px, 5vw, 40px); }
.offline-panel h1 { font-size: clamp(28px, 5vw, 42px); font-weight: 400; }
.offline-panel button { min-height: 44px; padding: 8px 16px; border: 0; background: #4e624a; color: inherit; font: inherit; cursor: pointer; }
.offline-panel button:disabled { opacity: 0.65; cursor: not-allowed; }
.offline-panel button:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
</style>
