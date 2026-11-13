<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { chartMetrics, createChartLayout, getNearestChartIndex } from '../utils/chart.js'
import { formatPercentage } from '../utils/format.js'
import { getCriticalMarkers } from '../utils/criticalDays.js'

const props = defineProps({
  items: { type: Array, required: true },
  selectedDate: { type: String, required: true },
  criticalItems: { type: Array, required: true },
})
const emit = defineEmits(['select-date'])
const plotElement = ref(null)
const width = ref(640)
const height = ref(220)
const previewDate = ref(null)
const layout = computed(() => createChartLayout(props.items, width.value, height.value))
const criticalMarkers = computed(() => getCriticalMarkers(layout.value, props.criticalItems))
const selectedIndex = computed(() => props.items.findIndex(item => item.date === props.selectedDate))
const activeIndex = computed(() => {
  const previewIndex = props.items.findIndex(item => item.date === previewDate.value)
  return previewIndex >= 0 ? previewIndex : Math.max(0, selectedIndex.value)
})
const activeItem = computed(() => props.items[activeIndex.value])
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const fullDate = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'UTC' })
const dateLabel = date => shortDate.format(new Date(`${date}T12:00:00Z`))
const activeDateLabel = computed(() => fullDate.format(new Date(`${activeItem.value.date}T12:00:00Z`)))
let resizeObserver

onMounted(() => {
  resizeObserver = new ResizeObserver(([entry]) => {
    width.value = Math.max(180, entry.contentRect.width)
    height.value = Math.max(160, entry.contentRect.height)
  })
  resizeObserver.observe(plotElement.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())
watch(() => props.items, () => { previewDate.value = null })
watch(() => props.selectedDate, () => { previewDate.value = null })

function pointerIndex(event) {
  const bounds = event.currentTarget.getBoundingClientRect()
  return getNearestChartIndex((event.clientX - bounds.left) * width.value / bounds.width, layout.value)
}

function preview(event) {
  if (event.pointerType === 'mouse') previewDate.value = props.items[pointerIndex(event)]?.date || null
}

function selectPoint(event) {
  const item = props.items[pointerIndex(event)]
  if (item) emit('select-date', item.date)
}

function navigate(event) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (!keys.includes(event.key)) return
  event.preventDefault()
  const current = Math.max(0, selectedIndex.value)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? props.items.length - 1
    : Math.max(0, Math.min(props.items.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)))
  emit('select-date', props.items[next].date)
}
</script>

<template>
  <div class="chart-view">
    <div
      ref="plotElement"
      class="chart-plot"
      role="group"
      tabindex="0"
      aria-label="График биоритмов. Выбор дня стрелками влево и вправо, первого и последнего дня клавишами Home и End. Точные значения доступны под графиком и в таблице."
      @keydown="navigate"
    >
      <svg
        class="chart-svg"
        :viewBox="`0 0 ${width} ${height}`"
        aria-hidden="true"
        @pointermove="preview"
        @pointerleave="previewDate = null"
        @click="selectPoint"
      >
        <g v-for="tick in layout.yTicks" :key="tick.value" class="chart-axis">
          <line :x1="layout.left" :x2="layout.right" :y1="tick.y" :y2="tick.y" :class="{ 'zero-line': tick.value === 0 }" />
          <text :x="layout.left - 8" :y="tick.y" text-anchor="end" dominant-baseline="middle">{{ tick.value > 0 ? '+' : tick.value < 0 ? '−' : '' }}{{ Math.abs(tick.value) }}%</text>
        </g>
        <g v-for="tick in layout.xTicks" :key="tick.date" class="chart-axis">
          <line :x1="tick.x" :x2="tick.x" :y1="layout.bottom" :y2="layout.bottom + 4" />
          <text :x="tick.x" :y="height - 6" text-anchor="middle">{{ dateLabel(tick.date) }}</text>
        </g>
        <line
          v-if="selectedIndex >= 0"
          class="selected-guide"
          :x1="layout.points[selectedIndex].x" :x2="layout.points[selectedIndex].x"
          :y1="layout.top" :y2="layout.bottom"
        />
        <line
          v-if="activeIndex !== selectedIndex"
          class="preview-guide"
          :x1="layout.points[activeIndex].x" :x2="layout.points[activeIndex].x"
          :y1="layout.top" :y2="layout.bottom"
        />
        <g v-for="series in layout.series" :key="series.id" :stroke="series.color">
          <polyline
            v-if="items.length > 1"
            class="chart-line"
            :points="series.points.map(point => `${point.x},${point.y}`).join(' ')"
            :stroke-dasharray="series.dash"
          />
          <circle
            v-for="point in series.points" :key="point.date"
            :cx="point.x" :cy="point.y"
            :r="items.length === 1 || point.date === selectedDate ? 4.5 : 2"
            :fill="series.color"
            :stroke="point.date === selectedDate ? '#233220' : series.color"
            stroke-width="2"
          />
          <circle
            v-if="activeIndex !== selectedIndex"
            :cx="series.points[activeIndex].x" :cy="series.points[activeIndex].y"
            r="5" fill="#233220" stroke-width="2"
          />
        </g>
        <path
          v-for="marker in criticalMarkers" :key="`${marker.date}:${marker.biorhythm}`"
          class="critical-chart-marker"
          :data-date="marker.date" :data-biorhythm="marker.biorhythm"
          :d="`M ${marker.x} ${marker.y - 6} L ${marker.x + 6} ${marker.y} L ${marker.x} ${marker.y + 6} L ${marker.x - 6} ${marker.y} Z`"
          :stroke="marker.color"
        />
      </svg>
    </div>
    <div class="chart-readout" :aria-live="previewDate ? 'off' : 'polite'" aria-atomic="true">
      <p class="chart-date"><time :datetime="activeItem.date">{{ activeDateLabel }}</time><span>{{ activeItem.date === selectedDate ? 'Выбранный день' : 'Нажмите, чтобы выбрать' }}</span></p>
      <dl class="chart-values">
        <div v-for="metric in chartMetrics" :key="metric.id">
          <dt>
            <svg width="24" height="8" aria-hidden="true"><line x1="0" x2="24" y1="4" y2="4" :stroke="metric.color" :stroke-dasharray="metric.dash" stroke-width="3" /></svg>
            <span class="metric-full">{{ metric.label }}</span><abbr class="metric-short" :title="metric.label">{{ metric.shortLabel }}</abbr>
          </dt>
          <dd>{{ formatPercentage(activeItem[metric.id]) }}</dd>
        </div>
      </dl>
      <p class="critical-legend">◆ — критический день: смена знака биоритма.</p>
    </div>
  </div>
</template>

<style scoped>
.chart-view { display: flex; flex: 1; flex-direction: column; min-width: 0; min-height: 250px; }
.chart-plot { flex: 1; position: relative; min-width: 0; min-height: 160px; background: rgb(24 40 22 / 45%); }
.chart-plot:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
.chart-svg { display: block; width: 100%; height: 100%; position: absolute; inset: 0; cursor: crosshair; }
.chart-axis line { stroke: rgb(255 255 255 / 20%); }
.chart-axis .zero-line { stroke: rgb(255 255 255 / 65%); stroke-dasharray: 4 4; }
.chart-axis text { fill: #fff; font-family: Arial, sans-serif; font-size: 12px; }
.chart-line { fill: none; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.critical-chart-marker { fill: #233220; stroke-width: 2.5; }
.critical-legend { margin: 12px 0 0; font-size: 14px; line-height: 1.4; color: #ffe4af; }
.selected-guide { stroke: #fff; stroke-width: 1; }
.preview-guide { stroke: rgb(255 255 255 / 55%); stroke-dasharray: 3 4; }
.chart-readout { flex: none; padding: 12px 10px; background: rgb(24 40 22 / 65%); }
.chart-date { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; margin: 0 0 10px; font-size: 16px; line-height: 1.3; }
.chart-date span { font-size: 14px; color: #dce5d6; }
.chart-values { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 0; }
.chart-values dt { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; font-size: 15px; line-height: 1.3; overflow-wrap: anywhere; }
.chart-values dt svg { flex: none; }
.chart-values dd { margin: 6px 0 0; font-size: 19px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.metric-short { display: none; text-decoration: none; }
@media (max-width: 1100px) {
  .metric-full { display: none; }
  .metric-short { display: inline; }
}
@media (max-width: 600px) {
  .chart-view { min-height: 290px; }
  .chart-values { gap: 6px; }
  .chart-values dt { gap: 4px; font-size: 14px; }
  .chart-values dt svg { width: 16px; }
  .chart-values dd { font-size: 16px; }
}
</style>
