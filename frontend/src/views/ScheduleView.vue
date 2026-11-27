<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, RouterLink, useRoute, useRouter } from 'vue-router'
import AppNavigation from '../components/AppNavigation.vue'
import AppDialog from '../components/AppDialog.vue'
import AppNotice from '../components/AppNotice.vue'
import TaskTypeIcon from '../components/TaskTypeIcon.vue'
import mobileDivider from '../assets/mobile-divider.svg'
import scheduleDivider from '../assets/schedule-divider.svg'
import { auth, signOut } from '../state/auth.js'
import { isOnline } from '../state/connection.js'
import { createScheduleState } from '../state/schedule.js'
import { getAdjacentPeriodDate, isDateString, localDateString } from '../utils/dates.js'
import { formatScheduleTime, nextScheduledTask, parseScheduleId, scheduleMinutes, weekDates } from '../utils/schedule.js'
import { taskTypes } from '../utils/tasks.js'
import { clockFromMinutes, firstAvailableStart, protectedSlotReason, scheduleSizeError, scheduleWorkIssues, validateScheduleEdit } from '../utils/scheduleEditing.js'
import { adaptationUnavailable } from '../utils/scheduleAdaptation.js'

const route = useRoute()
const router = useRouter()
const sessionEnded = ref(false)
const { state, displayedItems, dirty, changes, editValidation, open, generate, loadTasks, loadSettings, loadAdvice, dispose,
  beginEdit, placeItem, removeItem, cancelEdit, saveEdit, discardLocal, adaptRemainder } = createScheduleState({
  userId: auth.user.id,
  getToken: () => auth.token,
  onUnauthorized: () => {
    sessionEnded.value = true
    signOut()
    auth.notice = 'Сессия истекла. Войдите снова, чтобы открыть расписание.'
    return router.replace({ name: 'login' })
  },
})

const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'full', timeZone: 'UTC' })
const dayFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'UTC' })
const monthFormat = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const weekdayFormat = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' })
const asDate = date => new Date(date + 'T12:00:00Z')
const previousWeek = computed(() => getAdjacentPeriodDate(state.date, 'week', -1))
const nextWeek = computed(() => getAdjacentPeriodDate(state.date, 'week', 1))
const days = computed(() => weekDates(state.date))
const taskById = computed(() => new Map(state.tasks.items.map(task => [task.id, task])))
const reasonById = computed(() => new Map(state.advice.items.map(item => [item.task_id, item.reason.trim()])))
const settings = computed(() => state.settings.values)
const lunch = computed(() => settings.value && ({
  item_type: 'lunch', id: 'lunch', start_time: settings.value.lunch_start, end_time: settings.value.lunch_end,
}))
const slots = computed(() => lunch.value
  ? [...displayedItems.value, lunch.value].sort((left, right) => scheduleMinutes(left.start_time) - scheduleMinutes(right.start_time))
  : displayedItems.value)
const workIssues = computed(() => settings.value ? scheduleWorkIssues(displayedItems.value, settings.value) : [])
const unplaced = computed(() => {
  const placedIds = new Set(displayedItems.value.map(item => item.task_id))
  const unscheduledIds = state.draft === null && !state.localItems && state.unscheduledIds && new Set(state.unscheduledIds)
  return state.tasks.items.filter(task => task.status === 'planned' && !placedIds.has(task.id)
    && (!unscheduledIds || unscheduledIds.has(task.id)))
})
const hasScheduledTasks = computed(() => displayedItems.value.some(item => item.item_type === 'task'))
const timeEditor = ref(null)
const reviewOpen = ref(false)
const calendarOpen = ref(false)
const generationOpen = ref(false)
const expandedUnplaced = reactive(new Set())
const clock = ref(new Date())
const nextTask = computed(() => state.tasks.status === 'ready'
  ? nextScheduledTask(state.plan, taskById.value, clock.value) : null)
const generatedDate = ref('')
const dismissedReminder = ref(null)
const dueReminder = computed(() => {
  const upcoming = nextTask.value
  if (!upcoming || upcoming.id === dismissedReminder.value || !isOnline.value) return null
  const cutoff = new Date(clock.value.getTime() + 15 * 60_000)
  return nextScheduledTask(state.plan, taskById.value, cutoff)?.id === upcoming.id ? null : upcoming
})
const busy = computed(() => state.saving || state.adapting)
const editsUnavailable = computed(() => !isOnline.value || state.generating || busy.value || state.tasks.status !== 'ready' || state.settings.status !== 'ready')
const adaptationReason = computed(() => settings.value ? adaptationUnavailable(state.date, clock.value, settings.value) : '')
const frozenKeys = computed(() => new Set(state.adaptation?.frozenKeys ?? []))
let clockInterval
function refreshClock() { clock.value = new Date() }
const editedTask = computed(() => taskById.value.get(timeEditor.value?.task_id))
const editedDuration = computed(() => timeEditor.value?.item_type === 'break' ? settings.value.break_duration_min : editedTask.value?.duration_min ?? 0)
const candidate = computed(() => timeEditor.value && ({
  item_type: timeEditor.value.item_type, task_id: timeEditor.value.task_id,
  start_time: timeEditor.value.start_time,
  end_time: clockFromMinutes(scheduleMinutes(timeEditor.value.start_time) + editedDuration.value),
}))
const placementError = computed(() => {
  if (!candidate.value) return ''
  if (!timeEditor.value.key && state.draft) {
    const sizeError = scheduleSizeError(state.draft.length + 1)
    if (sizeError) return sizeError
  }
  if (!candidate.value.start_time) return 'Укажите свободное время начала.'
  if (scheduleMinutes(candidate.value.start_time) + editedDuration.value > scheduleMinutes(settings.value.work_end)) {
    return 'Блок не помещается до окончания рабочего дня в ' + formatScheduleTime(settings.value.work_end) + '.'
  }
  const otherItems = state.draft?.filter(item => item.key !== timeEditor.value.key) ?? []
  return validateScheduleEdit([...otherItems, candidate.value], state.tasks.items, state.plan?.items,
    { settings: settings.value, candidate: candidate.value }).errors[0] ?? ''
})

function routeSelection() {
  const id = parseScheduleId(route.query.id)
  return { id, date: isDateString(route.query.date) ? route.query.date : (id ? undefined : localDateString()) }
}

watch(() => [route.name, route.query.date, route.query.id], () => {
  if (route.name === 'schedule') open(routeSelection())
}, { immediate: true })
watch(() => state.draft, draft => {
  if (draft === null) { timeEditor.value = null; reviewOpen.value = false }
})
watch(() => state.date, () => { generatedDate.value = '' })
onMounted(() => {
  loadTasks()
  loadSettings()
  clockInterval = window.setInterval(refreshClock, 30000)
  window.addEventListener('beforeunload', beforeUnload)
  window.addEventListener('focus', refreshClock)
  document.addEventListener('visibilitychange', refreshClock)
})
onBeforeUnmount(() => {
  dispose()
  window.clearInterval(clockInterval)
  window.removeEventListener('beforeunload', beforeUnload)
  window.removeEventListener('focus', refreshClock)
  document.removeEventListener('visibilitychange', refreshClock)
})
onBeforeRouteLeave(canLeaveDraft)
onBeforeRouteUpdate((to, from) => to.query.date === from.query.date && to.query.id === from.query.id || canLeaveDraft())

function beforeUnload(event) {
  if (!dirty.value && !busy.value) return
  event.preventDefault()
  event.returnValue = ''
}

function canLeaveDraft() {
  return sessionEnded.value || !busy.value && (!dirty.value || window.confirm('Уйти без сохранения правок расписания? Черновик будет потерян.'))
}

function cancelDraft() {
  if (!dirty.value || window.confirm('Отменить все несохранённые правки расписания?')) cancelEdit()
}

function editTime(item) {
  if (!beginEdit()) return
  const duration = item.item_type === 'break' ? settings.value.break_duration_min : taskById.value.get(item.task_id)?.duration_min ?? 0
  timeEditor.value = {
    key: item.key ?? null, item_type: item.item_type, task_id: item.task_id,
    start_time: item.start_time ? clockFromMinutes(Math.ceil(scheduleMinutes(item.start_time)))
      : firstAvailableStart(displayedItems.value, duration, settings.value),
  }
}

function applyTime() {
  if (!placementError.value && placeItem(candidate.value, timeEditor.value.key)) timeEditor.value = null
}

async function confirmSave() {
  await saveEdit({ local: editValidation.value.localReasons.length > 0 })
}

async function replanDay() {
  refreshClock()
  if (await adaptRemainder()) reviewOpen.value = true
}

function reloadServer() {
  if (!isOnline.value || !canLeaveDraft()) return
  cancelEdit()
  return open(routeSelection(), { force: true })
}

function removeLocalCopy() {
  if (window.confirm('Удалить правки из этого браузера и показать серверное расписание?')) discardLocal()
}

function selectDate(date) {
  if (state.generating || busy.value || !isDateString(date) || date === state.date) return
  return router.replace({ name: 'schedule', query: { date } })
}

async function handleDateInput(event) {
  const input = event.target
  if (isDateString(input.value)) await selectDate(input.value)
  input.value = state.date
}

async function generatePlan() {
  const date = dayFormat.format(asDate(state.date))
  if (!window.confirm('Сгенерировать расписание на ' + date + '? Существующий план на этот день будет заменён целиком.')) return
  const plan = await generate()
  if (plan && route.name === 'schedule') {
    generatedDate.value = plan.date
    router.replace({ name: 'schedule', query: { date: plan.date, id: String(plan.id) } })
  }
}

function slotTitle(slot) {
  if (slot.item_type === 'lunch') return 'Обед'
  if (slot.item_type === 'break') return 'Перерыв'
  return taskById.value.get(slot.task_id)?.title ?? ('Задача №' + slot.task_id)
}

function toggleUnplaced(id) {
  if (expandedUnplaced.has(id)) expandedUnplaced.delete(id)
  else expandedUnplaced.add(id)
}
</script>

<template>
  <section class="schedule-page" aria-labelledby="schedule-title">
    <div class="schedule-layout">
      <AppNavigation class="schedule-navigation" />

      <section class="schedule-main glass-panel" :class="{ 'schedule-main--editing': state.draft !== null, 'schedule-main--expanded': state.planStatus === 'ready' || state.settings.status === 'error' || state.saveError || state.saveNotice }" aria-labelledby="schedule-title" tabindex="0">
        <h1 id="schedule-title">
          <span class="desktop-schedule-title">Календарь и планирование</span>
          <button class="mobile-disclosure" type="button" :aria-expanded="calendarOpen" aria-controls="schedule-calendar" @click="calendarOpen = !calendarOpen">
            Календарь и планирование <span class="disclosure-caret" aria-hidden="true">⌄</span>
          </button>
        </h1>
        <div id="schedule-calendar" class="schedule-calendar" :class="{ 'schedule-calendar--open': calendarOpen }">
          <div class="calendar-controls">
            <p class="month-label">{{ monthFormat.format(asDate(state.date)) }}</p>
            <label class="visually-hidden" for="schedule-date">Дата расписания</label>
            <input
              id="schedule-date" type="date" :value="state.date" min="0001-01-01" max="9999-12-31"
              :disabled="!isOnline || state.generating || busy" @change="handleDateInput"
            />
            <div class="week-controls">
              <button
                type="button" aria-label="Предыдущая неделя" :disabled="!isOnline || state.generating || busy || !previousWeek"
                @click="selectDate(previousWeek)"
              >‹</button>
              <button type="button" :disabled="!isOnline || state.generating || busy" @click="selectDate(localDateString())">Сегодня</button>
              <button
                type="button" aria-label="Следующая неделя" :disabled="!isOnline || state.generating || busy || !nextWeek"
                @click="selectDate(nextWeek)"
              >›</button>
            </div>
          </div>
          <ul class="week-days" aria-label="Дни недели">
            <li v-for="day in days" :key="day">
              <button
                type="button" :aria-label="dateFormat.format(asDate(day))" :aria-pressed="day === state.date"
                :disabled="!isOnline || state.generating || busy" @click="selectDate(day)"
              >
                <span aria-hidden="true">{{ weekdayFormat.format(asDate(day)) }}</span>
                <time :datetime="day" aria-hidden="true">{{ Number(day.slice(-2)) }}</time>
              </button>
            </li>
          </ul>
        </div>

        <div v-if="state.draft === null" class="schedule-generator">
          <button class="mobile-disclosure" type="button" :aria-expanded="generationOpen" aria-controls="schedule-generation" @click="generationOpen = !generationOpen">
            Создать интеллектуальное расписание <span class="disclosure-caret" aria-hidden="true">⌄</span>
          </button>
          <div id="schedule-generation" class="schedule-generation" :class="{ 'schedule-generation--open': generationOpen }">
            <button
              class="generate-button" type="button" :disabled="!isOnline || state.generating || busy || state.planStatus === 'loading' || state.settings.status !== 'ready'"
              @click="generatePlan"
            >
              <span v-if="state.generating">Составляем расписание…</span>
              <template v-else>
                <span class="desktop-generate-label">Создать интеллектуальное расписание</span>
                <span class="mobile-generate-label">Сгенерировать расписание</span>
              </template>
            </button>
            <AppNotice v-if="state.generationError" class="generation-error" kind="error" @dismiss="state.generationError = ''">{{ state.generationError }}</AppNotice>
          </div>
        </div>

        <section class="schedule-results glass-panel glass-panel--inset" :class="{ 'schedule-results--mobile-empty': state.planStatus === 'missing' && state.settings.status === 'ready' && !state.planError && !generationOpen }"
          aria-labelledby="day-title" :aria-busy="state.planStatus === 'loading' || state.generating || busy">
          <h2 id="day-title">{{ state.draft !== null ? 'Черновик на ' : 'Расписание на ' }}<time :datetime="state.date">{{ dayFormat.format(asDate(state.date)) }}</time></h2>
          <AppNotice v-if="generatedDate === state.date && state.planStatus === 'ready'" kind="success" @dismiss="generatedDate = ''">Расписание составлено</AppNotice>
          <section v-if="state.planStatus === 'ready'" class="next-task" aria-labelledby="next-task-title">
            <h3 id="next-task-title">Ближайшая задача по серверному плану</h3>
            <AppNotice v-if="dueReminder" class="task-reminder" kind="reminder" @dismiss="dismissedReminder = dueReminder.id">
              Скоро начнётся «{{ slotTitle(dueReminder) }}»
              <p><time :datetime="dueReminder.start_time">{{ formatScheduleTime(dueReminder.start_time) }}</time> (Екатеринбург)</p>
              <p v-if="reasonById.get(dueReminder.task_id)">{{ reasonById.get(dueReminder.task_id) }}</p>
            </AppNotice>
            <div v-else role="status">
              <p v-if="nextTask">
                <time :datetime="nextTask.start_time">{{ formatScheduleTime(nextTask.start_time) }}</time>
                <span> (Екатеринбург) · {{ slotTitle(nextTask) }}</span>
              </p>
              <p v-else-if="state.tasks.status === 'loading'">Проверяем список задач…</p>
              <p v-else-if="state.tasks.status === 'error'">Не удалось определить ближайшую задачу.</p>
              <p v-else>На выбранную дату предстоящих задач нет.</p>
            </div>
          </section>
          <p v-if="state.settings.status === 'loading'" class="workday-note" role="status">Загрузка настроек рабочего дня…</p>
          <div v-else-if="state.settings.status === 'error'" class="schedule-feedback editor-feedback error">
            <p role="alert">Настройки рабочего дня недоступны. {{ state.settings.error }}</p>
            <button type="button" @click="loadSettings">Повторить загрузку настроек</button>
          </div>
          <div v-if="workIssues.length" class="schedule-feedback editor-feedback" role="status">
            <p>Некоторые блоки расписания не подходят к текущим настройкам.</p>
            <ul class="workday-issues"><li v-for="issue in workIssues" :key="issue">{{ issue }}</li></ul>
          </div>
          <div v-if="state.planStatus === 'ready'" class="schedule-edit-toolbar" aria-label="Редактирование расписания">
            <template v-if="state.draft === null">
              <button type="button" :disabled="editsUnavailable" @click="beginEdit">Изменить расписание</button>
              <button type="button" :disabled="editsUnavailable || Boolean(adaptationReason)" :aria-describedby="adaptationReason ? 'adaptation-availability' : undefined" @click="replanDay">{{ state.adapting ? 'Пересчитываем…' : 'Перепланировать остаток дня' }}</button>
            </template>
            <template v-else>
              <button v-if="!state.adaptation" type="button" :disabled="busy" @click="editTime({ item_type: 'break', task_id: null })">Добавить перерыв</button>
              <button v-else type="button" :disabled="!isOnline || busy || Boolean(adaptationReason) || state.saveConflict" @click="replanDay">{{ state.adapting ? 'Пересчитываем…' : 'Пересчитать заново' }}</button>
              <button type="button" :disabled="busy" @click="cancelDraft">Отменить правки</button>
              <button class="primary" type="button" :disabled="busy || !dirty && !state.adaptation || editValidation.errors.length > 0 || state.saveConflict" @click="reviewOpen = true">Проверить и сохранить</button>
            </template>
          </div>
          <p v-if="state.draft && !state.saveError && !reviewOpen && editValidation.errors.length" class="schedule-feedback editor-feedback error" role="status">{{ editValidation.errors.join(' ') }}</p>
          <p v-if="state.planStatus === 'ready' && state.draft === null && adaptationReason" id="adaptation-availability" class="adaptation-availability">{{ adaptationReason }}</p>
          <p v-if="state.adaptation" class="schedule-feedback editor-feedback" role="status">Остаток дня с {{ state.adaptation.from }} · Сохранено блоков без изменений: {{ state.adaptation.frozenCount }}. Не поместилось задач: {{ state.adaptation.unplaced.length }}. Это черновик.</p>
          <div v-if="state.saveError" class="schedule-feedback editor-feedback error" role="alert">
            <p>{{ state.saveError }}</p>
            <button v-if="state.saveConflict" type="button" :disabled="!isOnline || busy" @click="reloadServer">Загрузить актуальный план</button>
            <button v-else-if="state.adaptationStale" type="button" :disabled="!isOnline || busy || Boolean(adaptationReason)" @click="replanDay">Пересчитать заново</button>
          </div>
          <AppNotice v-if="state.saveNotice && state.localStatus !== 'saved'" kind="success" @dismiss="state.saveNotice = ''">{{ state.saveNotice }}</AppNotice>
          <div v-if="state.localStatus !== 'none'" class="schedule-feedback editor-feedback local-plan-note" role="status">
            <p v-if="state.localStatus === 'saved'">Локальные правки · только этот браузер. На сервере сохранён исходный план.</p>
            <p v-else>Локальные правки устарели или не подходят к текущим задачам и настройкам. Показан серверный план.</p>
            <button type="button" :disabled="busy || state.draft !== null" @click="removeLocalCopy">{{ state.localStatus === 'saved' ? 'Вернуть серверный план' : 'Удалить локальную копию' }}</button>
          </div>
          <p v-if="state.planStatus === 'loading'" class="schedule-feedback" role="status">Загрузка расписания…</p>
          <div v-else-if="state.planStatus === 'error'" class="schedule-feedback error">
            <p role="alert">{{ state.planError }}</p>
            <button type="button" @click="open(routeSelection(), { force: true })">Повторить</button>
          </div>
          <p v-else-if="state.planStatus === 'missing'" class="schedule-feedback" role="status">
            {{ state.planError || 'На этот день в браузере нет сохранённого расписания.' }}
          </p>
          <template v-else>
            <p v-if="state.storageWarning" class="schedule-feedback" role="status">
              Браузер не запомнил план по дате. Для повторного открытия сохраните адрес этой страницы.
            </p>
            <p v-if="!hasScheduledTasks" class="schedule-feedback" role="status">В расписании пока нет задач.</p>
            <div v-if="state.advice.status === 'error'" class="schedule-feedback">
              <p role="status">Рекомендации на день недоступны.</p>
              <button type="button" @click="loadAdvice">Повторить</button>
            </div>
            <ol class="schedule-slots" tabindex="0" aria-label="Элементы расписания">
              <li v-for="(slot, index) in slots" :key="slot.key ?? slot.id">
                <div v-if="index" class="slot-divider" aria-hidden="true"><img :src="scheduleDivider" alt="" /></div>
                <div class="schedule-slot" :class="{ 'schedule-slot--break': slot.item_type !== 'task' }">
                  <p class="slot-time"><time :datetime="slot.start_time">{{ formatScheduleTime(slot.start_time) }}</time>–<time :datetime="slot.end_time">{{ formatScheduleTime(slot.end_time) }}</time></p>
                  <div class="slot-info">
                    <h3>
                      <TaskTypeIcon v-if="slot.item_type === 'task'" :type="taskById.get(slot.task_id)?.type" />
                      <span>{{ slotTitle(slot) }}</span>
                    </h3>
                    <p v-if="reasonById.get(slot.task_id)" class="slot-reason">Почему: {{ reasonById.get(slot.task_id) }}</p>
                    <p v-if="slot.item_type === 'task' && state.tasks.status === 'ready' && protectedSlotReason(slot, state.tasks.items)" class="saved-slot-note">{{ protectedSlotReason(slot, state.tasks.items) }}</p>
                    <p v-if="state.adaptation && frozenKeys.has(slot.key)" class="saved-slot-note">Сохранено без изменений.</p>
                    <div v-if="state.draft !== null && !state.adaptation && slot.item_type !== 'lunch' && !protectedSlotReason(slot, state.tasks.items)" class="slot-actions">
                      <button type="button" :disabled="busy" @click="editTime(slot)">Перенести</button>
                      <button type="button" :disabled="busy" @click="removeItem(slot.key)">{{ slot.item_type === 'break' ? 'Убрать перерыв' : 'Убрать из дня' }}</button>
                    </div>
                  </div>
                </div>
              </li>
            </ol>
          </template>
        </section>
      </section>

      <aside class="schedule-unplaced glass-panel" aria-labelledby="unplaced-title">
        <div class="mobile-divider schedule-mobile-divider"><img :src="mobileDivider" alt="" width="334" height="1" /></div>
        <h2 id="unplaced-title">Неразмещённые задачи</h2>
        <RouterLink class="create-task-link" :to="{ name: 'tasks', query: { new: '1' } }">
          <span aria-hidden="true" class="create-task-plus">+</span> <span>Создать задачу</span>
        </RouterLink>
        <p v-if="state.tasks.status === 'loading'" class="schedule-feedback" role="status">Загрузка задач…</p>
        <div v-else-if="state.tasks.status === 'error'" class="schedule-feedback error">
          <p role="alert">{{ state.tasks.error }}</p>
          <button type="button" @click="loadTasks">Повторить</button>
        </div>
        <p v-else-if="!unplaced.length" class="schedule-feedback" role="status">Нет неразмещённых задач.</p>
        <ul v-else class="unplaced-list" tabindex="0" aria-label="Список неразмещённых задач">
          <li v-for="task in unplaced" :key="task.id">
            <h3 class="unplaced-title-desktop">{{ task.title }}</h3>
            <h3 class="unplaced-title-mobile">
              <button class="unplaced-toggle" type="button" :aria-expanded="expandedUnplaced.has(task.id)"
                :aria-controls="'unplaced-details-' + task.id" @click="toggleUnplaced(task.id)">
                {{ task.title }} <span class="disclosure-caret" aria-hidden="true">⌄</span>
              </button>
            </h3>
            <div :id="'unplaced-details-' + task.id" class="unplaced-details" :class="{ 'unplaced-details--open': expandedUnplaced.has(task.id) }">
              <p class="unplaced-type"><TaskTypeIcon :type="task.type" /> <span>{{ taskTypes[task.type] }} · {{ task.duration_min }} мин</span></p>
              <p v-if="state.adaptation">{{ state.adaptation.unplaced.find(item => item.task_id === task.id)?.reason }}</p>
              <button v-if="state.planStatus === 'ready' && !state.adaptation" type="button" :disabled="editsUnavailable" @click="editTime({ item_type: 'task', task_id: task.id })">Разместить вручную</button>
            </div>
          </li>
        </ul>
        <div class="mobile-divider schedule-mobile-divider schedule-mobile-divider--bottom"><img :src="mobileDivider" alt="" width="334" height="1" /></div>
      </aside>
    </div>

    <AppDialog v-if="timeEditor && settings" :title="timeEditor.item_type === 'break' ? 'Время перерыва' : 'Время задачи'" @close="timeEditor = null">
      <form class="time-editor" novalidate @submit.prevent="applyTime">
        <p>{{ editedTask?.title ?? 'Перерыв' }} · {{ editedDuration }} мин</p>
        <label for="schedule-slot-start">Начало</label>
        <input id="schedule-slot-start" v-model="timeEditor.start_time" type="time" :min="clockFromMinutes(Math.ceil(scheduleMinutes(settings.work_start)))" :max="clockFromMinutes(Math.floor(scheduleMinutes(settings.work_end)))" step="60" required autofocus :aria-invalid="Boolean(placementError)" aria-describedby="slot-placement-note" />
        <p>Окончание: <strong>{{ candidate?.end_time || '—' }}</strong>. Обед {{ formatScheduleTime(settings.lunch_start) }}–{{ formatScheduleTime(settings.lunch_end) }}.</p>
        <p id="slot-placement-note" :class="{ 'dialog-error': placementError }" :role="placementError ? 'alert' : undefined">{{ placementError || 'Изменение добавится в черновик. Остальные блоки сохранят своё время.' }}</p>
        <div class="dialog-actions">
          <button type="button" @click="timeEditor = null">Отмена</button>
          <button class="primary" type="submit" :disabled="Boolean(placementError)">Добавить в черновик</button>
        </div>
      </form>
    </AppDialog>

    <AppDialog v-if="reviewOpen" :title="state.adaptation ? 'Перепланирование остатка дня' : 'Проверка правок расписания'" :busy="busy" @close="reviewOpen = false">
      <p>{{ dayFormat.format(asDate(state.date)) }}</p>
      <template v-if="state.adaptation">
        <p>Перерасчёт с {{ state.adaptation.from }}. Прошедшие блоки, текущая задача и история сохранены. Учтены приоритеты, сроки и настройки рабочего дня.</p>
        <h3>Изменения</h3>
        <p v-if="!changes.length">Расписание уже подходит для остатка дня. Изменений нет.</p>
      </template>
      <ul class="change-list">
        <li v-for="(change, index) in changes" :key="index"><strong>{{ change.label }}</strong><span>{{ change.before }} → {{ change.after }}</span></li>
      </ul>
      <template v-if="state.adaptation">
        <h3>Не поместились · {{ state.adaptation.unplaced.length }}</h3>
        <ul v-if="state.adaptation.unplaced.length" class="change-list">
          <li v-for="item in state.adaptation.unplaced" :key="item.task_id"><strong>{{ taskById.get(item.task_id)?.title }}</strong><span>{{ item.reason }}</span></li>
        </ul>
        <p v-else>Все оставшиеся задачи размещены.</p>
        <div v-if="state.adaptation.deadlineWarnings.length" class="local-save-note">
          <h3>Обратите внимание на сроки</h3>
          <ul><li v-for="item in state.adaptation.deadlineWarnings" :key="item.task_id">«{{ taskById.get(item.task_id)?.title }}»: {{ item.reason }}</li></ul>
        </div>
      </template>
      <div v-if="editValidation.localReasons.length" class="local-save-note">
        <p>Некоторые сохранённые блоки нельзя отправить на сервер вместе с правками:</p>
        <ul><li v-for="reason in editValidation.localReasons" :key="reason">{{ reason }}</li></ul>
        <p>Правки можно сохранить только в этом браузере. Они будут отмечены на экране. Серверное расписание останется прежним.</p>
      </div>
      <p v-for="error in editValidation.errors" :key="error" class="dialog-error" role="alert">{{ error }}</p>
      <AppNotice v-if="state.saveError" kind="error" :dismissible="false">{{ state.saveError }}</AppNotice>
      <p v-if="!isOnline" class="local-save-note" role="status">Для проверки и сохранения правок нужна сеть.</p>
      <div class="dialog-actions">
        <button type="button" :disabled="busy" @click="reviewOpen = false">Вернуться к черновику</button>
        <button v-if="state.saveConflict" type="button" :disabled="!isOnline || busy" @click="reloadServer">Загрузить актуальный план</button>
        <button v-else-if="state.adaptationStale" type="button" :disabled="!isOnline || busy || Boolean(adaptationReason)" @click="replanDay">Пересчитать заново</button>
        <button v-else class="primary" type="button" :disabled="!isOnline || busy || !dirty || editValidation.errors.length > 0" @click="confirmSave">{{ state.saving ? 'Сохраняем…' : editValidation.localReasons.length ? 'Сохранить в этом браузере' : 'Сохранить расписание' }}</button>
      </div>
    </AppDialog>
  </section>
</template>

<style scoped>
.schedule-page {
  position: relative;
  isolation: isolate;
  width: 100%;
  min-height: 100svh;
  color: #fff;
  font: 20px/1.3 'Times New Roman', serif;
  --control-green: #40523d;
}
.schedule-layout {
  display: grid;
  grid-template: 'navigation main' calc(32px + var(--app-navigation-height)) 'unplaced main' 1fr / var(--desktop-layout-columns);
  gap: var(--navigation-content-gap) var(--desktop-layout-column-gap);
  max-width: var(--desktop-layout-width);
  margin: 0 auto;
  padding-block: 29px 0;
  padding-inline: var(--desktop-layout-padding-inline);
}
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
button, input, .create-task-link {
  min-width: 0;
  min-height: 44px;
  padding: 8px 12px;
  border: 0;
  border-radius: 0;
  background: var(--control-green);
  color: inherit;
  font: inherit;
}
button, .create-task-link { cursor: pointer; text-align: center; text-decoration: none; }
button:disabled { opacity: 0.7; cursor: not-allowed; }
button:not(:disabled):hover, .create-task-link:hover { background: #354730; }
button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
.schedule-navigation {
  grid-area: navigation;
  align-self: end;
  justify-self: center;
}
.schedule-main {
  grid-area: main;
  min-width: 0;
  min-height: calc(100svh - 29px);
  padding: 32px clamp(20px, 2.1vw, 30px) 40px;
}
.schedule-main h1, .schedule-unplaced h2 {
  margin: 0;
  font-size: clamp(27px, 2.78vw, 40px);
  font-weight: 400;
  line-height: 1.15;
  text-align: center;
  overflow-wrap: anywhere;
}
.schedule-main h1 {
  display: grid;
  place-items: center;
  min-height: 85px;
  padding: 10px;
  background: var(--surface-action);
}
.schedule-calendar {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 11fr);
  align-items: center;
  gap: 22px;
  min-height: 197px;
  margin-top: 56px;
  padding: 20px 26px;
  background: var(--surface-action);
}
.calendar-controls { display: grid; gap: 8px; }
.month-label { margin: 0; font-size: clamp(23px, 2.3vw, 33px); }
.month-label::first-letter { text-transform: uppercase; }
.calendar-controls input {
  width: 100%;
  max-width: 100%;
  border: 1px solid rgb(255 255 255 / 45%);
  color-scheme: dark;
}
.week-controls { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; gap: 4px; }
.week-controls button { padding-inline: 5px; }
.week-controls button[aria-label] { font-size: 25px; }
.week-days, .unplaced-list, .schedule-slots { margin: 0; padding: 0; list-style: none; }
.week-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; }
.week-days button { display: grid; gap: 8px; width: 100%; padding: 7px 0; background: transparent; }
.week-days span { text-transform: capitalize; }
.week-days time { font-size: clamp(20px, 2.15vw, 31px); }
.week-days button[aria-pressed='true'] { background: #354730; box-shadow: inset 0 0 0 1px #fff; }
.schedule-generator { margin-top: 26px; }
.mobile-disclosure, .mobile-generate-label, .unplaced-title-mobile { display: none; }
.generate-button {
  width: 100%;
  min-height: 81px;
  margin: 0;
  background: var(--surface-control);
  font-size: clamp(22px, 2.45vw, 35px);
}
.schedule-results {
  min-height: 360px;
  margin-top: 31px;
  padding: 24px 26px;
}
.schedule-results h2 { margin: 0 0 16px; font-size: clamp(20px, 1.9vw, 27px); font-weight: 400; overflow-wrap: anywhere; }
.next-task { flex: none; margin: 0 0 12px; padding: 10px 12px; background: var(--control-green); font-size: 18px; overflow-wrap: anywhere; }
.next-task h3 { margin: 0; font: inherit; font-weight: 700; }
.next-task p { margin: 4px 0 0; }
.generation-error, .task-reminder { margin-block-start: 12px; }
.schedule-feedback { margin: 12px 0 0; padding: 12px; background: var(--control-green); overflow-wrap: anywhere; }
.schedule-feedback p { margin: 0 0 8px; }
.schedule-feedback.error { background: #693d35; }
.workday-note { flex: none; margin: 0 0 12px; font-size: 17px; overflow-wrap: anywhere; }
.workday-issues { margin: 0; padding-inline-start: 22px; }
.slot-divider { display: flex; align-items: center; height: 5px; overflow: hidden; }
.slot-divider img { display: block; flex: none; transform: rotate(0.3deg); }
.schedule-slot {
  display: grid;
  grid-template-columns: minmax(132px, 1fr) minmax(0, 3fr);
  align-items: center;
  gap: 16px;
  min-height: 112px;
  padding: 16px 4px;
}
.schedule-slot--break { min-height: 64px; }
.slot-time { margin: 0; font-size: clamp(20px, 2.1vw, 30px); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.slot-info { min-width: 0; overflow-wrap: anywhere; }
.slot-info h3, .unplaced-list h3 { margin: 0; font-size: clamp(22px, 2.4vw, 34px); font-weight: 400; }
.slot-info h3 { display: flex; align-items: center; gap: 10px; line-height: 1.15; }
.schedule-slot--break h3 { font-size: 20px; }
.slot-info p { margin: 6px 0 0; font-size: 18px; }
.slot-info .slot-reason { max-width: 65ch; }
.schedule-unplaced {
  grid-area: unplaced;
  min-width: 0;
  min-height: max(420px, calc(100svh - 61px - var(--app-navigation-height) - var(--navigation-content-gap)));
  padding: 30px clamp(20px, 2.3vw, 33px) 40px;
}
.create-task-link {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 99px;
  margin-top: 65px;
  background: var(--surface-control);
  font-size: clamp(22px, 2.45vw, 35px);
}
.unplaced-list { display: grid; gap: 24px; margin-top: 42px; }
.unplaced-list li {
  display: grid;
  align-content: center;
  gap: 12px;
  min-height: 148px;
  padding: 16px;
  background: var(--surface-control);
  overflow-wrap: anywhere;
  text-align: center;
}
.unplaced-list p { margin: 0; }
.unplaced-details { display: grid; gap: 8px; }
.unplaced-type { display: flex; align-items: center; justify-content: center; gap: 8px; }
.schedule-edit-toolbar, .slot-actions, .dialog-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.schedule-edit-toolbar { flex: none; margin-bottom: 12px; }
.schedule-edit-toolbar button, .slot-actions button, .editor-feedback button, .unplaced-list button, .dialog-actions button { min-height: 44px; font-size: 17px; }
.slot-actions { margin-top: 12px; }
.primary { background: #e4ecd7; color: #283f28; }
button.primary:not(:disabled):hover { background: #cfdcbe; }
.editor-feedback { flex: none; max-height: min(25svh, 160px); margin: 0 0 12px; overflow: auto; }
.adaptation-availability { flex: none; margin: 0 0 12px; font-size: 17px; overflow-wrap: anywhere; }
.local-plan-note { border-left: 4px solid #e4d8a3; }
.saved-slot-note { color: #e0e8d6; }
.time-editor { display: grid; gap: 12px; }
.time-editor p { margin: 0; overflow-wrap: anywhere; }
.time-editor input { width: 100%; border: 1px solid rgb(255 255 255 / 60%); color-scheme: dark; }
.dialog-actions { margin-top: 20px; }
.dialog-error { margin: 12px 0 0; padding: 12px; background: #693d35; overflow-wrap: anywhere; }
.change-list { display: grid; gap: 12px; padding: 0; list-style: none; }
.change-list li { display: grid; gap: 6px; padding: 12px; background: #40523d; overflow-wrap: anywhere; }
.local-save-note { padding: 12px; border-left: 4px solid #e4d8a3; background: #40523d; overflow-wrap: anywhere; }
.unplaced-list { grid-auto-rows: max-content; }
.schedule-main:focus-visible, .schedule-slots:focus-visible, .unplaced-list:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }

@media (min-width: 901px) {
  .schedule-layout { height: 100svh; grid-template-rows: calc(32px + var(--app-navigation-height)) minmax(0, 1fr); }
  .schedule-main, .schedule-unplaced, .schedule-results { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
  .schedule-main > h1, .schedule-calendar, .schedule-generator,
  .schedule-results > h2, .schedule-results > .schedule-feedback,
  .schedule-unplaced > h2, .create-task-link, .schedule-unplaced > .schedule-feedback { flex: none; }
  .schedule-results { flex: 1; }
  .schedule-slots, .unplaced-list { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
  .unplaced-list { align-content: start; }
  .schedule-main--editing .schedule-calendar { min-height: 0; margin-top: 24px; padding: 16px; }
  .schedule-main--editing .schedule-results { margin-top: 24px; }
}
@media (min-width: 901px) and (max-height: 800px) {
  .schedule-calendar { min-height: 0; margin-top: 24px; padding: 16px; }
  .schedule-generator { margin-top: 16px; }
  .generate-button { min-height: 56px; font-size: 26px; }
  .schedule-results { margin-top: 16px; padding: 16px; }
  .schedule-unplaced { padding: 24px 20px; }
  .create-task-link { min-height: 56px; margin-top: 24px; font-size: 26px; }
  .unplaced-list { margin-top: 24px; }
}
@media (min-width: 901px) and (max-height: 900px) {
  .schedule-main--expanded { overflow: auto; overscroll-behavior: contain; }
  .schedule-main--expanded .schedule-results { flex: none; min-height: 360px; overflow: visible; }
  .schedule-main--expanded .schedule-slots { flex: none; overflow: visible; }
}
@media (min-width: 901px) and (max-height: 650px) {
  .schedule-main { overflow: auto; overscroll-behavior: contain; }
  .schedule-results { flex: none; min-height: 240px; overflow: visible; }
  .schedule-slots { flex: none; overflow: visible; }
}

@media (min-width: 901px) and (max-width: 1160px) {
  .schedule-calendar { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 900px) {
  .schedule-layout {
    --mobile-gutter: clamp(12px, 5.34vw, 22px);
    grid-template: 'navigation' auto 'main' auto 'unplaced' auto / minmax(0, 1fr);
    gap: 0;
    padding: 0 var(--mobile-gutter) 24px;
  }
  .schedule-navigation { width: auto; margin: 0 calc(-1 * var(--mobile-gutter)) 29px; justify-self: stretch; }
  .schedule-main, .schedule-unplaced {
    min-height: 0;
    padding: 16px;
    box-shadow: none;
    border-inline: 1px solid rgb(255 255 255 / 20%);
  }
  .schedule-main { border-top: 1px solid rgb(255 255 255 / 20%); }
  .schedule-unplaced { padding-bottom: 28px; border-bottom: 1px solid rgb(255 255 255 / 20%); }
  .schedule-main h1 { min-height: 0; padding: 0; }
  .desktop-schedule-title, .desktop-generate-label, .schedule-results--mobile-empty, .unplaced-title-desktop { display: none; }
  .mobile-disclosure {
    position: relative;
    display: block;
    width: 100%;
    min-height: 124px;
    padding: 12px 32px 16px;
    background: var(--surface-action);
    font-size: clamp(23px, 7vw, 30px);
    line-height: 1.12;
    overflow-wrap: anywhere;
  }
  .mobile-disclosure:focus-visible, .unplaced-toggle:focus-visible { outline-offset: -3px; }
  .disclosure-caret { position: absolute; right: 9px; bottom: 6px; font-size: 26px; line-height: 1; }
  button[aria-expanded='true'] .disclosure-caret { rotate: 180deg; }
  .schedule-calendar { min-height: 0; margin-top: 16px; padding: 12px; }
  .schedule-calendar:not(.schedule-calendar--open), .schedule-generation:not(.schedule-generation--open) { display: none; }
  .schedule-generator { margin-top: clamp(22px, 15vw, 62px); }
  .schedule-generation { margin-top: 8px; }
  .generate-button { min-height: 52px; font-size: 22px; }
  .mobile-generate-label { display: inline; }
  .schedule-results { min-height: 0; margin-top: 16px; padding: 14px; }
  .schedule-mobile-divider { margin: 10px 0 clamp(28px, 10vw, 44px); }
  .schedule-mobile-divider--bottom { margin: 24px 0 0; }
  .schedule-unplaced h2, .create-task-link { font-size: clamp(23px, 7.3vw, 30px); }
  .create-task-link { min-height: 55px; margin-top: clamp(18px, 9vw, 38px); padding-inline: 38px; background: var(--surface-action); }
  .create-task-plus { position: absolute; right: 15px; }
  .schedule-slots { max-height: clamp(280px, 50svh, 520px); overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
  .slot-divider img { width: 100%; height: 1px; transform: none; }
  .unplaced-list { margin-top: clamp(18px, 9.5vw, 39px); gap: clamp(16px, 8.6vw, 36px); max-height: clamp(320px, 60svh, 600px); overflow: auto; overscroll-behavior: contain; }
  .unplaced-list li { min-height: 0; gap: 0; padding: 0; background: var(--surface-action); }
  .unplaced-title-mobile { display: block; }
  .unplaced-list .unplaced-toggle {
    position: relative;
    width: 100%;
    min-height: 55px;
    padding-inline: 25px;
    background: transparent;
    font-size: clamp(23px, 7vw, 30px);
    line-height: 1.12;
    overflow-wrap: anywhere;
  }
  .unplaced-details { display: none; }
  .unplaced-details--open { display: grid; padding: 0 12px 12px; }
}
@media (max-width: 620px) {
  .schedule-calendar { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .schedule-slot { grid-template-columns: minmax(0, 1fr); gap: 4px; min-height: 0; }
}
</style>
