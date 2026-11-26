import { ApiError, apiRequest } from './client.js'
import { prepareWorkSettings } from '../utils/workSettings.js'

function readSettings(response, userId) {
  if (!Number.isSafeInteger(response?.id) || response.id < 1 || response.user_id !== userId) {
    throw new ApiError('Сервер вернул некорректные настройки рабочего дня.')
  }
  const { body, errors } = prepareWorkSettings(response)
  if (Object.keys(errors).length) throw new ApiError('Сервер вернул некорректные настройки рабочего дня.')
  return body
}

export async function getWorkSettings({ userId, token, signal }) {
  const data = await apiRequest('/settings/', { token, signal })
  return readSettings(data, userId)
}

export async function updateWorkSettings({ userId, token, signal, body }) {
  const data = await apiRequest('/settings/', { method: 'PUT', token, signal, body })
  const settings = readSettings(data, userId)
  if (Object.keys(settings).some(field => settings[field] !== body[field])) {
    throw new ApiError('Сервер не подтвердил сохранение настроек. Повторите попытку.')
  }
  return settings
}
