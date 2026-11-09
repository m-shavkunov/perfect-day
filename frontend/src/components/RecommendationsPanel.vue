<script setup>
import { computed } from 'vue'
import { formatPercentage } from '../utils/format.js'

const props = defineProps({
  items: { type: Array, required: true },
  status: { type: String, required: true },
  error: { type: String, default: '' },
  selectedDate: { type: String, required: true },
})
defineEmits(['retry'])
const dateFormatter = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'UTC' })
const dateLabel = computed(() => dateFormatter.format(new Date(`${props.selectedDate}T12:00:00Z`)))
const taskTypes = {
  intellectual: { label: 'Интеллектуальная задача', activityLabel: 'Интеллектуальный ритм' },
  physical: { label: 'Физическая задача', activityLabel: 'Физический ритм' },
  creative: { label: 'Творческая задача', activityLabel: 'Эмоциональный ритм' },
  routine: { label: 'Рутинная задача', activityLabel: 'Биоритм' },
}
const taskType = type => Object.hasOwn(taskTypes, type) ? taskTypes[type] : { label: 'Другой тип задачи', activityLabel: 'Биоритм' }
</script>

<template>
  <section class="recommendations-panel" aria-labelledby="recommendations-title">
    <h3 id="recommendations-title">Рекомендации</h3>
    <p class="recommendations-date">На <time :datetime="selectedDate">{{ dateLabel }}</time></p>
    <div
      class="recommendations-content"
      role="region"
      aria-label="Рекомендации для задач на выбранный день"
      tabindex="0"
      :aria-busy="status === 'loading'"
    >
      <p v-if="status === 'loading' || status === 'idle'" class="recommendations-message" role="status">Загружаем рекомендации…</p>
      <div v-else-if="status === 'error'" class="recommendations-error" role="status">
        <p>Не удалось загрузить рекомендации.</p>
        <p class="recommendations-detail">{{ error || 'Попробуйте ещё раз.' }}</p>
        <button class="recommendations-retry" type="button" @click="$emit('retry')">Повторить рекомендации</button>
      </div>
      <div v-else-if="!items.length" class="recommendations-empty" role="status">
        <p>Рекомендаций на эту дату пока нет.</p>
        <p class="recommendations-detail">Они появятся, когда у вас будут запланированные задачи.</p>
      </div>
      <template v-else>
        <p class="recommendations-count" role="status">Задач с рекомендациями: {{ items.length }}.</p>
        <ul class="recommendations-list">
          <li v-for="item in items" :key="item.task_id">
            <article class="recommendation-card">
              <p class="recommendation-type">{{ taskType(item.task_type).label }}</p>
              <h4 class="recommendation-title">{{ item.title }}</h4>
              <p class="recommendation-advice">{{ item.recommendation }}</p>
              <p class="recommendation-reason">{{ item.reason }}</p>
              <p v-if="item.activity_value !== null" class="recommendation-activity">
                {{ taskType(item.task_type).activityLabel }}: <span>{{ formatPercentage(item.activity_value) }}</span>
              </p>
              <p v-else class="recommendation-unrated">Без оценки биоритма</p>
            </article>
          </li>
        </ul>
      </template>
    </div>
  </section>
</template>

<style scoped>
.recommendations-panel { margin-top: 24px; padding-top: 20px; border-top: 1px solid rgb(255 255 255 / 30%); min-width: 0; }
h3 { margin: 0; font-size: 23px; font-weight: 400; }
.recommendations-date { min-height: 2.8em; margin: 8px 0 12px; font-size: 16px; line-height: 1.4; overflow-wrap: anywhere; }
.recommendations-content { height: 320px; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; font-size: 16px; line-height: 1.4; overflow-wrap: anywhere; }
.recommendations-content:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.recommendations-message, .recommendations-empty p, .recommendations-error p { margin: 0 0 12px; }
.recommendations-detail { color: #dce5d6; }
.recommendations-error { padding: 12px; background: #693d35; }
.recommendations-retry { max-width: 100%; min-height: 44px; padding: 10px; border: 1px solid #fff; background: #4e624a; color: #fff; font: inherit; text-align: left; cursor: pointer; }
.recommendations-retry:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
.recommendations-count { margin: 0 0 12px; font-size: 14px; }
.recommendations-list { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
.recommendation-card { min-width: 0; padding: 14px; border: 1px solid rgb(255 255 255 / 30%); background: rgb(24 40 22 / 65%); }
.recommendation-type { margin: 0 0 8px; color: #dce5d6; font-size: 14px; }
.recommendation-title { margin: 0 0 12px; font-size: 21px; font-weight: 400; line-height: 1.3; }
.recommendation-advice { margin: 0 0 8px; color: #ffe4af; font-size: 18px; line-height: 1.4; }
.recommendation-reason { margin: 0; }
.recommendation-activity, .recommendation-unrated { margin: 12px 0 0; padding-top: 10px; border-top: 1px solid rgb(255 255 255 / 20%); font-size: 15px; }
.recommendation-activity span { display: inline-block; font-variant-numeric: tabular-nums; white-space: nowrap; }
.recommendation-unrated { color: #dce5d6; }
@media (hover: hover) { .recommendations-retry:hover { background: #5b7055; } }
@media (max-width: 900px) {
  .recommendations-content { height: auto; min-height: 112px; max-height: 400px; }
}
@media (max-width: 600px) {
  .recommendation-card { padding: 12px; }
  .recommendation-title { font-size: 20px; }
}
</style>
