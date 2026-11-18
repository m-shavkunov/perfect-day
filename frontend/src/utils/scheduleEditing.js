import { isScheduleId, scheduleMinutes } from './schedule.js'

export function clockFromMinutes(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 1440) return ''
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0')
}

export function schedulePayload(items) {
  return items.map(({ task_id, item_type, start_time, end_time }) => ({ task_id, item_type, start_time, end_time }))
    .sort((a, b) => scheduleMinutes(a.start_time) - scheduleMinutes(b.start_time))
}

function itemSignature(item) {
  return JSON.stringify([item.item_type, item.task_id, scheduleMinutes(item.start_time), scheduleMinutes(item.end_time)])
}

export function sameScheduleItems(left, right) {
  return JSON.stringify(schedulePayload(left).map(itemSignature)) === JSON.stringify(schedulePayload(right).map(itemSignature))
}

export function scheduleFingerprint(plan) {
  return JSON.stringify([plan.user_id, plan.id, plan.date,
    [...plan.items].sort((a, b) => scheduleMinutes(a.start_time) - scheduleMinutes(b.start_time))
      .map(item => [item.id, itemSignature(item)])])
}

export function draftScheduleItems(items) {
  return items.map((item, index) => ({ ...item, key: item.key ?? (item.item_type === 'task' ? 'task:' + item.task_id : 'break:' + (item.id ?? 'local-' + index)) }))
}

export function protectedSlotReason(item, tasks) {
  if (item.item_type !== 'task') return ''
  const task = tasks.find(task => task.id === item.task_id)
  if (!task) return 'Данные задачи недоступны.'
  if (task.status === 'done') return 'Выполнено. Сохранённый блок остаётся в истории.'
  if (task.status === 'cancelled') return 'Отменено. Сохранённый блок остаётся в истории.'
  if (Math.abs(scheduleMinutes(item.end_time) - scheduleMinutes(item.start_time) - task.duration_min) > 1e-7) {
    return 'Длительность задачи изменилась. Сохранённый блок остаётся в истории.'
  }
  return ''
}

export function validateScheduleEdit(items, tasks, serverItems = []) {
  const errors = []
  const localReasons = []
  const seen = new Set()
  const ordered = schedulePayload(items)
  for (let index = 0; index < ordered.length; index++) {
    const item = ordered[index]
    const start = scheduleMinutes(item.start_time)
    const end = scheduleMinutes(item.end_time)
    if (!(start < end) || !['task', 'break'].includes(item.item_type)) {
      errors.push('Укажите корректное начало и окончание блока.')
      continue
    }
    if (start < 540 || end > 1080) errors.push('Размещайте блоки в рабочее время с 09:00 до 18:00.')
    if (start < 840 && end > 780) errors.push('Блок пересекается с обедом 13:00–14:00.')
    if (index > 0 && scheduleMinutes(ordered[index - 1].end_time) > start) {
      errors.push('Блоки расписания пересекаются. Выберите свободное время.')
    }
    if (item.item_type === 'break') {
      if (item.task_id !== null || Math.abs(end - start - 10) > 1e-7) errors.push('Перерыв должен длиться ровно 10 минут.')
      continue
    }
    if (!isScheduleId(item.task_id) || seen.has(item.task_id)) errors.push('Одна задача может быть размещена только один раз.')
    seen.add(item.task_id)
    const task = tasks.find(task => task.id === item.task_id)
    if (!task) {
      errors.push('Данные одной из задач недоступны. Обновите список задач.')
      continue
    }
    const reason = protectedSlotReason(item, tasks)
    if (reason) {
      const unchanged = serverItems.some(original => itemSignature(original) === itemSignature(item))
      if (unchanged) localReasons.push('«' + task.title + '»: ' + reason)
      else errors.push('Блок «' + task.title + '» нельзя изменять: ' + reason)
    }
  }
  for (const original of serverItems) {
    if (protectedSlotReason(original, tasks) && !ordered.some(item => itemSignature(item) === itemSignature(original))) {
      const task = tasks.find(task => task.id === original.task_id)
      errors.push('Исторический блок «' + (task?.title ?? 'Задача №' + original.task_id) + '» должен остаться в расписании без изменений.')
    }
  }
  return { errors: [...new Set(errors)], localReasons: [...new Set(localReasons)] }
}

export function firstAvailableStart(items, duration) {
  for (let start = 540; start + duration <= 1080; start++) {
    const end = start + duration
    if (start < 840 && end > 780) continue
    if (items.every(item => end <= scheduleMinutes(item.start_time) || start >= scheduleMinutes(item.end_time))) {
      return clockFromMinutes(start)
    }
  }
  return '09:00'
}

export function scheduleChanges(before, after, tasks) {
  const identity = item => item.item_type === 'task' ? 'task:' + item.task_id : item.key
  const oldByKey = new Map(before.map(item => [identity(item), item]))
  const newByKey = new Map(after.map(item => [identity(item), item]))
  const range = item => item.start_time.slice(0, 5) + '–' + item.end_time.slice(0, 5)
  const label = item => item.item_type === 'break' ? 'Перерыв' : tasks.find(task => task.id === item.task_id)?.title ?? 'Задача №' + item.task_id
  const changes = []
  for (const [key, item] of oldByKey) {
    const next = newByKey.get(key)
    if (!next) changes.push({ label: label(item), before: range(item), after: 'Убрано из дня' })
    else if (itemSignature(item) !== itemSignature(next)) changes.push({ label: label(item), before: range(item), after: range(next) })
  }
  for (const [key, item] of newByKey) {
    if (!oldByKey.has(key)) changes.push({ label: label(item), before: 'Не размещено', after: range(item) })
  }
  return changes
}

function localKey(plan) {
  return 'perfect-day.schedule-edit.' + plan.user_id + '.' + plan.id
}

export function readLocalSchedule(storage, plan) {
  try {
    const raw = storage?.getItem(localKey(plan))
    if (!raw) return { status: 'none', items: null }
    const value = JSON.parse(raw)
    if (value?.version !== 1 || value.date !== plan.date || !Array.isArray(value.items)
      || !value.items.every(item => item && ['task', 'break'].includes(item.item_type)
        && scheduleMinutes(item.start_time) < scheduleMinutes(item.end_time)
        && (item.item_type === 'break' ? item.task_id === null : isScheduleId(item.task_id)))) {
      return { status: 'invalid', items: null }
    }
    if (value.baseFingerprint !== scheduleFingerprint(plan)) return { status: 'stale', items: null }
    return { status: 'saved', items: draftScheduleItems(schedulePayload(value.items)) }
  } catch { return { status: 'invalid', items: null } }
}

export function saveLocalSchedule(storage, plan, items) {
  if (!storage) throw new Error('Хранилище браузера недоступно. Правки не сохранены.')
  try {
    storage.setItem(localKey(plan), JSON.stringify({ version: 1, date: plan.date, baseFingerprint: scheduleFingerprint(plan), items: schedulePayload(items) }))
  } catch { throw new Error('Браузер не смог сохранить правки. Черновик остаётся открыт.') }
}

export function clearLocalSchedule(storage, plan) {
  try {
    if (!storage) return false
    storage.removeItem(localKey(plan))
    return true
  } catch { return false }
}
