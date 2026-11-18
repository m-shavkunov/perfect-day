<script setup>
import { onBeforeUnmount, onMounted, ref, useId } from 'vue'

defineProps({ title: { type: String, required: true }, busy: Boolean })
const emit = defineEmits(['close'])
const dialog = ref(null)
const titleId = useId()
onMounted(() => dialog.value.showModal())
onBeforeUnmount(() => dialog.value?.close())
</script>

<template>
  <dialog ref="dialog" class="app-dialog" :aria-labelledby="titleId" :aria-busy="busy" @cancel.prevent="!busy && emit('close')">
    <header>
      <h2 :id="titleId">{{ title }}</h2>
      <button type="button" :disabled="busy" aria-label="Закрыть окно" @click="emit('close')">×</button>
    </header>
    <slot />
  </dialog>
</template>

<style scoped>
.app-dialog { width: min(680px, calc(100vw - 32px)); max-height: calc(100svh - 32px); margin: auto; padding: 24px; border: 1px solid rgb(255 255 255 / 60%); background: #4e624a; color: #fff; font: 20px/1.4 'Times New Roman', serif; overflow: auto; overscroll-behavior: contain; }
.app-dialog::backdrop { background: rgb(12 23 12 / 75%); }
header { display: flex; align-items: start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
h2 { margin: 0; font-size: 28px; font-weight: 400; overflow-wrap: anywhere; }
button { flex: none; width: 44px; height: 44px; border: 0; background: #40523d; color: #fff; font: 28px/1 'Times New Roman', serif; cursor: pointer; }
button:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
button:disabled { opacity: .65; cursor: wait; }
@media (max-width: 600px) { .app-dialog { padding: 16px; } h2 { font-size: 24px; } }
</style>
