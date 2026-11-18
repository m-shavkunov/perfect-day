import { isDateString, localDateString } from './dates.js'

export const taskTypes = {
  intellectual: 'Интеллектуальная',
  physical: 'Физическая',
  creative: 'Творческая',
  routine: 'Рутинная',
}

export const taskPriorities = { low: 'Низкий', medium: 'Средний', high: 'Высокий' }
export const taskStatuses = { planned: 'Запланировано', done: 'Выполнено', cancelled: 'Отменено' }
export const maxTaskDuration = 2_147_483_647

export function localTaskDeadline(value) {
  if (!value) return ''
  const date = new Date(value)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${localDateString(date)}T${hours}:${minutes}`
}

export function taskFormValues(task) {
  return {
    title: task?.title ?? '',
    type: task?.type ?? '',
    duration_min: task?.duration_min ?? '',
    priority: task?.priority ?? 'medium',
    deadline: localTaskDeadline(task?.deadline),
    description: task?.description ?? '',
    status: task?.status ?? 'planned',
  }
}

export function prepareTask(form, original) {
  const errors = {}
  const body = {
    title: form.title.trim(),
    type: form.type,
    duration_min: Number(form.duration_min),
    priority: form.priority,
    description: form.description.trim() || null,
  }
  if (!body.title) errors.title = 'Введите название задачи.'
  if (!Object.hasOwn(taskTypes, body.type)) errors.type = 'Выберите тип задачи.'
  if (!Number.isInteger(body.duration_min) || body.duration_min < 1 || body.duration_min > maxTaskDuration) {
    errors.duration_min = 'Введите целое положительное число минут.'
  }
  if (!Object.hasOwn(taskPriorities, body.priority)) errors.priority = 'Выберите приоритет.'

  if (form.deadline !== localTaskDeadline(original?.deadline) || !original) {
    body.deadline = null
    if (form.deadline) {
      const date = new Date(form.deadline)
      if (!isDateString(form.deadline.split('T')[0]) || Number.isNaN(date.getTime()) || localTaskDeadline(date) !== form.deadline) {
        errors.deadline = 'Введите корректные дату и время.'
      } else {
        body.deadline = date.toISOString()
      }
    }
  }

  if (original) {
    body.status = form.status
    if (!Object.hasOwn(taskStatuses, form.status)) errors.status = 'Выберите статус.'
    for (const key of Object.keys(body)) {
      if (body[key] === original[key]) delete body[key]
    }
  }
  return { body, errors }
}
