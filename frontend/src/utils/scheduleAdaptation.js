import { localDateString } from './dates.js'
import { formatScheduleTime, scheduleMinutes } from './schedule.js'
import { clockFromMinutes, draftScheduleItems, protectedSlotReason, sameScheduleItems, validateScheduleEdit } from './scheduleEditing.js'
import { defaultWorkSettings, workingIntervals } from './workSettings.js'

const priorities = { high: 0, medium: 1, low: 2 }
const minuteOfDay = now => now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000

export function adaptationUnavailable(date, now = new Date(), settings = defaultWorkSettings) {
  if (!Number.isFinite(now.getTime())) return 'Не удалось определить текущее время.'
  if (date !== localDateString(now)) return 'Остаток дня можно перепланировать только на сегодня.'
  if (minuteOfDay(now) >= scheduleMinutes(settings.work_end)) {
    return 'Рабочий день завершён. После ' + formatScheduleTime(settings.work_end) + ' свободного времени для задач нет.'
  }
  const nextMinute = Math.ceil(minuteOfDay(now))
  if (!workingIntervals(settings).some(([start, end]) => Math.max(nextMinute, Math.ceil(start)) < Math.floor(end))) {
    return 'В сегодняшнем рабочем дне больше нет времени для задач.'
  }
  return ''
}

export function adaptationTasksFingerprint(tasks) {
  return JSON.stringify([...tasks].sort((a, b) => a.id - b.id)
    .map(({ id, duration_min, priority, deadline, status }) => [id, duration_min, priority, deadline, status]))
}

function deadline(task) {
  return task.deadline ? new Date(task.deadline).getTime() : Infinity
}

export function adaptScheduleRemainder({ date, items, tasks, serverItems = items, now = new Date(), settings = defaultWorkSettings }) {
  const unavailable = adaptationUnavailable(date, now, settings)
  if (unavailable) throw new Error(unavailable)
  const { break_duration_min: breakDuration, work_before_break_min: workBeforeBreak } = settings
  const currentMinute = minuteOfDay(now)
  const sourceItems = draftScheduleItems(items)
  const frozen = sourceItems.filter(item => scheduleMinutes(item.start_time) <= currentMinute || protectedSlotReason(item, tasks))
    .sort((a, b) => scheduleMinutes(a.start_time) - scheduleMinutes(b.start_time))
  const frozenTaskIds = new Set(frozen.filter(item => item.item_type === 'task').map(item => item.task_id))
  const originalOrder = new Map(sourceItems.filter(item => item.item_type === 'task').map((item, index) => [item.task_id, index]))
  const remaining = tasks.filter(task => task.status === 'planned' && !frozenTaskIds.has(task.id))
    .sort((a, b) => priorities[a.priority] - priorities[b.priority] || deadline(a) - deadline(b)
      || (originalOrder.get(a.id) ?? Infinity) - (originalOrder.get(b.id) ?? Infinity) || a.id - b.id)
  const result = frozen.map(item => ({ ...item }))
  const placed = []
  const usedKeys = new Set(sourceItems.map(item => item.key))
  let breakNumber = 0
  const appendBreak = start => {
    const end = start + breakDuration
    const original = sourceItems.find(item => item.item_type === 'break'
      && scheduleMinutes(item.start_time) === start && scheduleMinutes(item.end_time) === end)
    let key = original?.key
    if (!key) {
      do { key = 'adapted-break:' + ++breakNumber } while (usedKeys.has(key))
      usedKeys.add(key)
    }
    result.push({ item_type: 'break', task_id: null, start_time: clockFromMinutes(start), end_time: clockFromMinutes(end),
      key })
  }

  for (const [workStart, workEnd] of workingIntervals(settings)) {
    if (Math.max(workStart, currentMinute) >= workEnd) continue
    let gapStart = workStart
    let lastWorkEnd = workStart
    let worked = 0
    const recordWork = (start, end) => {
      if (start - lastWorkEnd >= breakDuration) worked = 0
      worked += end - start
      lastWorkEnd = end
    }
    const anchors = frozen.filter(item => scheduleMinutes(item.start_time) < workEnd && scheduleMinutes(item.end_time) > workStart)
    for (const next of [...anchors, null]) {
      const gapEnd = Math.floor(next ? Math.min(scheduleMinutes(next.start_time), workEnd) : workEnd)
      let cursor = Math.ceil(Math.max(gapStart, currentMinute))
      let placedInGap = false
      while (cursor < gapEnd) {
        const rested = cursor - lastWorkEnd >= breakDuration
        const needsBreak = !rested && worked >= workBeforeBreak
        const start = cursor + (needsBreak ? breakDuration : 0)
        const alreadyWorked = rested || needsBreak ? 0 : worked
        const index = remaining.findIndex(task => {
          const restBeforeAnchor = next?.item_type === 'task' && alreadyWorked + task.duration_min >= workBeforeBreak
          return start + task.duration_min + (restBeforeAnchor ? breakDuration : 0) <= gapEnd
        })
        if (index < 0) break
        const [task] = remaining.splice(index, 1)
        if (needsBreak) appendBreak(cursor)
        const end = start + task.duration_min
        result.push({ item_type: 'task', task_id: task.id, start_time: clockFromMinutes(start), end_time: clockFromMinutes(end), key: 'task:' + task.id })
        placed.push({ task, end })
        recordWork(start, end)
        cursor = end
        placedInGap = true
      }
      if (placedInGap && next?.item_type === 'task' && worked >= workBeforeBreak) appendBreak(lastWorkEnd)
      if (next) {
        const start = Math.max(workStart, scheduleMinutes(next.start_time))
        const end = Math.min(workEnd, scheduleMinutes(next.end_time))
        if (next.item_type === 'task') recordWork(start, end)
        gapStart = end
      }
    }
  }
  const unplaced = remaining.map(task => ({ task_id: task.id, reason: 'Не хватает непрерывного времени с учётом обеда и перерывов.' }))
  const deadlineWarnings = placed.filter(({ task, end }) => {
    const finish = new Date(now)
    finish.setHours(Math.floor(end / 60), end % 60, 0, 0)
    return finish.getTime() > deadline(task)
  }).map(({ task }) => ({ task_id: task.id,
    reason: deadline(task) <= now.getTime() ? 'Срок задачи уже прошёл.' : 'Задача завершится позже своего срока.' }))
  const ordered = result.sort((a, b) => scheduleMinutes(a.start_time) - scheduleMinutes(b.start_time))
  const checked = validateScheduleEdit(ordered, tasks, serverItems, { settings })
  if (checked.errors.length) throw new Error(checked.errors.join(' '))
  return { items: ordered, sourceItems, calculatedAt: now.getTime(), from: clockFromMinutes(Math.ceil(currentMinute)),
    frozenKeys: frozen.map(item => item.key), frozenCount: frozen.length, unplaced, deadlineWarnings, tasksFingerprint: adaptationTasksFingerprint(tasks) }
}

export function staleAdaptationReason(adaptation, items, date, now = new Date(), settings = defaultWorkSettings) {
  const unavailable = adaptationUnavailable(date, now, settings)
  if (unavailable) return unavailable
  const minute = minuteOfDay(now)
  for (const original of adaptation.sourceItems) {
    if (scheduleMinutes(original.start_time) <= minute && !items.some(item => sameScheduleItems([item], [original]))) {
      return 'За время просмотра начался один из исходных блоков. Пересчитайте остаток дня заново.'
    }
  }
  for (const item of items) {
    if (scheduleMinutes(item.start_time) < Math.ceil(minute)
      && !adaptation.sourceItems.some(original => sameScheduleItems([original], [item]))) {
      return 'Предложенное время начала уже прошло. Пересчитайте остаток дня заново.'
    }
  }
  return ''
}
