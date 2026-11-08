export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function errorMessage(status, detail, path) {
  if (status === 401) return path === '/auth/login'
    ? 'Неверный email или пароль.'
    : 'Сессия истекла. Войдите снова.'
  if (status === 403) return 'Нет доступа к данным. Войдите снова.'
  if (status === 400 && detail === 'Пользователь с таким email уже зарегистрирован') {
    return 'Пользователь с таким email уже зарегистрирован. Войдите или укажите другой email.'
  }
  if (status === 422) return 'Сервер не принял данные. Проверьте заполненные поля.'
  if (status === 429) return 'Слишком много запросов. Попробуйте немного позже.'
  if (status >= 500) return 'Сервер временно недоступен. Попробуйте позже.'
  return 'Не удалось выполнить запрос. Попробуйте ещё раз.'
}

export async function apiRequest(path, { method = 'GET', body, token, query, signal } = {}) {
  const controller = new AbortController()
  const abortRequest = () => controller.abort()
  signal?.addEventListener('abort', abortRequest, { once: true })
  const timeout = setTimeout(abortRequest, 10000)
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    if (signal?.aborted) throw new DOMException('Запрос отменён.', 'AbortError')
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
    const data = await response.json().catch(() => null)

    if (!response.ok) throw new ApiError(errorMessage(response.status, data?.detail, path), response.status)
    if (data === null) throw new ApiError('Сервер вернул неожиданный ответ.')
    return data
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Запрос отменён.', 'AbortError')
    if (error instanceof ApiError) throw error
    if (controller.signal.aborted) throw new ApiError('Сервер не ответил за 10 секунд. Попробуйте ещё раз.')
    throw new ApiError('Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз.')
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abortRequest)
  }
}
