import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { getRecommendations } from '../src/api/recommendations.js'
import { createDashboardState } from '../src/state/dashboard.js'

const originalFetch = globalThis.fetch
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const item = (task_id = 1, activity_value = 0, task_type = 'intellectual') => ({
  task_id, title: 'Подготовить отчёт', task_type,
  recommendation: 'Можно выполнить задачу', reason: 'Средний уровень интеллектуальной активности', activity_value,
})
const options = { targetDate: '2026-11-09', token: 'test-token' }

beforeEach(() => { globalThis.fetch = originalFetch })
after(() => { globalThis.fetch = originalFetch })

function otherData(url) {
  const { pathname, searchParams } = new URL(url, 'http://localhost')
  const values = { physical: 10, emotional: 20, intellectual: 30 }
  if (pathname.endsWith('/period')) {
    const items = []
    const date = new Date(`${searchParams.get('start_date')}T12:00:00Z`)
    const end = new Date(`${searchParams.get('end_date')}T12:00:00Z`)
    while (date <= end) {
      items.push({ date: date.toISOString().slice(0, 10), ...values })
      date.setUTCDate(date.getUTCDate() + 1)
    }
    return { items }
  }
  if (pathname.endsWith('/critical-days')) return { items: [] }
  return values
}

test('recommendations request the chosen date and preserve server text, types, zero, negative values and null', async () => {
  const response = { date: options.targetDate, items: [item(1, 80), item(2, -63.5, 'physical'), item(3, 0, 'creative'), item(4, null, 'routine'), item(5, null, 'custom')] }
  globalThis.fetch = async (url, request) => {
    assert.equal(url, '/api/recommendations/?target_date=2026-11-09')
    assert.equal(request.headers.Authorization, 'Bearer test-token')
    return json(response)
  }
  assert.deepEqual(await getRecommendations(options), response)
  globalThis.fetch = async () => json({ date: options.targetDate, items: [] })
  assert.deepEqual(await getRecommendations(options), { date: options.targetDate, items: [] })
})

test('recommendations reject the wrong date, duplicate task IDs, missing text and invalid percentages', async () => {
  for (const response of [
    { date: '2026-11-08', items: [item()] },
    { date: '2026-11-31', items: [] },
    { date: options.targetDate, items: [item(), item()] },
    { date: options.targetDate, items: [{ ...item(), reason: null }] },
    { date: options.targetDate, items: [{ ...item(), activity_value: undefined }] },
    { date: options.targetDate, items: [item(1, '50')] },
    { date: options.targetDate, items: [item(1, 101)] },
    { date: options.targetDate, items: [item(1, -101)] },
    { date: options.targetDate, items: [item(1.5)] },
  ]) {
    globalThis.fetch = async () => json(response)
    await assert.rejects(getRecommendations(options), /Сервер вернул некорректные рекомендации/)
  }
})

test('changing the date hides old recommendations and ignores their late response', async () => {
  let resolveOld
  let resolveNew
  const model = createDashboardState({ getToken: () => 'test-token', onUnauthorized: () => {}, initialDate: '2026-11-08' })
  globalThis.fetch = async url => url.includes('/recommendations/')
    ? json({ date: '2026-11-08', items: [item()] }) : json(otherData(url))
  await model.load()
  assert.equal(model.state.recommendations.data.items.length, 1)
  globalThis.fetch = async url => url.includes('/recommendations/')
    ? new Promise(resolve => { resolveOld = resolve }) : json(otherData(url))
  const oldLoad = model.setDate('2026-11-09')
  assert.equal(model.state.recommendations.status, 'loading')
  assert.equal(model.state.recommendations.data, null)
  globalThis.fetch = async url => url.includes('/recommendations/')
    ? new Promise(resolve => { resolveNew = resolve }) : json(otherData(url))
  const newLoad = model.setDate('2026-11-10')
  resolveNew(json({ date: '2026-11-10', items: [item(2, null, 'routine')] }))
  await newLoad
  resolveOld(json({ date: '2026-11-09', items: [item()] }))
  await oldLoad
  assert.equal(model.state.recommendations.data.date, '2026-11-10')
  assert.equal(model.state.recommendations.data.items[0].task_id, 2)
  model.dispose()
})

test('the recommendations retry keeps the forecast, daily values and critical days unchanged', async () => {
  const calls = []
  globalThis.fetch = async url => url.includes('/recommendations/') ? json({}, 503) : json(otherData(url))
  const model = createDashboardState({ getToken: () => 'test-token', onUnauthorized: () => {}, initialDate: options.targetDate })
  await model.load()
  assert.equal(model.state.recommendations.status, 'error')
  const forecast = model.state.forecast.data
  const daily = model.state.daily.data
  const criticalDays = model.state.criticalDays.data
  globalThis.fetch = async url => {
    calls.push(url)
    return json({ date: options.targetDate, items: [item()] })
  }
  await model.load(['recommendations'])
  assert.deepEqual(calls, ['/api/recommendations/?target_date=2026-11-09'])
  assert.equal(model.state.recommendations.status, 'success')
  assert.equal(model.state.forecast.data, forecast)
  assert.equal(model.state.daily.data, daily)
  assert.equal(model.state.criticalDays.data, criticalDays)
  model.dispose()
})
