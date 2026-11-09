import { ApiError, apiRequest } from './client.js'
import { isDateString } from '../utils/dates.js'

function isBiorhythm(data) {
  return ['physical', 'emotional', 'intellectual'].every((name) => Number.isFinite(data?.[name]))
}

export async function getBiorhythms({ targetDate, token, signal }) {
  const data = await apiRequest('/biorhythms/', { query: { target_date: targetDate }, token, signal })
  if (!isBiorhythm(data)) throw new ApiError('Сервер вернул некорректные показатели биоритмов.')
  return data
}

export async function getBiorhythmPeriod({ startDate, endDate, token, signal }) {
  const data = await apiRequest('/biorhythms/period', {
    query: { start_date: startDate, end_date: endDate }, token, signal,
  })
  if (!Array.isArray(data.items) || !data.items.every((item) => isDateString(item?.date) && isBiorhythm(item))) {
    throw new ApiError('Сервер вернул некорректный прогноз биоритмов.')
  }
  if (!data.items.length) return data
  const expectedDays = (Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86400000 + 1
  if (data.items.length !== expectedDays || new Set(data.items.map(({ date }) => date)).size !== expectedDays
    || data.items.some(({ date }) => date < startDate || date > endDate)) {
    throw new ApiError('Сервер вернул прогноз не за весь выбранный период. Повторите загрузку.')
  }
  return { ...data, items: [...data.items].sort((left, right) => left.date.localeCompare(right.date)) }
}

export async function getCriticalDays({ startDate, endDate, token, signal }) {
  const data = await apiRequest('/biorhythms/critical-days', {
    query: { start_date: startDate, end_date: endDate }, token, signal,
  })
  if (!Array.isArray(data.items) || !data.items.every((item) => isDateString(item?.date)
    && item.date >= startDate && item.date <= endDate
    && ['physical', 'emotional', 'intellectual'].includes(item.biorhythm)
    && ['positive_to_negative', 'negative_to_positive'].includes(item.direction))) {
    throw new ApiError('Сервер вернул некорректный список критических дней.')
  }
  if (new Set(data.items.map(item => `${item.date}:${item.biorhythm}`)).size !== data.items.length) {
    throw new ApiError('Сервер вернул повторяющиеся критические дни. Повторите загрузку.')
  }
  return { ...data, items: [...data.items].sort((left, right) => left.date.localeCompare(right.date)) }
}
