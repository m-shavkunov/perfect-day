<script setup>
import successIcon from '../assets/notice-success.svg'
import reminderIcon from '../assets/notice-reminder.svg'
import errorIcon from '../assets/notice-error.svg'

defineProps({ kind: { type: String, required: true }, dismissible: { type: Boolean, default: true } })
defineEmits(['dismiss'])

const icons = { success: successIcon, reminder: reminderIcon, error: errorIcon }
</script>

<template>
  <div class="app-notice" :class="{ 'app-notice--dismissible': dismissible }">
    <img :src="icons[kind]" alt="" width="55" height="55" />
    <div class="app-notice__message" :role="kind === 'error' ? 'alert' : 'status'">
      <slot />
    </div>
    <button v-if="dismissible" type="button" aria-label="Закрыть уведомление" @click="$emit('dismiss')">×</button>
  </div>
</template>

<style scoped>
.app-notice {
  position: relative;
  display: grid;
  grid-template-columns: 55px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  min-width: 0;
  min-height: 80px;
  margin-block-end: 12px;
  padding: 12px;
  border: 1px solid rgb(255 255 255 / 38%);
  border-radius: 12px;
  background: rgb(20 37 26 / 94%);
  color: #fff;
  font: 22px/1.25 'Times New Roman', serif;
}
.app-notice--dismissible { padding-inline-end: 46px; }
.app-notice img { display: block; }
.app-notice__message { overflow-wrap: anywhere; }
.app-notice__message :deep(p) { margin: 4px 0 0; font-size: 17px; }
button {
  position: absolute;
  inset: 0 0 auto auto;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: inherit;
  font: 28px/1 Arial, sans-serif;
  cursor: pointer;
}
button:hover { background: rgb(255 255 255 / 12%); }
button:focus-visible { outline: 2px solid #fff; outline-offset: -3px; }
</style>
