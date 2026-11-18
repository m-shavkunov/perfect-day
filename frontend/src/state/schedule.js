import { computed, reactive } from 'vue'
import { getRecommendations } from '../api/recommendations.js'
import { generateSchedule, getSchedule, updateSchedule } from '../api/schedules.js'
import { getTasks } from '../api/tasks.js'
import { localDateString } from '../utils/dates.js'
import { getPlanningStorage } from '../utils/planningPreferences.js'
import { forgetScheduleId, readScheduleId, rememberScheduleId } from '../utils/schedule.js'
import { adaptScheduleRemainder, adaptationTasksFingerprint, staleAdaptationReason } from '../utils/scheduleAdaptation.js'
import {
  clearLocalSchedule, draftScheduleItems, protectedSlotReason, readLocalSchedule,
  sameScheduleItems, saveLocalSchedule, scheduleChanges, scheduleFingerprint, validateScheduleEdit,
} from '../utils/scheduleEditing.js'

export function createScheduleState({ userId, getToken, onUnauthorized, storage = getPlanningStorage(), getNow = () => new Date() }) {
  const state = reactive({
    date: localDateString(), plan: null, planStatus: 'loading', planError: '',
    generating: false, generationError: '', storageWarning: false, unscheduledIds: null,
    tasks: { items: [], status: 'loading', error: '' },
    advice: { items: [], status: 'idle', error: '' },
    draft: null, initialDraft: null, saving: false, saveError: '', saveNotice: '', saveConflict: false,
    localItems: null, localStatus: 'none',
    adapting: false, adaptation: null, adaptationStale: false,
  })
  const displayedItems = computed(() => state.draft ?? state.localItems ?? state.plan?.items ?? [])
  const dirty = computed(() => state.draft !== null && !sameScheduleItems(state.draft, state.initialDraft))
  const changes = computed(() => state.draft === null ? [] : scheduleChanges(state.initialDraft, state.draft, state.tasks.items))
  const editValidation = computed(() => state.draft === null ? { errors: [], localReasons: [] }
    : validateScheduleEdit(state.draft, state.tasks.items, state.plan.items))
  let addedItemNumber = 0
  let selection
  let taskRequest
  let adviceRequest
  let disposed = false

  function dispose() {
    disposed = true
    selection?.controller.abort()
    taskRequest?.controller.abort()
    adviceRequest?.controller.abort()
  }

  function unauthorized() {
    if (disposed) return
    dispose()
    onUnauthorized()
  }

  function newRequest() {
    const token = getToken()
    if (token) return { token, controller: new AbortController() }
    unauthorized()
    return null
  }

  function isCurrent(request, active) {
    return !disposed && request === active && !request.controller.signal.aborted && getToken() === request.token
  }

  async function loadTasks() {
    if (disposed) return
    taskRequest?.controller.abort()
    const request = taskRequest = newRequest()
    if (!request) return
    state.tasks.status = 'loading'
    state.tasks.error = ''
    try {
      const items = await getTasks({ userId, token: request.token, signal: request.controller.signal })
      if (!isCurrent(request, taskRequest)) return
      state.tasks.items = items
      state.tasks.status = 'ready'
      restoreLocal()
    } catch (error) {
      if (!isCurrent(request, taskRequest)) return
      if (error.status === 401 || error.status === 403) {
        unauthorized()
        return
      }
      state.tasks.status = 'error'
      state.tasks.error = error.message
    }
  }

  async function loadAdvice() {
    if (disposed || !state.plan || state.advice.status === 'loading') return
    const request = adviceRequest = newRequest()
    if (!request) return
    const date = state.plan.date
    state.advice.status = 'loading'
    state.advice.error = ''
    try {
      const result = await getRecommendations({ targetDate: date, token: request.token, signal: request.controller.signal })
      if (!isCurrent(request, adviceRequest)) return
      state.advice.items = result.items
      state.advice.status = 'ready'
    } catch (error) {
      if (!isCurrent(request, adviceRequest)) return
      if (error.status === 401 || error.status === 403) {
        unauthorized()
        return
      }
      state.advice.status = 'error'
      state.advice.error = error.message
    }
  }

  function clearAdvice() {
    adviceRequest?.controller.abort()
    state.advice = { items: [], status: 'idle', error: '' }
  }

  function resetDraft() {
    state.draft = null
    state.initialDraft = null
    state.saveError = ''
    state.saveConflict = false
    state.adaptation = null
    state.adaptationStale = false
  }

  function restoreLocal() {
    if (!state.plan || state.tasks.status !== 'ready') return
    const local = readLocalSchedule(storage, state.plan)
    if (local.items && validateScheduleEdit(local.items, state.tasks.items, state.plan.items).errors.length) {
      local.status = 'invalid'
      local.items = null
    }
    state.localStatus = local.status
    state.localItems = local.items
  }

  function showPlan(plan, unscheduledIds) {
    state.date = plan.date
    state.plan = plan
    state.planStatus = 'ready'
    state.unscheduledIds = unscheduledIds
    state.storageWarning = !rememberScheduleId(storage, userId, plan.date, plan.id)
    resetDraft()
    state.localItems = null
    state.localStatus = 'none'
    state.saveNotice = ''
    restoreLocal()
    clearAdvice()
    if (plan.items.some(item => item.item_type === 'task')) loadAdvice()
  }

  async function open({ date, id: directId = null }, { force = false } = {}) {
    if (disposed) return
    const id = directId ?? readScheduleId(storage, userId, date)
    if (!force && id && state.plan?.id === id && (!date || date === state.plan.date)) return

    selection?.controller.abort()
    const request = selection = newRequest()
    if (!request) return
    state.date = date || localDateString()
    state.plan = null
    state.planStatus = id ? 'loading' : 'missing'
    state.planError = ''
    state.generating = false
    state.generationError = ''
    state.storageWarning = false
    state.unscheduledIds = null
    resetDraft()
    state.saving = false
    state.adapting = false
    state.localItems = null
    state.localStatus = 'none'
    state.saveNotice = ''
    clearAdvice()
    if (!id) return

    try {
      const plan = await getSchedule({ id, date, userId, token: request.token, signal: request.controller.signal })
      if (isCurrent(request, selection)) showPlan(plan, null)
    } catch (error) {
      if (!isCurrent(request, selection)) return
      if (error.status === 401 || error.status === 403) {
        unauthorized()
      } else if (error.status === 404) {
        if (date) forgetScheduleId(storage, userId, date, id)
        state.planStatus = 'missing'
        state.planError = 'Сохранённое расписание недоступно.'
      } else {
        state.planStatus = 'error'
        state.planError = error.message
      }
    }
  }

  async function generate() {
    const request = selection
    if (!request || !isCurrent(request, selection) || state.generating || state.saving || state.adapting || state.draft !== null || state.planStatus === 'loading') return null
    state.generating = true
    state.generationError = ''
    const date = state.date
    try {
      const result = await generateSchedule({ date, userId, token: request.token, signal: request.controller.signal })
      if (!isCurrent(request, selection)) return null
      state.planError = ''
      showPlan(result.schedule, result.unscheduledIds)
      loadTasks()
      return result.schedule
    } catch (error) {
      if (!isCurrent(request, selection)) return null
      if (error.status === 401 || error.status === 403) unauthorized()
      else state.generationError = error.message
      return null
    } finally {
      if (isCurrent(request, selection)) state.generating = false
    }
  }

  function beginEdit() {
    if (disposed || state.saving || state.adapting || state.generating || state.planStatus !== 'ready' || state.tasks.status !== 'ready') return false
    if (state.draft !== null) return true
    state.initialDraft = draftScheduleItems(displayedItems.value)
    state.draft = state.initialDraft.map(item => ({ ...item }))
    state.saveError = ''
    state.saveNotice = ''
    state.saveConflict = false
    return true
  }

  function placeItem(candidate, replacingKey = null) {
    if (state.draft === null || state.saving || state.adapting || state.adaptation) return false
    const original = replacingKey && state.draft.find(item => item.key === replacingKey)
    if (replacingKey && (!original || protectedSlotReason(original, state.tasks.items))) {
      state.saveError = 'Этот сохранённый блок нельзя менять.'
      return false
    }
    const item = { ...candidate, key: replacingKey ?? (candidate.item_type === 'task' ? 'task:' + candidate.task_id : 'added-break:' + ++addedItemNumber) }
    const next = [...state.draft.filter(item => item.key !== replacingKey), item]
    const validation = validateScheduleEdit(next, state.tasks.items, state.plan.items)
    if (validation.errors.length) {
      state.saveError = validation.errors[0]
      return false
    }
    state.draft = draftScheduleItems(next).sort((a, b) => a.start_time.localeCompare(b.start_time))
    state.saveError = ''
    return true
  }

  function removeItem(key) {
    if (state.draft === null || state.saving || state.adapting || state.adaptation) return false
    const item = state.draft.find(item => item.key === key)
    if (!item || protectedSlotReason(item, state.tasks.items)) return false
    state.draft = state.draft.filter(item => item.key !== key)
    state.saveError = ''
    return true
  }

  function cancelEdit() {
    if (state.saving || state.adapting) return false
    resetDraft()
    return true
  }

  function discardLocal() {
    if (!state.plan || state.saving || state.adapting || state.draft !== null) return false
    if (!clearLocalSchedule(storage, state.plan)) {
      state.saveError = 'Браузер не смог удалить локальную копию.'
      return false
    }
    state.localItems = null
    state.localStatus = 'none'
    state.saveError = ''
    state.saveNotice = 'Показано серверное расписание.'
    return true
  }

  async function adaptRemainder() {
    const request = selection
    if (!request || !isCurrent(request, selection) || state.generating || state.saving || state.adapting
      || state.planStatus !== 'ready' || state.tasks.status !== 'ready' || state.draft !== null && !state.adaptation) return false
    const source = (state.adaptation?.sourceItems ?? displayedItems.value).map(item => ({ ...item }))
    const plan = state.plan
    state.adapting = true
    state.saveError = ''
    state.saveNotice = ''
    try {
      const options = { userId, token: request.token, signal: request.controller.signal }
      const [freshPlan, freshTasks] = await Promise.all([getSchedule({ id: plan.id, date: plan.date, ...options }), getTasks(options)])
      if (!isCurrent(request, selection)) return false
      if (scheduleFingerprint(freshPlan) !== scheduleFingerprint(plan)) {
        state.saveConflict = true
        state.saveError = 'Расписание на сервере изменилось. Загрузите актуальный план перед перерасчётом.'
        return false
      }
      state.tasks.items = freshTasks
      const proposal = adaptScheduleRemainder({ date: plan.date, items: source, tasks: freshTasks, serverItems: plan.items, now: getNow() })
      state.initialDraft = draftScheduleItems(source)
      state.draft = proposal.items
      state.adaptation = proposal
      state.adaptationStale = false
      state.saveConflict = false
      return true
    } catch (error) {
      if (!isCurrent(request, selection)) return false
      if (error.status === 401 || error.status === 403) unauthorized()
      else state.saveError = error.message
      return false
    } finally {
      if (isCurrent(request, selection)) state.adapting = false
    }
  }

  async function saveEdit({ local = false } = {}) {
    const request = selection
    if (!request || !isCurrent(request, selection) || state.saving || state.adapting || !dirty.value) return false
    state.saving = true
    state.saveError = ''
    state.saveConflict = false
    const plan = state.plan
    const items = state.draft.map(item => ({ ...item }))
    const options = { userId, token: request.token, signal: request.controller.signal }
    try {
      const [freshPlan, freshTasks] = await Promise.all([
        getSchedule({ id: plan.id, date: plan.date, ...options }), getTasks(options),
      ])
      if (!isCurrent(request, selection)) return false
      if (scheduleFingerprint(freshPlan) !== scheduleFingerprint(plan)) {
        state.saveConflict = true
        state.saveError = 'Расписание на сервере изменилось. Черновик сохранён на экране. Загрузите актуальный план перед повторной правкой.'
        return false
      }
      state.tasks.items = freshTasks
      if (state.adaptation) {
        const reason = staleAdaptationReason(state.adaptation, items, plan.date, getNow())
          || (adaptationTasksFingerprint(freshTasks) !== state.adaptation.tasksFingerprint
            ? 'Данные задач изменились. Пересчитайте остаток дня заново, чтобы учесть их.' : '')
        if (reason) {
          state.adaptationStale = true
          state.saveError = reason
          return false
        }
      }
      const validation = validateScheduleEdit(items, freshTasks, freshPlan.items)
      if (validation.errors.length) {
        state.saveError = validation.errors.join(' ')
        return false
      }
      if (validation.localReasons.length && !local) {
        state.saveError = 'Сервер не принимает сохранённые исторические блоки. Можно сохранить правки только в этом браузере.'
        return false
      }
      if (local && !validation.localReasons.length) {
        state.saveError = 'Эти правки можно сохранить на сервере. Выберите сохранение расписания.'
        return false
      }
      if (local) {
        saveLocalSchedule(storage, freshPlan, items)
        resetDraft()
        state.localItems = draftScheduleItems(items)
        state.localStatus = 'saved'
        state.unscheduledIds = null
        state.saveNotice = 'Правки сохранены только в этом браузере. Серверное расписание осталось прежним.'
      } else {
        const updated = await updateSchedule({ id: plan.id, date: plan.date, items, ...options })
        if (!isCurrent(request, selection)) return false
        const hadLocal = state.localStatus !== 'none'
        const cleared = clearLocalSchedule(storage, plan)
        showPlan(updated, null)
        state.saveNotice = hadLocal && !cleared
          ? 'Расписание сохранено на сервере. Устаревшую локальную копию браузер не смог удалить; она не применяется.'
          : 'Расписание сохранено на сервере.'
      }
      return true
    } catch (error) {
      if (!isCurrent(request, selection)) return false
      if (error.status === 401 || error.status === 403) unauthorized()
      else state.saveError = error.message
      return false
    } finally {
      if (isCurrent(request, selection)) state.saving = false
    }
  }

  return { state, displayedItems, dirty, changes, editValidation, open, generate, loadTasks, loadAdvice, dispose,
    beginEdit, placeItem, removeItem, cancelEdit, saveEdit, discardLocal, adaptRemainder }
}
