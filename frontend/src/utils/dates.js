export function localDateString(date = new Date()) {
  return [date.getFullYear().toString().padStart(4, '0'),
    (date.getMonth() + 1).toString().padStart(2, '0'),
    date.getDate().toString().padStart(2, '0')].join('-')
}

export function isDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function getPeriodRange(selectedDate, period) {
  if (!isDateString(selectedDate)) throw new RangeError('Выберите корректную дату.')
  const start = new Date(`${selectedDate}T12:00:00Z`)
  const end = new Date(start)

  if (period === 'week') {
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7)
    end.setTime(start.getTime())
    end.setUTCDate(end.getUTCDate() + 6)
  } else if (period === 'month') {
    start.setUTCDate(1)
    end.setUTCMonth(end.getUTCMonth() + 1, 0)
  } else if (period !== 'day') {
    throw new RangeError('Выберите день, неделю или месяц.')
  }

  return {
    startDate: start.getUTCFullYear() < 1 ? '0001-01-01' : start.toISOString().slice(0, 10),
    endDate: end.getUTCFullYear() > 9999 ? '9999-12-31' : end.toISOString().slice(0, 10),
  }
}
