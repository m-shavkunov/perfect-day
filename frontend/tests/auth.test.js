import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'

const stored = new Map()
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  },
})

const { apiRequest } = await import('../src/api/client.js')
const { registerAccount } = await import('../src/api/auth.js')
const { auth, signIn, signOut, restoreSession } = await import('../src/state/auth.js')
const originalFetch = globalThis.fetch
const user = { id: 1, email: 'test@example.com', birth_date: '2004-02-29', chronotype: 'dove' }
const credentials = { email: user.email, password: 'TestPassword123!' }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  signOut()
  auth.notice = ''
})

after(() => { globalThis.fetch = originalFetch })

test('registration sends only supported fields with the server birth_date name', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/auth/register')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(options.body), { ...credentials, birth_date: user.birth_date, chronotype: 'dove' })
    assert.equal(options.headers.Authorization, undefined)
    return json(user, 201)
  }
  assert.deepEqual(await registerAccount({ ...credentials, birthDate: user.birth_date, chronotype: 'dove', firstName: 'Тест', gender: 'male' }), user)
})

test('login stores a token only after a successful authenticated profile request', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push(url)
    assert.equal(auth.token, '')
    if (url.endsWith('/login')) {
      assert.deepEqual(JSON.parse(options.body), credentials)
      return json({ access_token: 'test-token', token_type: 'bearer' })
    }
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    return json(user)
  }
  await signIn(credentials)
  assert.deepEqual(calls, ['/api/auth/login', '/api/users/me'])
  assert.equal(auth.user.email, user.email)
  assert.equal(stored.get('perfect-day.access-token'), 'test-token')
  assert.equal([...stored.values()].includes(credentials.password), false)
})

test('wrong password does not create a session', async () => {
  globalThis.fetch = async () => json({ detail: 'Неверный email или пароль' }, 401)
  await assert.rejects(signIn(credentials), /Неверный email или пароль/)
  assert.equal(auth.token, '')
  assert.equal(auth.user, null)
  assert.equal(stored.size, 0)
})

test('a token is not persisted when loading the profile fails', async () => {
  globalThis.fetch = async (url) => url.endsWith('/login')
    ? json({ access_token: 'test-token', token_type: 'bearer' })
    : json({}, 503)
  await assert.rejects(signIn(credentials), /Сервер временно недоступен/)
  assert.equal(stored.size, 0)
  assert.equal(auth.token, '')
})

test('expired tokens clear the stored session', async () => {
  auth.token = 'expired-token'
  auth.user = user
  stored.set('perfect-day.access-token', auth.token)
  globalThis.fetch = async () => json({ detail: 'Недействительный токен' }, 401)
  assert.equal(await restoreSession(), false)
  assert.equal(auth.token, '')
  assert.equal(auth.user, null)
  assert.equal(stored.size, 0)
})

test('temporary outages preserve a token and surface an error instead of authenticating', async () => {
  auth.token = 'existing-token'
  globalThis.fetch = async () => new Response('Internal server error', { status: 500 })
  await assert.rejects(restoreSession(), /Сервер временно недоступен/)
  assert.equal(auth.token, 'existing-token')
})

test('duplicate email produces a useful message', async () => {
  globalThis.fetch = async () => json({ detail: 'Пользователь с таким email уже зарегистрирован' }, 400)
  await assert.rejects(registerAccount({ ...credentials, birthDate: user.birth_date, chronotype: 'dove' }), /уже зарегистрирован/)
})

test('network failures have a readable message', async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  await assert.rejects(apiRequest('/health'), /Не удалось связаться с сервером/)
})

test('malformed success responses cannot authenticate', async () => {
  globalThis.fetch = async () => json({ access_token: '', token_type: 'bearer' })
  await assert.rejects(signIn(credentials), /не вернул токен/)
  assert.equal(auth.token, '')
})

test('a hanging request times out and releases its timer', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  globalThis.fetch = async (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  })
  const pending = assert.rejects(apiRequest('/health'), /не ответил за 10 секунд/)
  t.mock.timers.tick(10000)
  await pending
})
