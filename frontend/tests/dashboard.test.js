import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { apiRequest } from '../src/api/client.js'
import { getBiorhythms, getBiorhythmPeriod, getCriticalDays } from '../src/api/biorhythms.js'
import { getRecommendations } from '../src/api/recommendations.js'
import { createDashboardState } from '../src/state/dashboard.js'
import { getPeriodRange, isDateString, localDateString } from '../src/utils/dates.js'

const originalFetch = globalThis.fetch
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const values = { physical: 0, emotional: -42.5, intellectual: 80 }
const calls = []

function responseFor(url) {
  const { pathname, searchParams } = new URL(url, 'http://localhost')
  if (pathname.endsWith('/period')) return { items: [{ date: searchParams.get('start_date'), ...values }] }
  if (pathname.endsWith('/critical-days')) return { items: [] }
  if (pathname.endsWith('/recommendations/')) return { date: searchParams.get('target_date'), items: [] }
  return values
}

function successfulFetch(url, options) {
  calls.push({ url, options })
  return Promise.resolve(json(responseFor(url)))
}

function createState(options = {}) {
  return createDashboardState({ getToken: () => 'test-token', onUnauthorized: () => {}, initialDate: '2026-11-08', ...options })
}

beforeEach(() => {
  calls.length = 0
  globalThis.fetch = successfulFetch
})

after(() => { globalThis.fetch = originalFetch })

test('dashboard API sends explicit server dates and a Bearer token, preserving zero and negative values', async () => {
  const options = { targetDate: '2026-11-08', startDate: '2026-11-02', endDate: '2026-11-08', token: 'test-token' }
  assert.deepEqual(await getBiorhythms(options), values)
  await getBiorhythmPeriod(options)
  await getCriticalDays(options)
  await getRecommendations(options)
  assert.deepEqual(calls.map(({ url }) => url), [
    '/api/biorhythms/?target_date=2026-11-08',
    '/api/biorhythms/period?start_date=2026-11-02&end_date=2026-11-08',
    '/api/biorhythms/critical-days?start_date=2026-11-02&end_date=2026-11-08',
    '/api/recommendations/?target_date=2026-11-08',
  ])
  for (const { options: request } of calls) {
    assert.equal(request.headers.Authorization, 'Bearer test-token')
    assert.equal(request.method, 'GET')
  }
})

test('recommendations preserve a null activity value for routine tasks', async () => {
  const data = { date: '2026-11-08', items: [{ task_id: 1, title: 'Задача', task_type: 'routine', recommendation: 'В удобное время', reason: 'Рутинная задача', activity_value: null }] }
  globalThis.fetch = async () => json(data)
  assert.deepEqual(await getRecommendations({ targetDate: data.date, token: 'test-token' }), data)
})

test('malformed successful responses are reported instead of being treated as loaded data', async () => {
  globalThis.fetch = async () => json({ items: [{}] })
  for (const request of [getBiorhythms, getBiorhythmPeriod, getCriticalDays, getRecommendations]) {
    await assert.rejects(request({ token: 'test-token' }), /Сервер вернул некорректн/)
  }
})

test('calendar periods include both boundaries, Monday to Sunday, and leap-year months', () => {
  assert.deepEqual(getPeriodRange('2026-11-08', 'day'), { startDate: '2026-11-08', endDate: '2026-11-08' })
  assert.deepEqual(getPeriodRange('2026-11-08', 'week'), { startDate: '2026-11-02', endDate: '2026-11-08' })
  assert.deepEqual(getPeriodRange('2026-11-09', 'week'), { startDate: '2026-11-09', endDate: '2026-11-15' })
  assert.deepEqual(getPeriodRange('2027-01-01', 'week'), { startDate: '2026-12-28', endDate: '2027-01-03' })
  assert.deepEqual(getPeriodRange('2024-02-29', 'month'), { startDate: '2024-02-01', endDate: '2024-02-29' })
  assert.deepEqual(getPeriodRange('2026-02-28', 'month'), { startDate: '2026-02-01', endDate: '2026-02-28' })
  assert.deepEqual(getPeriodRange('2026-12-31', 'month'), { startDate: '2026-12-01', endDate: '2026-12-31' })
  assert.deepEqual(getPeriodRange('9999-12-31', 'week'), { startDate: '9999-12-27', endDate: '9999-12-31' })
})

test('today uses the local calendar date and invalid date inputs are rejected', () => {
  assert.equal(localDateString(new Date(2026, 10, 8, 0, 30)), '2026-11-08')
  for (const value of ['', '2026-02-29', '2026-13-01', '2026-11-31', '0000-01-01', '2026-1-1', null]) {
    assert.equal(isDateString(value), false)
    assert.throws(() => getPeriodRange(value, 'day'), /корректную дату/)
  }
  assert.throws(() => getPeriodRange('2026-11-08', 'year'), /день, неделю или месяц/)
})

test('initial loading requests all resources and exposes their individual states', async () => {
  const model = createState()
  const pending = model.load()
  assert.equal(model.isLoading.value, true)
  for (const name of ['daily', 'forecast', 'criticalDays', 'recommendations']) assert.equal(model.state[name].status, 'loading')
  await pending
  assert.equal(model.isLoading.value, false)
  assert.equal(model.hasErrors.value, false)
  assert.equal(calls.length, 4)
  assert.deepEqual(model.state.daily.data, values)
  assert.deepEqual(model.state.recommendations.data.items, [])
  model.dispose()
})

test('a partial failure preserves successful data and retry only repeats failed requests', async () => {
  globalThis.fetch = (url, options) => url.includes('/recommendations/')
    ? Promise.resolve(json({}, 503))
    : successfulFetch(url, options)
  const model = createState()
  await model.load()
  assert.equal(model.state.daily.status, 'success')
  assert.equal(model.state.forecast.status, 'success')
  assert.equal(model.state.recommendations.status, 'error')
  assert.match(model.state.recommendations.error, /временно недоступен/)
  assert.equal(model.hasErrors.value, true)
  const dailyData = model.state.daily.data
  calls.length = 0
  globalThis.fetch = successfulFetch
  await model.retryFailed()
  assert.deepEqual(calls.map(({ url }) => url), ['/api/recommendations/?target_date=2026-11-08'])
  assert.equal(model.state.daily.data, dailyData)
  assert.equal(model.state.recommendations.status, 'success')
  assert.equal(model.hasErrors.value, false)
  model.dispose()
})

test('changing only the period reloads range resources and keeps daily data and recommendations', async () => {
  const model = createState()
  await model.load()
  const dailyData = model.state.daily.data
  calls.length = 0
  await model.setPeriod('month')
  assert.deepEqual(calls.map(({ url }) => url), [
    '/api/biorhythms/period?start_date=2026-11-01&end_date=2026-11-30',
    '/api/biorhythms/critical-days?start_date=2026-11-01&end_date=2026-11-30',
  ])
  assert.equal(model.state.daily.data, dailyData)
  calls.length = 0
  await model.setPeriod('month')
  assert.equal(calls.length, 0)
  model.dispose()
})

test('late responses from an old date cannot overwrite current data or expire the session', async () => {
  const oldRequests = []
  globalThis.fetch = (url, options) => new Promise((resolve) => oldRequests.push({ url, options, resolve }))
  let expired = 0
  const model = createState({ onUnauthorized: () => { expired++ } })
  const firstLoad = model.load()
  globalThis.fetch = successfulFetch
  await model.setDate('2026-11-09')
  assert.equal(model.state.forecast.data.items[0].date, '2026-11-09')
  assert.equal(model.state.recommendations.data.date, '2026-11-09')
  for (const [index, request] of oldRequests.entries()) {
    assert.equal(request.options.signal.aborted, true)
    request.resolve(index === 0 ? json({}, 401) : json(responseFor(request.url)))
  }
  await firstLoad
  assert.equal(model.state.forecast.data.items[0].date, '2026-11-09')
  assert.equal(model.state.recommendations.data.date, '2026-11-09')
  assert.equal(model.hasErrors.value, false)
  assert.equal(expired, 0)
  model.dispose()
})

test('an expired session cancels the batch and notifies the page once', async () => {
  globalThis.fetch = async () => json({}, 401)
  let expired = 0
  const model = createState({ onUnauthorized: () => { expired++ } })
  await model.load()
  assert.equal(expired, 1)
  assert.equal(model.isLoading.value, false)
  assert.equal(model.state.daily.data, null)
  calls.length = 0
  globalThis.fetch = successfulFetch
  await model.load()
  assert.equal(calls.length, 0)
})

test('disposing a dashboard aborts pending requests without surfacing errors', async () => {
  const signals = []
  globalThis.fetch = (url, options) => new Promise((resolve, reject) => {
    signals.push(options.signal)
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  })
  const model = createState()
  const pending = model.load()
  model.dispose()
  await pending
  assert.equal(signals.length, 4)
  assert.equal(signals.every((signal) => signal.aborted), true)
  assert.equal(model.isLoading.value, false)
  assert.equal(model.hasErrors.value, false)
})

test('caller cancellation is distinct from a timeout and a pre-aborted request never fetches', async () => {
  globalThis.fetch = (url, options) => new Promise((resolve, reject) => {
    calls.push({ url, options })
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  })
  const controller = new AbortController()
  const pending = assert.rejects(apiRequest('/health', { signal: controller.signal }), { name: 'AbortError' })
  controller.abort()
  await pending
  await assert.rejects(apiRequest('/health', { signal: controller.signal }), { name: 'AbortError' })
  assert.equal(calls.length, 1)
})
