import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { isOnline } from './state/connection.js'
import './style.css'

function updateConnection() {
  isOnline.value = navigator.onLine
}

window.addEventListener('online', updateConnection)
window.addEventListener('offline', updateConnection)

createApp(App).use(router).mount('#app')

if (import.meta.env.PROD && window.isSecureContext && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')
      .catch(error => console.warn('Не удалось подготовить приложение к работе без сети.', error))
  })
}
