import { ApiError, apiRequest } from './client.js'
import { isDateString } from '../utils/dates.js'

export async function updateProfile({ birthDate, chronotype, token, signal }) {
  const user = await apiRequest('/users/me', {
    method: 'PUT', token, signal, body: { birth_date: birthDate, chronotype },
  })
  if (!Number.isInteger(user?.id) || user.id < 1 || typeof user.email !== 'string'
    || !isDateString(user.birth_date) || user.birth_date !== birthDate || user.chronotype !== chronotype) {
    throw new ApiError('Сервер не подтвердил сохранение профиля. Обновите страницу и проверьте данные.')
  }
  return user
}
