<script setup>
import { computed } from 'vue'
import BiorhythmChart from './BiorhythmChart.vue'
import { formatPercentage } from '../utils/format.js'
import { describeCriticalEntries, groupCriticalDays } from '../utils/criticalDays.js'

const props = defineProps({
  items: { type: Array, required: true },
  selectedDate: { type: String, required: true },
  period: { type: String, required: true },
  view: { type: String, required: true },
  criticalItems: { type: Array, required: true },
})
defineEmits(['select-date', 'update:view'])

const title = computed(() => ({ day: 'Прогноз на день', week: 'Прогноз на неделю', month: 'Прогноз на месяц' })[props.period])
const criticalByDate = computed(() => new Map(groupCriticalDays(props.criticalItems).map(day => [day.date, day.entries])))
const metrics = [
  { id: 'physical', label: 'Физический', shortLabel: 'Физ.' },
  { id: 'emotional', label: 'Эмоциональный', shortLabel: 'Эмоц.' },
  { id: 'intellectual', label: 'Интеллектуальный', shortLabel: 'Интел.' },
]
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' })
const fullDate = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'UTC' })
const rows = computed(() => props.items.map((item) => {
  const date = new Date(`${item.date}T12:00:00Z`)
  return { ...item, dateLabel: shortDate.format(date), weekday: weekday.format(date), fullDate: fullDate.format(date) }
}))
</script>

<template>
  <div class="forecast-view">
    <div class="forecast-heading">
      <h2 class="forecast-title">{{ title }}</h2>
      <div class="view-switch" role="group" aria-label="Вид прогноза">
        <button type="button" :aria-pressed="view === 'chart'" @click="$emit('update:view', 'chart')">График</button>
        <button type="button" :aria-pressed="view === 'table'" @click="$emit('update:view', 'table')">Таблица</button>
      </div>
      <p class="forecast-hint">{{ view === 'chart' && items.length === 1 ? 'На день показаны три точки. Для линий выберите неделю или месяц.' : 'Выберите день, чтобы посмотреть его показатели.' }}</p>
    </div>
    <BiorhythmChart v-if="view === 'chart'" :items="items" :selected-date="selectedDate" :critical-items="criticalItems" @select-date="$emit('select-date', $event)" />
    <div v-else class="forecast-table-wrapper" role="region" :aria-label="`${title}: таблица по дням`" tabindex="0">
      <table class="forecast-table" :aria-label="title">
        <thead>
          <tr>
            <th scope="col" class="date-column">Дата</th>
            <th v-for="metric in metrics" :key="metric.id" scope="col" :aria-label="metric.label">
              <span class="full-label">{{ metric.label }}</span>
              <abbr class="short-label" :title="metric.label">{{ metric.shortLabel }}</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in rows" :key="item.date" :class="{ 'selected-row': item.date === selectedDate, 'critical-row': criticalByDate.has(item.date) }">
            <th scope="row">
              <button
                type="button"
                class="day-button"
                :aria-label="`Показать показатели за ${item.fullDate}${criticalByDate.has(item.date) ? `. Критический день. ${describeCriticalEntries(criticalByDate.get(item.date))}` : ''}`"
                :aria-pressed="item.date === selectedDate"
                @click="$emit('select-date', item.date)"
              >
                <time :datetime="item.date">{{ item.dateLabel }}</time>
                <span class="weekday">{{ item.weekday }}</span>
              </button>
            </th>
            <td v-for="metric in metrics" :key="metric.id" :class="{ 'critical-cell': criticalByDate.get(item.date)?.some(entry => entry.biorhythm === metric.id) }">
              {{ formatPercentage(item[metric.id]) }}
              <template v-for="entry in criticalByDate.get(item.date)?.filter(entry => entry.biorhythm === metric.id) || []" :key="entry.biorhythm">
                <span class="critical-cell-marker" aria-hidden="true" :title="`${entry.label}: ${entry.directionLabel}`">◆</span>
                <span class="visually-hidden">Критический день: {{ entry.directionLabel }}.</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.forecast-view { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.forecast-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; flex: none; margin-bottom: 12px; }
.forecast-title { margin: 0; font-size: 26px; font-weight: 400; line-height: 1.4; }
.forecast-hint { flex-basis: 100%; min-height: 2.8em; margin: 0; font-size: 16px; line-height: 1.4; }
.view-switch { display: flex; gap: 4px; }
.view-switch button { min-height: 40px; padding: 8px 10px; border: 1px solid transparent; background: #4e624a; color: inherit; font: inherit; font-size: 16px; cursor: pointer; }
.view-switch button[aria-pressed='true'] { border-color: #fff; background: #344630; }
.view-switch button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.forecast-table-wrapper { flex: 1; width: 100%; min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
.forecast-table-wrapper:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
.forecast-table { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0; font-size: 18px; line-height: 1.4; }
th, td { padding: 12px 8px; border-bottom: 1px solid rgb(255 255 255 / 25%); text-align: right; }
thead th { position: sticky; top: 0; z-index: 1; background: #3f533b; font-size: 16px; font-weight: 400; overflow-wrap: anywhere; }
.date-column { width: 22%; text-align: left; }
tbody th { text-align: left; font-weight: 400; }
td { position: relative; font-variant-numeric: tabular-nums; white-space: nowrap; }
.critical-row:not(.selected-row) { box-shadow: inset 3px 0 #ffdb8a; }
.critical-cell { background: rgb(255 219 138 / 12%); }
.critical-cell-marker { position: absolute; bottom: 3px; right: 5px; color: #ffdb8a; font-size: 9px; line-height: 1; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.selected-row { background: rgb(52 70 48 / 70%); box-shadow: inset 3px 0 #fff; }
.day-button { display: block; width: 100%; min-height: 44px; padding: 4px; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.day-button[aria-pressed='true'] time { text-decoration: underline; text-underline-offset: 4px; }
.day-button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.weekday { display: block; font-size: 14px; text-transform: capitalize; }
.short-label { display: none; text-decoration: none; }
@media (hover: hover) {
  .day-button:hover { background: #4e624a; }
}
@media (max-width: 1100px) {
  .full-label { display: none; }
  .short-label { display: inline; }
}
@media (max-width: 600px) {
  .forecast-table { font-size: 14px; }
  .forecast-title { font-size: 22px; }
  .forecast-hint { font-size: 15px; }
  th, td { padding: 10px 3px; }
  thead th { font-size: 14px; }
  .date-column { width: 19%; }
  .day-button { padding-inline: 1px; }
  .weekday { font-size: 13px; }
}
</style>
