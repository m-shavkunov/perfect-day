<script setup>
import { computed } from 'vue'
import { describeCriticalEntries, groupCriticalDays } from '../utils/criticalDays.js'

const props = defineProps({
  items: { type: Array, required: true },
  status: { type: String, required: true },
  selectedDate: { type: String, required: true },
})
defineEmits(['select-date', 'retry'])
const days = computed(() => groupCriticalDays(props.items))
const selectedEntries = computed(() => days.value.find(day => day.date === props.selectedDate)?.entries || [])
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const fullDate = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'UTC' })
const formatDate = (date, formatter) => formatter.format(new Date(`${date}T12:00:00Z`))
</script>

<template>
  <section class="critical-panel" aria-labelledby="critical-days-title">
    <h3 id="critical-days-title">Критические дни</h3>
    <p class="critical-explanation">◆ — день смены знака биоритма при переходе через ноль.</p>
    <div class="critical-content" role="region" aria-label="Критические дни выбранного периода" tabindex="0" :aria-busy="status === 'loading'">
      <p v-if="status === 'loading' || status === 'idle'" role="status">Загружаем критические дни…</p>
      <div v-else-if="status === 'error'" role="status">
        <p>Критические дни недоступны. Отметки не показаны.</p>
        <button class="critical-retry" type="button" @click="$emit('retry')">Повторить загрузку</button>
      </div>
      <template v-else>
        <p v-if="!days.length" role="status">В выбранном периоде критических дней нет.</p>
        <template v-else>
          <p class="critical-selected" role="status">{{ selectedEntries.length ? `На выбранную дату: ${describeCriticalEntries(selectedEntries)}.` : 'На выбранную дату переходов нет.' }}</p>
          <p class="critical-count">Дат с переходами в периоде: {{ days.length }}.</p>
          <ul class="critical-list">
            <li v-for="day in days" :key="day.date">
              <button
                type="button"
                class="critical-day-button"
                :aria-pressed="day.date === selectedDate"
                :aria-label="`${formatDate(day.date, fullDate)}. ${describeCriticalEntries(day.entries)}. Показать показатели дня.`"
                @click="$emit('select-date', day.date)"
              >
                <time :datetime="day.date">{{ formatDate(day.date, shortDate) }}</time>
                <span class="critical-transitions"><span v-for="entry in day.entries" :key="entry.biorhythm">{{ entry.label }}: <span class="transition">{{ entry.transition }}</span></span></span>
              </button>
            </li>
          </ul>
        </template>
      </template>
    </div>
  </section>
</template>

<style scoped>
.critical-panel { margin-top: 24px; padding-top: 20px; border-top: 1px solid rgb(255 255 255 / 30%); }
h3 { margin: 0; font-size: 23px; font-weight: 400; }
.critical-explanation { margin: 8px 0 12px; font-size: 16px; line-height: 1.4; }
.critical-content { height: 200px; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; font-size: 16px; line-height: 1.4; }
.critical-content:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.critical-content p { margin: 0 0 12px; }
.critical-selected { color: #ffe4af; }
.critical-count { font-size: 14px; }
.critical-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.critical-day-button { display: flex; align-items: baseline; gap: 12px; width: 100%; min-height: 44px; padding: 10px; border: 1px solid rgb(255 219 138 / 40%); background: rgb(24 40 22 / 60%); color: #fff; text-align: left; font: inherit; cursor: pointer; }
.critical-day-button[aria-pressed='true'] { border-color: #fff; box-shadow: inset 3px 0 #ffdb8a; }
.critical-day-button:focus-visible, .critical-retry:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
.critical-day-button time { flex: none; color: #ffe4af; font-variant-numeric: tabular-nums; }
.critical-transitions { display: grid; gap: 4px; min-width: 0; overflow-wrap: anywhere; }
.transition { white-space: nowrap; }
.critical-retry { min-height: 44px; padding: 10px; border: 1px solid #fff; background: #4e624a; color: #fff; font: inherit; cursor: pointer; }
@media (hover: hover) { .critical-day-button:hover, .critical-retry:hover { background: #4e624a; } }
@media (max-width: 900px) {
  .critical-content { height: 160px; }
}
</style>
