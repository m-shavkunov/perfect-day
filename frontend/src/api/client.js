export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function errorMessage(status, detail) {
  if (status === 401) return 'Неверный email или пароль.'
  if (status === 400 && detail === 'Пользователь с таким email уже зарегистрирован') {
    return 'Пользователь с таким email уже зарегистрирован. Войдите или укажите другой email.'
  }
  if (status === 422) return 'Сервер не принял данные. Проверьте заполненные поля.'
  if (status === 429) return 'Слишком много запросов. Попробуйте немного позже.'
  if (status >= 500) return 'Сервер временно недоступен. Попробуйте позже.'
  return 'Не удалось выполнить запрос. Попробуйте ещё раз.'
}

export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
    })
    const data = await response.json().catch(() => null)

    if (!response.ok) throw new ApiError(errorMessage(response.status, data?.detail), response.status)
    if (data === null) throw new ApiError('Сервер вернул неожиданный ответ.')
    return data
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (controller.signal.aborted) throw new ApiError('Сервер не ответил за 10 секунд. Попробуйте ещё раз.')
    throw new ApiError('Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз.')
  } finally {
    clearTimeout(timeout)
  }
}
