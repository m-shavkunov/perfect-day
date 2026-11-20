import { getAdjacentPeriodDate, getPeriodRange } from './dates.js'

export const lunch = { item_type: 'lunch', id: 'lunch', start_time: '13:00', end_time: '14:00' }

export function weekDates(selectedDate) {
  const { startDate, endDate } = getPeriodRange(selectedDate, 'week')
  const dates = []
  for (let date = startDate; date && date <= endDate; date = getAdjacentPeriodDate(date, 'day', 1)) {
    dates.push(date)
  }
  return dates
}

export function isScheduleId(value) {
  return Number.isSafeInteger(value) && value > 0
}

export function parseScheduleId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !isScheduleId(Number(value))) return null
  return Number(value)
}

export function scheduleMinutes(value) {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/.test(value)) return NaN
  const [hours, minutes, seconds = 0] = value.split(':').map(Number)
  return hours * 60 + minutes + seconds / 60
}

function scheduleKey(userId, date) {
  return 'perfect-day.schedule.' + userId + '.' + date
}

export function readScheduleId(storage, userId, date) {
  try { return parseScheduleId(storage?.getItem(scheduleKey(userId, date))) }
  catch { return null }
}

export function rememberScheduleId(storage, userId, date, id) {
  try {
    if (!storage) return false
    storage.setItem(scheduleKey(userId, date), String(id))
    return true
  } catch { return false }
}

export function forgetScheduleId(storage, userId, date, id) {
  if (readScheduleId(storage, userId, date) !== id) return
  try { storage.removeItem(scheduleKey(userId, date)) }
  catch { return }
}
