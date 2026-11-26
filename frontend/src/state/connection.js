import { ref } from 'vue'

export const isOnline = ref(globalThis.navigator?.onLine !== false)
export const sessionCheckFailed = ref(false)
