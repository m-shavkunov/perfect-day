import { ApiError, apiRequest } from './client.js'
import { isDateString } from '../utils/dates.js'
import { isScheduleId, scheduleMinutes } from '../utils/schedule.js'
import { sameScheduleItems, schedulePayload } from '../utils/scheduleEditing.js'

function parseSchedule(schedule, { userId, id, date }) {
  if (!isScheduleId(schedule?.id) || schedule.user_id !== userId
    || (id !== undefined && schedule.id !== id) || !isDateString(schedule.date)
    || (date !== undefined && schedule.date !== date) || !Array.isArray(schedule.items)) {
    throw new ApiError('Сервер вернул некорректное расписание.')
  }

  const itemIds = new Set()
  const taskIds = new Set()
  for (const item of schedule.items) {
    const start = scheduleMinutes(item?.start_time)
    const end = scheduleMinutes(item?.end_time)
    if (!isScheduleId(item?.id) || itemIds.has(item.id) || item.schedule_id !== schedule.id
      || !(start < end) || !['task', 'break'].includes(item.item_type)
      || (item.item_type === 'task' && (!isScheduleId(item.task_id) || taskIds.has(item.task_id)))
      || (item.item_type === 'break' && item.task_id !== null)) {
      throw new ApiError('Сервер вернул некорректные блоки расписания.')
    }
    itemIds.add(item.id)
    if (item.item_type === 'task') taskIds.add(item.task_id)
  }
  const items = [...schedule.items].sort((left, right) => scheduleMinutes(left.start_time) - scheduleMinutes(right.start_time))
  if (items.some((item, index) => index > 0 && scheduleMinutes(items[index - 1].end_time) > scheduleMinutes(item.start_time))) {
    throw new ApiError('Сервер вернул пересекающиеся блоки расписания.')
  }
  return { ...schedule, items }
}

export async function getSchedule({ id, date, userId, token, signal }) {
  const schedule = await apiRequest('/schedules/' + id, { token, signal })
  return parseSchedule(schedule, { id, date, userId })
}

export async function generateSchedule({ date, userId, token, signal }) {
  const data = await apiRequest('/schedules/generate', {
    method: 'POST', query: { target_date: date }, token, signal,
  })
  const schedule = parseSchedule(data.schedule, { date, userId })
  const unscheduledIds = data.unscheduled_task_ids
  const placedIds = new Set(schedule.items.filter(item => item.item_type === 'task').map(item => item.task_id))
  if (!Array.isArray(unscheduledIds) || !unscheduledIds.every(id => isScheduleId(id) && !placedIds.has(id))
    || new Set(unscheduledIds).size !== unscheduledIds.length) {
    throw new ApiError('Сервер вернул некорректный список неразмещённых задач.')
  }
  return { schedule, unscheduledIds }
}

export async function updateSchedule({ id, date, userId, items, token, signal }) {
  const payload = schedulePayload(items)
  const data = await apiRequest('/schedules/' + id, { method: 'PUT', body: { items: payload }, token, signal })
  const plan = parseSchedule(data, { id, date, userId })
  if (!sameScheduleItems(plan.items, payload)) throw new ApiError('Сервер не подтвердил сохранение всех блоков расписания.')
  return plan
}
