import { ApiError, apiRequest } from './client.js'
import { isDateString } from '../utils/dates.js'

export async function getRecommendations({ targetDate, token, signal }) {
  const data = await apiRequest('/recommendations/', { query: { target_date: targetDate }, token, signal })
  if (!isDateString(data.date) || (targetDate !== undefined && data.date !== targetDate)
    || !Array.isArray(data.items) || !data.items.every((item) =>
    Number.isInteger(item?.task_id) && ['title', 'task_type', 'recommendation', 'reason'].every((key) => typeof item[key] === 'string')
    && (item.activity_value === null || (Number.isFinite(item.activity_value) && Math.abs(item.activity_value) <= 100)))
    || new Set(data.items.map(item => item.task_id)).size !== data.items.length) {
    throw new ApiError('Сервер вернул некорректные рекомендации.')
  }
  return data
}
