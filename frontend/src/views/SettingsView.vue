<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AppNavigation from '../components/AppNavigation.vue'
import { auth, signOut } from '../state/auth.js'
import { isOnline } from '../state/connection.js'
import { createSettingsState } from '../state/settings.js'
import { maxWorkSettingMinutes } from '../utils/workSettings.js'

const router = useRouter()
const formElement = ref(null)
const { state, load, save, clearFeedback, dispose } = createSettingsState({
  userId: auth.user.id,
  getToken: () => auth.token,
  onUnauthorized: () => {
    signOut()
    auth.notice = 'Сессия истекла. Войдите снова, чтобы открыть настройки рабочего дня.'
    return router.replace({ name: 'login' })
  },
})

const groups = [
  { title: 'Рабочий день', type: 'time', fields: [
    { name: 'work_start', label: 'Начало рабочего дня' },
    { name: 'work_end', label: 'Конец рабочего дня' },
  ] },
  { title: 'Обед', type: 'time', fields: [
    { name: 'lunch_start', label: 'Начало обеда' },
    { name: 'lunch_end', label: 'Конец обеда' },
  ] },
  { title: 'Перерывы', type: 'number', fields: [
    { name: 'break_duration_min', label: 'Длительность перерыва, мин' },
    { name: 'work_before_break_min', label: 'Время работы до перерыва, мин' },
  ] },
]

onMounted(load)
onBeforeUnmount(dispose)

async function submit() {
  await save()
  if (Object.keys(state.fieldErrors).length) {
    await nextTick()
    formElement.value?.querySelector('[aria-invalid="true"]')?.focus()
  }
}
</script>

<template>
  <section class="settings-page" aria-labelledby="work-settings-title">
    <div class="settings-layout">
      <AppNavigation class="settings-navigation" />
      <div class="settings-panel glass-panel">
        <header class="settings-header">
          <h1 id="work-settings-title">Настройки рабочего дня</h1>
          <RouterLink :to="{ name: 'profile' }">К профилю</RouterLink>
        </header>
        <p class="settings-description">Планировщик использует эти параметры при генерации расписания.</p>

        <p v-if="state.status === 'loading'" role="status">Загружаем настройки…</p>
        <div v-else-if="state.status === 'error'">
          <p class="settings-error" role="alert">{{ state.loadError }}</p>
          <button type="button" @click="load">Повторить загрузку</button>
        </div>
        <form v-else ref="formElement" class="settings-form" novalidate :aria-busy="state.saving" @submit.prevent="submit" @input="clearFeedback">
          <fieldset v-for="group in groups" :key="group.title" :disabled="state.saving">
            <legend>{{ group.title }}</legend>
            <div class="settings-fields">
              <div v-for="field in group.fields" :key="field.name" class="settings-field">
                <label :for="field.name">{{ field.label }}</label>
                <input
                  :id="field.name" v-model="state.form[field.name]" :name="field.name" :type="group.type" required
                  :step="group.type === 'time' ? 60 : 1"
                  :min="group.type === 'number' ? 1 : undefined"
                  :max="group.type === 'number' ? maxWorkSettingMinutes : undefined"
                  :aria-invalid="state.fieldErrors[field.name] ? 'true' : undefined"
                  :aria-describedby="state.fieldErrors[field.name] ? field.name + '-error' : undefined"
                />
                <p v-if="state.fieldErrors[field.name]" :id="field.name + '-error'" class="settings-error">{{ state.fieldErrors[field.name] }}</p>
              </div>
            </div>
          </fieldset>
          <div class="settings-actions">
            <button type="submit" :disabled="!isOnline || state.saving">{{ state.saving ? 'Сохраняем…' : 'Сохранить настройки' }}</button>
            <p v-if="state.saveError" class="settings-error" role="alert">{{ state.saveError }}</p>
            <p v-else-if="state.saved" role="status">Настройки рабочего дня сохранены.</p>
          </div>
        </form>
        <section class="email-reminders" aria-labelledby="email-reminders-title">
          <h2 id="email-reminders-title">Почтовые напоминания</h2>
          <p>Примерно за 15 минут до начала запланированной задачи из серверного расписания сервис автоматически отправляет письмо на <strong>{{ auth.user?.email }}</strong>.</p>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings-page {
  color: #fff;
  font: 20px/1.4 'Times New Roman', serif;
}
.settings-layout {
  display: grid;
  grid-template-columns: var(--desktop-layout-columns);
  column-gap: var(--desktop-layout-column-gap);
  max-width: var(--desktop-layout-width);
  margin-inline: auto;
  padding-block: 61px 40px;
  padding-inline: var(--desktop-layout-padding-inline);
}
.settings-navigation { justify-self: center; }
.settings-panel {
  grid-column: 1 / -1;
  width: 100%;
  max-width: 800px;
  margin: var(--navigation-content-gap) auto 0;
  padding: clamp(16px, 4vw, 42px);
}
.settings-header { display: flex; flex-wrap: wrap; gap: 8px 24px; align-items: center; justify-content: space-between; }
h1 { font-size: clamp(29px, 4vw, 40px); font-weight: 400; }
.settings-description { margin: 8px 0 20px; }
.settings-form { display: grid; gap: 16px; }
fieldset { min-width: 0; margin: 0; padding: 10px 16px 16px; border: 1px solid rgb(255 255 255 / 45%); }
legend { padding-inline: 8px; font-size: 23px; }
.settings-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 20px; }
.settings-field { display: grid; align-content: start; gap: 4px; min-width: 0; }
input { width: 100%; min-height: 44px; padding: 6px 10px; border: 1px solid #354533; font: inherit; color: #253b2c; background: #f3f5ed; }
input[aria-invalid="true"] { outline: 2px solid #782a20; outline-offset: -2px; }
.settings-header a, button { display: inline-grid; place-items: center; min-height: 44px; max-width: 100%; color: inherit; }
button { border: 0; padding: 10px 18px; background: #354533; font: inherit; cursor: pointer; }
button:hover:not(:disabled) { background: #273924; }
button:disabled { opacity: 0.65; cursor: wait; }
input:focus-visible, button:focus-visible, .settings-header a:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
.settings-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; }
.settings-actions p, .settings-field p { margin: 0; }
.settings-error { padding: 4px 8px; background: #693d35; overflow-wrap: anywhere; }
.email-reminders { margin-top: 24px; padding: 12px 16px; background: #40523d; overflow-wrap: anywhere; }
.email-reminders h2 { margin: 0; font-size: 23px; font-weight: 400; }
.email-reminders p { margin: 4px 0 0; }
@media (max-width: 900px) {
  .settings-layout { display: block; padding: 0 16px 24px; }
  .settings-navigation { width: auto; margin-inline: -16px; justify-self: stretch; }
}
@media (max-width: 540px) {
  .settings-fields { grid-template-columns: minmax(0, 1fr); }
}
</style>
