import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { generateSchedule, getSchedule } from '../src/api/schedules.js'
import { createScheduleState } from '../src/state/schedule.js'
import { nextScheduledTask, readScheduleId, rememberScheduleId, weekDates } from '../src/utils/schedule.js'
import { defaultWorkSettings } from '../src/utils/workSettings.js'

const date = '2026-11-17'
const options = { userId: 3, token: 'test-token' }
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status })
}

function plan(id, day = date, userId = options.userId) {
  return {
    id, user_id: userId, date: day, items: [
      { id: 2, schedule_id: id, task_id: null, item_type: 'break', start_time: '10:00:00', end_time: '10:10:00' },
      { id: 1, schedule_id: id, task_id: 10, item_type: 'task', start_time: '09:00:00', end_time: '10:00:00' },
    ],
  }
}

function storageFixture() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  }
}

function page(storage) {
  return createScheduleState({ userId: options.userId, getToken: () => options.token, storage })
}

test('the weekly strip covers Monday to Sunday across the year boundary', () => {
  assert.deepEqual(weekDates('2027-01-01'), [
    '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03',
  ])
  assert.equal(weekDates('9999-12-31').at(-1), '9999-12-31')
})

test('the upcoming task skips started blocks, breaks and tasks that are no longer planned', () => {
  const schedule = plan(8)
  schedule.items = [
    schedule.items[1], schedule.items[0],
    { item_type: 'task', task_id: 11, start_time: '10:30:00' },
    { item_type: 'task', task_id: 12, start_time: '11:00:00' },
    { item_type: 'task', task_id: 13, start_time: '12:30:00' },
  ]
  const tasks = new Map([
    [10, { status: 'planned' }], [11, { status: 'done' }],
    [12, { status: 'cancelled' }], [13, { status: 'planned' }],
  ])
  assert.equal(nextScheduledTask(schedule, tasks, new Date(date + 'T04:00:00Z')).task_id, 13)
  assert.equal(nextScheduledTask(schedule, tasks, new Date(date + 'T07:30:00Z')), null)
  assert.equal(nextScheduledTask(null, tasks), null)
})

test('upcoming tasks follow the reminder scheduler time zone across midnight', () => {
  const tasks = new Map([[10, { status: 'planned' }]])
  const now = new Date(date + 'T19:05:00Z')
  assert.equal(nextScheduledTask(plan(8), tasks, now), null)
  assert.equal(nextScheduledTask(plan(8, '2026-11-18'), tasks, now).task_id, 10)
  assert.equal(nextScheduledTask(plan(8, '2026-11-18'), tasks, new Date(date + 'T18:59:59Z')).task_id, 10)
})

test('generation sends the local calendar date and preserves returned task and break slots', async () => {
  globalThis.fetch = async (path, request) => {
    assert.equal(path, '/api/schedules/generate?target_date=2026-11-17')
    assert.equal(request.method, 'POST')
    assert.equal(request.headers.Authorization, 'Bearer test-token')
    assert.equal(request.body, undefined)
    return json({ schedule: plan(8), unscheduled_task_ids: [11] })
  }
  const result = await generateSchedule({ date, ...options })
  assert.deepEqual(result.schedule.items.map(item => item.item_type), ['task', 'break'])
  assert.deepEqual(result.unscheduledIds, [11])
})

test('a schedule response must match the requested ID, date and owner', async () => {
  for (const response of [plan(9), plan(8, '2026-11-18'), plan(8, date, 2)]) {
    globalThis.fetch = async () => json(response)
    await assert.rejects(getSchedule({ id: 8, date, ...options }), /некорректное расписание/)
  }
})

test('generation remembers the plan for this account and date, and a reload retrieves it with GET', async () => {
  const storage = storageFixture()
  const requests = []
  globalThis.fetch = async (path, request) => {
    if (path.startsWith('/api/recommendations/')) return json({ date, items: [] })
    if (path === '/api/tasks/') return json([])
    requests.push([request.method, path])
    if (path === '/api/settings/') return json({ id: 1, user_id: 3, ...defaultWorkSettings })
    if (request.method === 'POST') return json({ schedule: plan(8), unscheduled_task_ids: [13] })
    return json(plan(8))
  }
  const first = page(storage)
  await first.open({ date })
  assert.deepEqual(requests, [])
  assert.equal((await first.generate()).id, 8)
  assert.deepEqual(first.state.unscheduledIds, [13])
  assert.equal(readScheduleId(storage, 3, date), 8)
  assert.equal(readScheduleId(storage, 4, date), null)

  const restored = page(storage)
  await restored.open({ date })
  await restored.open({ date: '2026-11-23' })
  assert.equal(restored.state.plan, null)
  assert.equal(restored.state.planStatus, 'missing')
  assert.deepEqual(requests, [
    ['GET', '/api/settings/'],
    ['POST', '/api/schedules/generate?target_date=2026-11-17'],
    ['GET', '/api/schedules/8'],
  ])
  first.dispose()
  restored.dispose()
})

test('changing days ignores the old in-flight plan and stale IDs are removed after 404', async () => {
  const storage = storageFixture()
  rememberScheduleId(storage, 3, date, 8)
  rememberScheduleId(storage, 3, '2026-11-18', 9)
  const schedule = page(storage)
  let finishFirst
  globalThis.fetch = async (path) => {
    if (path === '/api/schedules/8') return new Promise(resolve => { finishFirst = resolve })
    if (path === '/api/schedules/9') return json({}, 404)
    throw new Error('Unexpected request')
  }
  const first = schedule.open({ date })
  await schedule.open({ date: '2026-11-18' })
  finishFirst(json(plan(8)))
  await first
  assert.equal(schedule.state.date, '2026-11-18')
  assert.equal(schedule.state.plan, null)
  assert.equal(readScheduleId(storage, 3, '2026-11-18'), null)
  assert.equal(readScheduleId(storage, 3, date), 8)
})

test('a direct link supplies the day, and a failed generation preserves the opened plan', async () => {
  const schedule = page(null)
  globalThis.fetch = async (path, request) => {
    if (request.method === 'POST') return json({}, 500)
    if (path === '/api/settings/') return json({ id: 1, user_id: 3, ...defaultWorkSettings })
    if (path.startsWith('/api/recommendations/')) return json({ date, items: [] })
    return json(plan(8))
  }
  await schedule.open({ id: 8 })
  assert.equal(schedule.state.date, date)
  assert.equal(schedule.state.storageWarning, true)
  assert.equal(await schedule.generate(), null)
  assert.equal(schedule.state.plan.id, 8)
  assert.match(schedule.state.generationError, /Сервер временно недоступен/)
  schedule.dispose()
})

test('a settings failure leaves the existing plan visible and prevents generating with unconfirmed settings', async () => {
  const schedule = page(null)
  let posts = 0
  let settingsError = 503
  globalThis.fetch = async (path, options) => {
    if (options.method === 'POST') posts++
    if (path === '/api/settings/') return settingsError ? json({}, settingsError) : json({ id: 1, user_id: 3, ...defaultWorkSettings })
    if (path.startsWith('/api/recommendations/')) return json({ date, items: [] })
    return json(plan(8))
  }
  await schedule.open({ id: 8 })
  await schedule.loadSettings()
  assert.equal(schedule.state.settings.status, 'error')
  assert.equal(schedule.state.settings.values, null)
  assert.equal(schedule.state.plan.id, 8)
  assert.equal(await schedule.generate(), null)
  assert.equal(posts, 0)
  settingsError = 0
  await schedule.loadSettings()
  assert.equal(schedule.state.settings.status, 'ready')
  assert.equal(schedule.state.settings.values.lunch_start, '13:00:00')
  schedule.dispose()
})
