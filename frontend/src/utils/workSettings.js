import { scheduleMinutes } from './schedule.js'

const timeFields = ['work_start', 'work_end', 'lunch_start', 'lunch_end']
export const workSettingMinuteLimits = { break_duration_min: 120, work_before_break_min: 240 }
const durationFields = Object.keys(workSettingMinuteLimits)
export const defaultWorkSettings = {
  work_start: '09:00', work_end: '18:00', lunch_start: '13:00', lunch_end: '14:00',
  break_duration_min: 10, work_before_break_min: 50,
}

export function workingIntervals(settings) {
  return [[scheduleMinutes(settings.work_start), scheduleMinutes(settings.lunch_start)],
    [scheduleMinutes(settings.lunch_end), scheduleMinutes(settings.work_end)]]
}

export function sameWorkSettings(previous, current) {
  return previous && [...timeFields, ...durationFields].every(field => previous[field] === current[field])
}

function normalizeTime(value) {
  if (!Number.isFinite(scheduleMinutes(value))) return ''
  const [clock, fraction] = value.split('.')
  const wholeSeconds = clock.length === 5 ? clock + ':00' : clock
  const decimal = fraction?.replace(/0+$/, '')
  return decimal ? wholeSeconds + '.' + decimal : wholeSeconds
}

export function prepareWorkSettings(values, saved = {}) {
  const body = {}
  const errors = {}
  for (const field of timeFields) {
    const value = values[field]
    const previous = saved[field]
    body[field] = normalizeTime(previous && previous.slice(0, 5) === value ? previous : value)
    if (!body[field]) errors[field] = 'Укажите время.'
  }
  for (const field of durationFields) {
    const value = values[field]
    const max = workSettingMinuteLimits[field]
    body[field] = value
    if (!Number.isInteger(value) || value < 1 || value > max) errors[field] = `Введите целое число от 1 до ${max} минут.`
  }

  const { work_start: workStart, work_end: workEnd, lunch_start: lunchStart, lunch_end: lunchEnd } = body
  if (workStart && workEnd && workStart >= workEnd) errors.work_end = 'Окончание рабочего дня должно быть позже начала.'
  if (lunchStart && lunchEnd && lunchStart >= lunchEnd) errors.lunch_end = 'Окончание обеда должно быть позже начала.'
  if (lunchStart && workStart && lunchStart < workStart) errors.lunch_start = 'Обед начинается до рабочего дня.'
  if (!errors.lunch_end && lunchEnd && workEnd && lunchEnd > workEnd) errors.lunch_end = 'Обед заканчивается после рабочего дня.'

  return { body, errors }
}

export function workSettingsForm(settings) {
  const form = { ...settings }
  for (const field of timeFields) form[field] = settings[field].slice(0, 5)
  return form
}
