import { localDateString } from './dates.js'
import { scheduleMinutes } from './schedule.js'
import { clockFromMinutes, draftScheduleItems, protectedSlotReason, sameScheduleItems, validateScheduleEdit } from './scheduleEditing.js'

const priorities = { high: 0, medium: 1, low: 2 }
const workIntervals = [[540, 780], [840, 1080]]
const minuteOfDay = now => now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000

export function adaptationUnavailable(date, now = new Date()) {
  if (!Number.isFinite(now.getTime())) return 'Не удалось определить текущее время.'
  if (date !== localDateString(now)) return 'Остаток дня можно перепланировать только на сегодня.'
  if (minuteOfDay(now) >= 1080) return 'Рабочий день завершён. После 18:00 свободного времени для задач нет.'
  return ''
}

export function adaptationTasksFingerprint(tasks) {
  return JSON.stringify([...tasks].sort((a, b) => a.id - b.id)
    .map(({ id, duration_min, priority, deadline, status }) => [id, duration_min, priority, deadline, status]))
}

function deadline(task) {
  return task.deadline ? new Date(task.deadline).getTime() : Infinity
}

export function adaptScheduleRemainder({ date, items, tasks, serverItems = items, now = new Date() }) {
  const unavailable = adaptationUnavailable(date, now)
  if (unavailable) throw new Error(unavailable)
  const validation = validateScheduleEdit(items, tasks, serverItems)
  if (validation.errors.length) throw new Error(validation.errors.join(' '))
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
    const end = start + 10
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

  for (const [workStart, workEnd] of workIntervals) {
    let gapStart = Math.max(workStart, Math.ceil(currentMinute))
    if (gapStart >= workEnd) continue
    const anchors = frozen.filter(item => scheduleMinutes(item.start_time) < workEnd && scheduleMinutes(item.end_time) > workStart)
    let previous = anchors.filter(item => scheduleMinutes(item.end_time) <= gapStart).at(-1)
    for (const next of [...anchors.filter(item => scheduleMinutes(item.end_time) > gapStart), null]) {
      const gapEnd = Math.floor(next ? Math.min(scheduleMinutes(next.start_time), workEnd) : workEnd)
      let cursor = Math.ceil(gapStart)
      let needsBreak = previous?.item_type === 'task' && cursor - scheduleMinutes(previous.end_time) < 10
      const endRest = next?.item_type === 'task' ? 10 : 0
      let lastTaskEnd = null
      while (cursor < gapEnd) {
        const index = remaining.findIndex(task => task.duration_min + (needsBreak ? 10 : 0) + endRest <= gapEnd - cursor)
        if (index < 0) break
        const [task] = remaining.splice(index, 1)
        if (needsBreak) { appendBreak(cursor); cursor += 10 }
        const end = cursor + task.duration_min
        result.push({ item_type: 'task', task_id: task.id, start_time: clockFromMinutes(cursor), end_time: clockFromMinutes(end), key: 'task:' + task.id })
        placed.push({ task, end })
        cursor = end
        lastTaskEnd = end
        needsBreak = true
      }
      if (lastTaskEnd !== null && next?.item_type === 'task') appendBreak(lastTaskEnd)
      if (next) {
        gapStart = Math.max(gapStart, scheduleMinutes(next.end_time))
        previous = next
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
  const checked = validateScheduleEdit(ordered, tasks, serverItems)
  if (checked.errors.length) throw new Error(checked.errors.join(' '))
  return { items: ordered, sourceItems, calculatedAt: now.getTime(), from: clockFromMinutes(Math.ceil(currentMinute)),
    frozenKeys: frozen.map(item => item.key), frozenCount: frozen.length, unplaced, deadlineWarnings, tasksFingerprint: adaptationTasksFingerprint(tasks) }
}

export function staleAdaptationReason(adaptation, items, date, now = new Date()) {
  const unavailable = adaptationUnavailable(date, now)
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
