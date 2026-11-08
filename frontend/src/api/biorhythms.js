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
  return data
}

export async function getCriticalDays({ startDate, endDate, token, signal }) {
  const data = await apiRequest('/biorhythms/critical-days', {
    query: { start_date: startDate, end_date: endDate }, token, signal,
  })
  if (!Array.isArray(data.items) || !data.items.every((item) => isDateString(item?.date)
    && ['physical', 'emotional', 'intellectual'].includes(item.biorhythm)
    && ['positive_to_negative', 'negative_to_positive'].includes(item.direction))) {
    throw new ApiError('Сервер вернул некорректный список критических дней.')
  }
  return data
}
