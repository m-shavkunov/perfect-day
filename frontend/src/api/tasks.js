import { ApiError, apiRequest } from './client.js'
import { taskPriorities, taskStatuses, taskTypes } from '../utils/tasks.js'

function isTask(task, userId) {
  return Number.isSafeInteger(task?.id) && task.id > 0 && task.user_id === userId
    && typeof task.title === 'string'
    && (task.description === null || typeof task.description === 'string')
    && Object.hasOwn(taskTypes, task.type) && Object.hasOwn(taskPriorities, task.priority)
    && Object.hasOwn(taskStatuses, task.status)
    && Number.isSafeInteger(task.duration_min) && task.duration_min > 0
    && (task.deadline === null || (typeof task.deadline === 'string' && Number.isFinite(Date.parse(task.deadline))))
}

export async function getTasks({ userId, token, signal }) {
  const tasks = await apiRequest('/tasks/', { token, signal })
  if (!Array.isArray(tasks) || !tasks.every(task => isTask(task, userId))
    || new Set(tasks.map(task => task.id)).size !== tasks.length) {
    throw new ApiError('Сервер вернул некорректный список задач.')
  }
  return tasks
}

export async function createTask(body, { userId, token, signal }) {
  const task = await apiRequest('/tasks/', { method: 'POST', body, token, signal })
  if (!isTask(task, userId)) throw new ApiError('Сервер не подтвердил создание задачи.')
  return task
}

export async function updateTask(id, body, { userId, token, signal }) {
  const task = await apiRequest(`/tasks/${id}`, { method: 'PUT', body, token, signal })
  if (!isTask(task, userId) || task.id !== id || ('status' in body && task.status !== body.status)) {
    throw new ApiError('Сервер не подтвердил изменение задачи.')
  }
  return task
}

export async function deleteTask(id, { token, signal }) {
  await apiRequest(`/tasks/${id}`, { method: 'DELETE', token, signal })
}
