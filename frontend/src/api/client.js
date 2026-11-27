export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export class NetworkError extends ApiError {
  constructor(message) {
    super(message)
    this.name = 'NetworkError'
  }
}

const validationFields = {
  email: 'Укажите корректный email.',
  birth_date: 'Укажите корректную дату рождения, которая не позже сегодняшнего дня.',
  chronotype: 'Выберите один из доступных хронотипов.',
  title: 'Укажите название задачи длиной от 1 до 200 символов.',
  description: 'Описание должно содержать не более 2000 символов.',
  type: 'Выберите допустимый тип задачи.',
  priority: 'Выберите допустимый приоритет задачи.',
  status: 'Выберите допустимый статус задачи.',
  duration_min: 'Укажите целое число от 1 до 1440 минут для длительности задачи.',
  deadline: 'Проверьте дату и время срока задачи.',
  work_start: 'Проверьте время начала рабочего дня.',
  work_end: 'Проверьте время окончания рабочего дня.',
  lunch_start: 'Проверьте время начала обеда.',
  lunch_end: 'Проверьте время окончания обеда.',
  break_duration_min: 'Укажите длительность перерыва от 1 до 120 минут.',
  work_before_break_min: 'Укажите длительность работы до перерыва от 1 до 240 минут.',
  target_date: 'Выберите корректную дату расписания.',
}

const validationRules = {
  'Title cannot contain only spaces': 'Введите название задачи.',
  'Work start must be earlier than work end': 'Окончание рабочего дня должно быть позже начала.',
  'Lunch start must be earlier than lunch end': 'Окончание обеда должно быть позже начала.',
  'Lunch must be within working hours': 'Укажите время обеда в пределах рабочего дня.',
  'End time must be later than start time': 'Окончание блока должно быть позже начала.',
  'Task item must have task_id': 'Укажите задачу для блока.',
  'Break item cannot have task_id': 'Перерыв нельзя привязать к задаче.',
  'Schedule item must be within working hours': 'Разместите блоки в пределах рабочего дня.',
  'Schedule item cannot overlap lunch': 'Разместите блоки за пределами обеденного перерыва.',
  'Schedule items cannot overlap': 'Разместите блоки так, чтобы они не пересекались.',
  'Task cannot appear more than once': 'Каждую задачу можно разместить только один раз.',
  'Only planned tasks can be added to schedule': 'В расписание можно добавить только запланированные задачи.',
  'Schedule item duration must match task duration': 'Длительность блока должна совпадать с длительностью задачи.',
}

function validationMessage(detail, path) {
  const fallback = 'Сервер не принял данные. Проверьте заполненные поля.'
  if (typeof detail === 'string') {
    if (Object.hasOwn(validationRules, detail)) return validationRules[detail]
    const breakLength = /^Break must be exactly (\d{1,3}) minutes$/.exec(detail)
    return breakLength ? `Длительность перерыва должна составлять ${breakLength[1]} мин.` : fallback
  }
  if (!Array.isArray(detail)) return fallback

  const messages = new Set()
  for (const issue of detail) {
    if (!Array.isArray(issue?.loc)) continue
    const [location, field, index] = issue.loc
    if (location !== 'body' && location !== 'query') continue
    const rule = issue.type === 'value_error' && typeof issue.msg === 'string'
      ? issue.msg.replace(/^Value error, /, '') : ''
    if (Object.hasOwn(validationRules, rule)) messages.add(validationRules[rule])
    else if (field === 'items') messages.add(Number.isSafeInteger(index) && index >= 0
      ? `Проверьте тип, задачу и время блока расписания №${index + 1}.`
      : 'В расписании должно быть от 1 до 500 блоков.')
    else if (field === 'password') messages.add(path === '/auth/login'
      ? 'Пароль должен содержать не более 128 символов.'
      : 'Пароль должен содержать от 8 до 128 символов.')
    else if (typeof field === 'string' && Object.hasOwn(validationFields, field)) messages.add(validationFields[field])
  }
  return [...messages].join(' ') || fallback
}

function errorMessage(status, detail, path) {
  if (status === 401) return path === '/auth/login'
    ? 'Неверный email или пароль.'
    : 'Сессия истекла. Войдите снова.'
  if (status === 403) return 'Нет доступа к данным. Войдите снова.'
  if (status === 400 && detail === 'Пользователь с таким email уже зарегистрирован') {
    return 'Пользователь с таким email уже зарегистрирован. Войдите или укажите другой email.'
  }
  if (status === 422) return validationMessage(detail, path)
  if (status === 429) return 'Слишком много запросов. Попробуйте немного позже.'
  if (status >= 500) return 'Сервер временно недоступен. Попробуйте позже.'
  return 'Не удалось выполнить запрос. Попробуйте ещё раз.'
}

export async function apiRequest(path, { method = 'GET', body, token, query, signal } = {}) {
  if (signal?.aborted) throw new DOMException('Запрос отменён.', 'AbortError')
  if (globalThis.navigator?.onLine === false) {
    throw new NetworkError('Нет подключения. Повторите действие после восстановления сети.')
  }
  const controller = new AbortController()
  const abortRequest = () => controller.abort()
  signal?.addEventListener('abort', abortRequest, { once: true })
  const timeout = setTimeout(abortRequest, 10000)
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const search = new URLSearchParams()
    for (const [name, value] of Object.entries(query || {})) {
      if (value !== undefined && value !== null) search.set(name, value)
    }
    const response = await fetch(`/api${path}${search.size ? `?${search}` : ''}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
    })
    if (method === 'DELETE' && response.status === 204) return
    const data = await response.json().catch(() => null)

    if (!response.ok) throw new ApiError(errorMessage(response.status, data?.detail, path), response.status)
    if (data === null) throw new ApiError('Сервер вернул неожиданный ответ.')
    return data
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Запрос отменён.', 'AbortError')
    if (error instanceof ApiError) throw error
    if (controller.signal.aborted) throw new NetworkError('Сервер не ответил за 10 секунд. Попробуйте ещё раз.')
    throw new NetworkError('Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз.')
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abortRequest)
  }
}
