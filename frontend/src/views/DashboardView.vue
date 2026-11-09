<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BiorhythmForecast from '../components/BiorhythmForecast.vue'
import CriticalDaysPanel from '../components/CriticalDaysPanel.vue'
import RecommendationsPanel from '../components/RecommendationsPanel.vue'
import { auth, signOut } from '../state/auth.js'
import { createDashboardState } from '../state/dashboard.js'
import { getAdjacentPeriodDate, isDateString, localDateString } from '../utils/dates.js'
import { formatPercentage } from '../utils/format.js'

const router = useRouter()
const forecastView = ref('chart')
const { state: dashboard, dateRange, isLoading, hasErrors, load, setDate, setPeriod, retryFailed, dispose } = createDashboardState({
  getToken: () => auth.token,
  onUnauthorized: handleUnauthorized,
})
const dateInput = ref(dashboard.selectedDate)
const dateError = ref('')
const periods = [
  { value: 'day', label: 'День', empty: 'Нет данных за день' },
  { value: 'week', label: 'Неделя', empty: 'Нет данных за неделю' },
  { value: 'month', label: 'Месяц', empty: 'Нет данных за месяц' },
]
const biorhythms = [
  { id: 'physical', label: 'Физический' },
  { id: 'emotional', label: 'Эмоциональный' },
  { id: 'intellectual', label: 'Интеллектуальный' },
]
const resourceLabels = { daily: 'Показатели', forecast: 'Прогноз', criticalDays: 'Критические дни', recommendations: 'Рекомендации' }
const requestErrors = computed(() => Object.entries(resourceLabels)
  .filter(([name]) => dashboard[name].status === 'error')
  .map(([name, label]) => `${label}: ${dashboard[name].error}`))
const allLoaded = computed(() => Object.keys(resourceLabels).every((name) => dashboard[name].status === 'success'))
const emptyMessage = computed(() => periods.find(({ value }) => value === dashboard.selectedPeriod).empty)
const navigation = computed(() => ({
  previousDate: getAdjacentPeriodDate(dashboard.selectedDate, dashboard.selectedPeriod, -1),
  nextDate: getAdjacentPeriodDate(dashboard.selectedDate, dashboard.selectedPeriod, 1),
  ...({
    day: { previousLabel: 'Предыдущий день', nextLabel: 'Следующий день' },
    week: { previousLabel: 'Предыдущая неделя', nextLabel: 'Следующая неделя' },
    month: { previousLabel: 'Предыдущий месяц', nextLabel: 'Следующий месяц' },
  })[dashboard.selectedPeriod],
}))
const dateFormatter = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'UTC' })
const selectedDateLabel = computed(() => dateFormatter.format(new Date(`${dashboard.selectedDate}T12:00:00Z`)))
const rangeLabel = computed(() => {
  const start = dateFormatter.format(new Date(`${dateRange.value.startDate}T12:00:00Z`))
  const end = dateFormatter.format(new Date(`${dateRange.value.endDate}T12:00:00Z`))
  return dateRange.value.startDate === dateRange.value.endDate ? start : `${start} — ${end}`
})
const summaryMessage = computed(() => {
  if (dashboard.daily.status === 'loading') return 'Загружаем показатели…'
  if (dashboard.daily.status === 'error') return 'Не удалось загрузить показатели.'
  return dashboard.daily.status === 'success' ? '' : 'Данные пока не загружены.'
})
const forecastMessage = computed(() => {
  if (dashboard.forecast.status === 'loading') return 'Загружаем прогноз…'
  if (dashboard.forecast.status === 'error') return 'Прогноз недоступен.'
  return emptyMessage.value
})

onMounted(() => load())
onBeforeUnmount(dispose)

function handleUnauthorized() {
  signOut()
  auth.notice = 'Сессия истекла. Войдите снова, чтобы открыть дашборд.'
  return router.replace({ name: 'login' })
}

function changeDate(event) {
  dateInput.value = event.target.value
  if (!event.target.validity.valid || !isDateString(dateInput.value)) {
    dateError.value = 'Укажите корректную дату.'
    return
  }
  return selectDate(dateInput.value)
}

function selectDate(date) {
  dateInput.value = date
  dateError.value = ''
  return setDate(date)
}

</script>

<template>
  <section class="dashboard-page" aria-labelledby="dashboard-title">
    <h1 id="dashboard-title" class="visually-hidden">Дашборд</h1>
    <div class="dashboard-layout">
      <aside class="dashboard-sidebar" aria-label="Профиль и показатели на выбранную дату">
        <button class="profile-button" type="button" @click="router.push({ name: 'profile' })">Профиль</button>
        <section class="summary-panel glass-panel" aria-labelledby="summary-title" tabindex="0">
          <h2 id="summary-title" class="summary-date">Биоритмы на <time :datetime="dashboard.selectedDate">{{ selectedDateLabel }}</time></h2>
          <dl class="metrics" :aria-busy="dashboard.daily.status === 'loading'">
            <div v-for="biorhythm in biorhythms" :key="biorhythm.id" class="metric">
              <dt>{{ biorhythm.label }}:</dt>
              <dd v-if="dashboard.daily.status === 'success'">{{ formatPercentage(dashboard.daily.data[biorhythm.id]) }}</dd>
              <dd v-else><span aria-hidden="true">—</span><span class="visually-hidden">{{ dashboard.daily.status === 'loading' ? 'Загрузка' : 'Нет данных' }}</span></dd>
            </div>
          </dl>
          <p class="summary-scale">Шкала от −100% до +100%.</p>
          <p v-if="summaryMessage" class="summary-empty" role="status">{{ summaryMessage }}</p>
          <CriticalDaysPanel
            :items="dashboard.criticalDays.status === 'success' ? dashboard.criticalDays.data.items : []"
            :status="dashboard.criticalDays.status"
            :selected-date="dashboard.selectedDate"
            @select-date="selectDate"
            @retry="load(['criticalDays'])"
          />
          <RecommendationsPanel
            :items="dashboard.recommendations.status === 'success' ? dashboard.recommendations.data.items : []"
            :status="dashboard.recommendations.status"
            :error="dashboard.recommendations.error"
            :selected-date="dashboard.selectedDate"
            @retry="load(['recommendations'])"
          />
        </section>
      </aside>
      <section class="forecast-panel glass-panel" :class="{ 'forecast-panel--expanded': hasErrors || dateError }" aria-label="Прогноз биоритмов">
        <div class="forecast-controls">
          <label class="date-field" for="dashboard-date">
            <span>Дата</span>
            <input
              id="dashboard-date"
              :value="dateInput"
              type="date"
              min="0001-01-01"
              max="9999-12-31"
              required
              :aria-invalid="Boolean(dateError)"
              :aria-describedby="dateError ? 'dashboard-date-error' : undefined"
              @change="changeDate"
            />
          </label>
          <p v-if="dateError" id="dashboard-date-error" class="date-error" role="alert">{{ dateError }}</p>
          <p class="range-label">{{ rangeLabel }}</p>
        </div>
        <div class="period-switch" role="group" aria-label="Период прогноза">
          <button
            v-for="period in periods"
            :key="period.value"
            type="button"
            :aria-pressed="dashboard.selectedPeriod === period.value"
            aria-controls="forecast-results"
            @click="setPeriod(period.value)"
          >
            {{ period.label }}
          </button>
        </div>
        <div class="period-navigation" role="group" aria-label="Переход между периодами">
          <button
            type="button"
            :aria-label="navigation.previousLabel"
            :title="navigation.previousLabel"
            :disabled="!navigation.previousDate"
            @click="selectDate(navigation.previousDate)"
          >←</button>
          <button type="button" @click="selectDate(localDateString())">Сегодня</button>
          <button
            type="button"
            :aria-label="navigation.nextLabel"
            :title="navigation.nextLabel"
            :disabled="!navigation.nextDate"
            @click="selectDate(navigation.nextDate)"
          >→</button>
        </div>
        <div class="request-feedback" :aria-busy="isLoading">
          <p v-if="isLoading" role="status">Загружаем данные…</p>
          <p v-else-if="allLoaded" role="status">Данные за выбранные даты загружены.</p>
          <div v-if="hasErrors" class="request-errors" role="alert">
            <ul><li v-for="error in requestErrors" :key="error">{{ error }}</li></ul>
            <button class="retry-button" type="button" :disabled="isLoading" @click="retryFailed">Повторить загрузку</button>
          </div>
        </div>
        <div id="forecast-results" class="forecast-results" :aria-busy="dashboard.forecast.status === 'loading'">
          <BiorhythmForecast
            v-if="dashboard.forecast.status === 'success' && dashboard.forecast.data.items.length"
            v-model:view="forecastView"
            :items="dashboard.forecast.data.items"
            :selected-date="dashboard.selectedDate"
            :period="dashboard.selectedPeriod"
            :critical-items="dashboard.criticalDays.status === 'success' ? dashboard.criticalDays.data.items : []"
            @select-date="selectDate"
          />
          <p v-else class="forecast-empty" role="status">{{ forecastMessage }}</p>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.dashboard-page {
  position: relative;
  isolation: isolate;
  width: 100%;
  min-height: 100svh;
  background: linear-gradient(rgb(83 98 66 / 87%), rgb(83 98 66 / 87%)), #fff;
  color: #fff;
  font-family: 'Times New Roman', serif;
  line-height: normal;
}
.dashboard-page::before {
  content: '';
  position: fixed;
  inset: 0 auto auto 0;
  width: 100%;
  height: 100svh;
  z-index: -1;
  background: url('../assets/leaves.jpg') center / cover no-repeat;
  opacity: 0.6;
  pointer-events: none;
}
.dashboard-layout {
  display: grid;
  grid-template-columns: minmax(0, 476fr) minmax(0, 869fr);
  gap: 34px;
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 29px 31px 0 30px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.glass-panel { background: rgb(138 140 137 / 20%); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 20%); }
button {
  padding: 12px;
  border: 0;
  border-radius: 0;
  background: #4e624a;
  color: #fff;
  font: inherit;
  font-size: clamp(22px, 2.777778vw, 40px);
  line-height: 46px;
  cursor: pointer;
  transition: background-color 160ms ease, box-shadow 160ms ease;
}
button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid #fff; outline-offset: 4px; }
button:active { background: #344630; }
button:disabled { opacity: 0.55; cursor: not-allowed; }
.dashboard-sidebar { display: flex; flex-direction: column; min-width: 0; align-self: start; }
.profile-button { align-self: center; width: 312px; max-width: 100%; min-height: 85px; margin-top: 32px; }
.summary-panel { flex: none; min-width: 0; height: calc(100svh - 192px); min-height: 520px; margin-top: 46px; padding: 32px 51px; overflow: auto; overscroll-behavior: contain; }
.summary-panel:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
.summary-date { margin: 0 0 24px; font-size: 20px; font-weight: 400; line-height: 1.4; overflow-wrap: anywhere; }
.metrics { margin: 0; font-size: clamp(22px, 2.15vw, 30px); line-height: 1.5; }
.metric { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
.metric + .metric { margin-top: 12px; }
.metric dt { overflow-wrap: anywhere; }
.metric dd { margin: 0 0 0 auto; font-size: 0.8em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.summary-scale { margin: 20px 0 0; font-size: 18px; line-height: 1.4; }
.summary-empty { margin: 16px 0 0; font-size: 22px; line-height: 26px; }
.forecast-panel { display: flex; flex-direction: column; min-width: 0; height: calc(100svh - 29px); min-height: 680px; padding: 32px 0 40px; }
.forecast-controls, .period-switch, .period-navigation, .request-feedback { flex: none; }
.forecast-controls { margin: 0 24px 24px 25px; min-width: 0; }
.date-field { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; font-size: 22px; }
.date-field input { min-width: 0; max-width: 100%; min-height: 44px; padding: 8px 12px; border: 1px solid rgb(255 255 255 / 60%); border-radius: 0; background: #3f533b; color: #fff; color-scheme: dark; font: inherit; }
.date-field input[aria-invalid='true'] { border-color: #ffc9bd; }
.range-label { min-height: 2.8em; margin: 12px 0 0; font-size: 20px; line-height: 1.4; overflow-wrap: anywhere; }
.date-error { margin: 12px 0 0; padding: 8px 12px; background: #693d35; font-size: 18px; line-height: 1.4; }
.request-feedback { margin: 20px 25px 0; font-size: 18px; line-height: 1.5; overflow-wrap: anywhere; }
.request-feedback p { margin: 0; }
.request-errors { padding: 16px; background: #693d35; }
.request-errors ul { margin: 0; padding-left: 20px; }
.request-errors li + li { margin-top: 8px; }
.retry-button { max-width: 100%; min-height: 44px; margin-top: 16px; padding: 10px 16px; font-size: 18px; line-height: 1.4; }
.period-switch { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 35px; margin: 0 24px 0 25px; }
.period-switch button { min-height: 85px; padding: 12px 4px; }
.period-switch button[aria-pressed='true'] { background: #344630; box-shadow: inset 0 0 0 2px #fff; }
.period-navigation { display: flex; flex-wrap: wrap; gap: 12px; margin: 20px 25px 0; }
.period-navigation button { min-width: 48px; min-height: 44px; padding: 8px 16px; font-size: 20px; line-height: 1.4; }
.forecast-results { flex: 1; min-width: 0; min-height: 0; margin: 24px 25px 0; overflow: auto; overscroll-behavior: contain; }
.forecast-empty { display: grid; place-items: center; height: 100%; margin: 0; padding: 12px; font-size: 20px; line-height: 1.4; text-align: center; }
@media (hover: hover) {
  button:not(:disabled):hover { background: #5b7055; }
  .period-switch button[aria-pressed='true']:hover { background: #344630; }
  button:not(:disabled):active { background: #344630; }
}
@media (min-width: 901px) {
  .forecast-panel--expanded { height: auto; }
  .forecast-panel--expanded .forecast-results { flex: none; height: clamp(360px, 50svh, 520px); }
}
@media (min-width: 901px) and (max-width: 1399px) {
  .summary-panel { padding-inline: 32px; }
  .metrics { font-size: clamp(20px, 2.15vw, 28px); }
}
@media (max-width: 900px) {
  .dashboard-layout { grid-template-columns: minmax(0, 1fr); padding: 24px 16px; gap: 24px; }
  .profile-button { min-height: 64px; margin-top: 0; line-height: 1.2; }
  .summary-panel { height: auto; min-height: 0; margin-top: 24px; padding: 32px; overflow: visible; }
  .metrics { line-height: 1.5; }
  .forecast-panel { height: auto; min-height: 0; padding: 24px 0 32px; }
  .forecast-results { flex: none; height: clamp(440px, 65svh, 600px); }
  .forecast-controls { margin-inline: 24px; }
  .period-switch { margin: 0 24px; gap: 12px; }
  .period-switch button { min-height: 56px; line-height: 1.2; }
}
@media (max-width: 600px) {
  .summary-panel { padding: 24px; }
  .summary-empty { font-size: 18px; line-height: 1.4; }
  .forecast-controls, .request-feedback, .period-navigation, .forecast-results { margin-inline: 16px; }
  .date-field { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; font-size: 20px; }
  .date-field input { width: 100%; }
  .range-label { min-height: 2.8em; font-size: 18px; }
  .period-switch { margin: 0 16px; gap: 8px; }
  .period-switch button { font-size: 20px; }
  .forecast-empty { font-size: 18px; }
}
@media (prefers-reduced-motion: reduce) {
  button { transition: none; }
}
</style>



