import { isDateString, localDateString } from './dates.js'

export const taskTypes = {
  intellectual: 'Интеллектуальная',
  physical: 'Физическая',
  creative: 'Творческая',
  routine: 'Рутинная',
}

export const taskPriorities = { low: 'Низкий', medium: 'Средний', high: 'Высокий' }
export const taskStatuses = { planned: 'Запланировано', done: 'Выполнено', cancelled: 'Отменено' }
export const maxTaskDuration = 1440

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

  if (original) {
    body.status = form.status
    const previous = taskFormValues(original)
    for (const key of Object.keys(body)) {
      if (form[key] === previous[key] || body[key] === original[key]) delete body[key]
    }
  }

  if ('title' in body) {
    if (!body.title) errors.title = 'Введите название задачи.'
    else if (Array.from(body.title).length > 200) errors.title = 'Название должно содержать не более 200 символов.'
  }
  if ('type' in body && !Object.hasOwn(taskTypes, body.type)) errors.type = 'Выберите тип задачи.'
  if ('duration_min' in body && (!Number.isInteger(body.duration_min) || body.duration_min < 1 || body.duration_min > maxTaskDuration)) {
    errors.duration_min = `Введите целое число от 1 до ${maxTaskDuration} минут.`
  }
  if ('priority' in body && !Object.hasOwn(taskPriorities, body.priority)) errors.priority = 'Выберите приоритет.'
  if ('status' in body && !Object.hasOwn(taskStatuses, body.status)) errors.status = 'Выберите статус.'
  if (body.description && Array.from(body.description).length > 2000) {
    errors.description = 'Описание должно содержать не более 2000 символов.'
  }

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

  return { body, errors }
}
