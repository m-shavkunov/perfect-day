import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { getCriticalDays } from '../src/api/biorhythms.js'
import { createDashboardState } from '../src/state/dashboard.js'
import { createChartLayout } from '../src/utils/chart.js'
import { describeCriticalEntries, getCriticalMarkers, groupCriticalDays } from '../src/utils/criticalDays.js'

const originalFetch = globalThis.fetch
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const entry = (date, biorhythm = 'physical', direction = 'negative_to_positive') => ({ date, biorhythm, direction })
const options = { startDate: '2026-11-01', endDate: '2026-11-30', token: 'test-token' }
const values = { physical: -12.5, emotional: 24, intellectual: 75 }

beforeEach(() => { globalThis.fetch = originalFetch })
after(() => { globalThis.fetch = originalFetch })

function otherData(url) {
  const { pathname, searchParams } = new URL(url, 'http://localhost')
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
  if (pathname.endsWith('/recommendations/')) return { date: searchParams.get('target_date'), items: [] }
  return values
}

test('critical dates group multiple rhythms into one day in calendar and metric order without losing directions', () => {
  const items = [entry('2026-11-30'), entry('2026-11-01', 'intellectual'), entry('2026-11-01', 'physical', 'positive_to_negative')]
  const before = structuredClone(items)
  const days = groupCriticalDays(items)
  assert.equal(days.length, 2)
  assert.deepEqual(days.map(day => day.date), ['2026-11-01', '2026-11-30'])
  assert.deepEqual(days[0].entries.map(item => item.biorhythm), ['physical', 'intellectual'])
  assert.deepEqual(days[0].entries.map(item => item.transition), ['+ → −', '− → +'])
  assert.match(describeCriticalEntries(days[0].entries), /Физический: из положительных значений в отрицательные/)
  assert.match(describeCriticalEntries(days[0].entries), /Интеллектуальный: из отрицательных значений в положительные/)
  assert.deepEqual(items, before)
  assert.deepEqual(groupCriticalDays([]), [])
})

test('critical markers use the actual date and rhythm point rather than forcing every transition to zero', () => {
  const layout = createChartLayout([{ date: '2026-11-08', ...values }], 320, 200)
  const markers = getCriticalMarkers(layout, [entry('2026-11-08'), entry('2026-11-08', 'emotional')])
  assert.equal(markers.length, 2)
  assert.equal(markers[0].y, layout.series[0].points[0].y)
  assert.equal(markers[1].y, layout.series[1].points[0].y)
  assert.notEqual(markers[0].y, layout.yTicks.find(tick => tick.value === 0).y)
  assert.equal(markers[0].x, layout.points[0].x)
  assert.deepEqual(getCriticalMarkers(layout, [entry('2026-11-09')]), [])
  assert.deepEqual(getCriticalMarkers(layout, []), [])
  assert.deepEqual(getCriticalMarkers(createChartLayout([], 320, 200), [entry('2026-11-08')]), [])
})

test('critical API keeps both range boundaries and multiple transitions on one date, sorts dates and accepts an empty period', async () => {
  const items = [entry('2026-11-30'), entry('2026-11-01', 'emotional', 'positive_to_negative'), entry('2026-11-01')]
  globalThis.fetch = async () => json({ items })
  const result = await getCriticalDays(options)
  assert.deepEqual(result.items.map(item => item.date), ['2026-11-01', '2026-11-01', '2026-11-30'])
  assert.equal(result.items.length, 3)
  globalThis.fetch = async () => json({ items: [] })
  assert.deepEqual(await getCriticalDays(options), { items: [] })
})

test('critical API rejects out-of-period dates, duplicate rhythm/date pairs and unknown fields', async () => {
  for (const items of [
    [entry('2026-10-31')], [entry('2026-12-01')], [entry('2026-11-31')],
    [entry('2026-11-08'), entry('2026-11-08', 'physical', 'positive_to_negative')],
    [entry('2026-11-08', 'unknown')], [entry('2026-11-08', 'physical', 'unknown')],
  ]) {
    globalThis.fetch = async () => json({ items })
    await assert.rejects(getCriticalDays(options), /Сервер вернул/)
  }
})

test('a critical-days failure keeps the forecast and daily values, and retry requests only the failed resource', async () => {
  const calls = []
  globalThis.fetch = async url => {
    calls.push(url)
    return url.includes('/critical-days') ? json({}, 503) : json(otherData(url))
  }
  const model = createDashboardState({ getToken: () => 'test-token', onUnauthorized: () => {}, initialDate: '2026-11-08' })
  await model.load()
  assert.equal(model.state.criticalDays.status, 'error')
  assert.equal(model.state.criticalDays.data, null)
  assert.equal(model.state.forecast.status, 'success')
  assert.equal(model.state.daily.status, 'success')
  const forecast = model.state.forecast.data
  calls.length = 0
  globalThis.fetch = async url => { calls.push(url); return json({ items: [entry('2026-11-08')] }) }
  await model.retryFailed()
  assert.equal(calls.length, 1)
  assert.match(calls[0], /critical-days/)
  assert.equal(model.state.criticalDays.status, 'success')
  assert.equal(model.state.forecast.data, forecast)
  model.dispose()
})

test('changing ranges clears critical marks and ignores a late critical response from the old period', async () => {
  let resolveOld
  let resolveNew
  globalThis.fetch = async url => url.includes('/critical-days')
    ? new Promise(resolve => { resolveOld = resolve }) : json(otherData(url))
  const model = createDashboardState({ getToken: () => 'test-token', onUnauthorized: () => {}, initialDate: '2026-11-08' })
  const oldLoad = model.load()
  globalThis.fetch = async url => url.includes('/critical-days')
    ? new Promise(resolve => { resolveNew = resolve }) : json(otherData(url))
  const newLoad = model.setPeriod('month')
  assert.equal(model.state.criticalDays.status, 'loading')
  assert.equal(model.state.criticalDays.data, null)
  resolveNew(json({ items: [entry('2026-11-20')] }))
  await newLoad
  resolveOld(json({ items: [entry('2026-11-08')] }))
  await oldLoad
  assert.deepEqual(model.state.criticalDays.data.items, [entry('2026-11-20')])
  const currentData = model.state.criticalDays.data
  globalThis.fetch = async url => json(otherData(url))
  await model.setDate('2026-11-20')
  assert.equal(model.state.criticalDays.data, currentData)
  model.dispose()
})
