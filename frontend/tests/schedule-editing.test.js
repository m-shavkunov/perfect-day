import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { updateSchedule } from '../src/api/schedules.js'
import { createScheduleState } from '../src/state/schedule.js'
import {
  draftScheduleItems, firstAvailableStart, readLocalSchedule, saveLocalSchedule,
  schedulePayload, validateScheduleEdit,
} from '../src/utils/scheduleEditing.js'

const date = '2026-11-19'
const options = { userId: 3, token: 'test-token' }
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
const json = (value, status = 200) => new Response(JSON.stringify(value), { status })
const task = (id, duration_min = 60, status = 'planned') => ({
  id, user_id: 3, title: 'Задача ' + id, duration_min, status, type: 'intellectual', priority: 'medium', description: null, deadline: null,
})
const block = (task_id, start_time, end_time, id = 1) => ({ id, schedule_id: 8, task_id, item_type: task_id === null ? 'break' : 'task', start_time, end_time })
const originalPlan = () => ({ id: 8, user_id: 3, date, items: [block(10, '09:00:00', '10:00:00'), block(null, '10:00:00', '10:10:00', 2)] })
const tasks = () => [task(10), task(11, 30), task(12, 15)]
const storageFixture = () => {
  const values = new Map()
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}

async function fixture({ plan = originalPlan(), items = tasks(), storage = storageFixture(), onUnauthorized = () => {} } = {}) {
  const server = { plan, tasks: items, putError: 0, calls: [] }
  globalThis.fetch = async (path, request) => {
    const body = request.body && JSON.parse(request.body)
    server.calls.push({ path, method: request.method, body })
    if (path.startsWith('/api/recommendations/')) return json({ date: server.plan.date, items: [] })
    if (path === '/api/tasks/') return json(server.tasks)
    if (path === '/api/schedules/8' && request.method === 'GET') return json(server.plan)
    if (path === '/api/schedules/8' && request.method === 'PUT') {
      if (server.putError) return json({}, server.putError)
      server.plan = { ...server.plan, items: body.items.map((item, index) => ({ ...item, id: index + 100, schedule_id: 8 })) }
      return json(server.plan)
    }
    throw new Error('Unexpected request: ' + path)
  }
  const page = createScheduleState({ userId: 3, getToken: () => options.token, storage, onUnauthorized })
  await page.loadTasks()
  await page.open({ id: 8, date })
  return { page, server, storage }
}

test('manual placement respects adjacent blocks, lunch, work boundaries, duplicate tasks and exact break length', () => {
  const normal = originalPlan().items
  assert.deepEqual(validateScheduleEdit([...normal, block(11, '10:10', '10:40', 3)], tasks()).errors, [])
  for (const invalid of [
    block(11, '09:30', '10:00'), block(11, '12:45', '13:15'), block(11, '08:30', '09:00'),
    block(11, '17:45', '18:15'), block(10, '11:00', '12:00'), block(null, '11:00', '11:15'),
  ]) assert.ok(validateScheduleEdit([...normal, invalid], tasks()).errors.length)
  assert.equal(firstAvailableStart(normal, 30), '10:10')
  assert.equal(firstAvailableStart([block(10, '09:00', '13:00')], 60), '14:00')
})

test('completed, cancelled and changed-duration history can only be retained unchanged and require explicit local saving', () => {
  const items = originalPlan().items
  for (const changed of [task(10, 60, 'done'), task(10, 60, 'cancelled'), task(10, 75)]) {
    const assessment = validateScheduleEdit(items, [changed], items)
    assert.deepEqual(assessment.errors, [])
    assert.equal(assessment.localReasons.length, 1)
    const moved = [block(10, '11:00', '12:00'), items[1]]
    assert.ok(validateScheduleEdit(moved, [changed], items).errors.length)
  }
})

test('PUT sends the complete list with only supported fields and accepts newly allocated row IDs', async () => {
  const items = draftScheduleItems([...originalPlan().items, block(11, '14:00', '14:30', 3)])
  globalThis.fetch = async (path, request) => {
    assert.equal(path, '/api/schedules/8')
    assert.equal(request.method, 'PUT')
    assert.equal(request.headers.Authorization, 'Bearer test-token')
    const body = JSON.parse(request.body)
    assert.deepEqual(body, { items: schedulePayload(items) })
    assert.ok(body.items.every(item => Object.keys(item).sort().join(',') === 'end_time,item_type,start_time,task_id'))
    return json({ ...originalPlan(), items: body.items.map((item, index) => ({ ...item, id: index + 50, schedule_id: 8 })) })
  }
  const saved = await updateSchedule({ id: 8, date, items, ...options })
  assert.equal(saved.items.length, 3)
  globalThis.fetch = async () => json(originalPlan())
  await assert.rejects(updateSchedule({ id: 8, date, items, ...options }), /не подтвердил сохранение всех блоков/)
})

test('draft edits preserve the saved plan and untouched breaks until a confirmed full PUT', async () => {
  const { page, server } = await fixture()
  const before = JSON.stringify(page.state.plan)
  assert.equal(page.beginEdit(), true)
  assert.equal(page.placeItem(block(10, '11:00', '12:00'), 'task:10'), true)
  assert.equal(page.placeItem(block(11, '14:00', '14:30')), true)
  assert.equal(page.dirty.value, true)
  assert.equal(page.changes.value.length, 2)
  assert.equal(JSON.stringify(page.state.plan), before)
  assert.equal(server.calls.filter(call => call.method === 'PUT').length, 0)
  assert.equal(await page.saveEdit(), true)
  const writes = server.calls.filter(call => call.method === 'PUT')
  assert.equal(writes.length, 1)
  assert.equal(writes[0].body.items.length, 3)
  assert.deepEqual(writes[0].body.items.find(item => item.item_type === 'break'), schedulePayload(originalPlan().items)[1])
  assert.equal(page.state.draft, null)
  assert.equal(page.state.plan.items.find(item => item.task_id === 10).start_time, '11:00')
  page.dispose()
})

test('conflicting placement is rejected before saving and cancelling a draft restores the original display', async () => {
  const { page, server } = await fixture()
  page.beginEdit()
  assert.equal(page.placeItem(block(11, '09:30', '10:00')), false)
  assert.equal(page.dirty.value, false)
  assert.equal(page.removeItem('task:10'), true)
  assert.equal(page.displayedItems.value.length, 1)
  assert.equal(page.cancelEdit(), true)
  assert.equal(page.displayedItems.value.length, 2)
  assert.equal(server.calls.filter(call => call.method === 'PUT').length, 0)
  page.dispose()
})

test('a fresh server conflict prevents overwrite and retains the draft', async () => {
  const { page, server } = await fixture()
  page.beginEdit()
  page.placeItem(block(11, '14:00', '14:30'))
  server.plan = { ...server.plan, items: [block(10, '11:00', '12:00'), server.plan.items[1]] }
  assert.equal(await page.saveEdit(), false)
  assert.equal(page.state.saveConflict, true)
  assert.equal(page.state.draft.length, 3)
  assert.equal(server.calls.filter(call => call.method === 'PUT').length, 0)
  page.dispose()
})

test('network/server failures retain the draft and never create a local fallback', async () => {
  for (const status of [422, 500, 503]) {
    const { page, server, storage } = await fixture()
    page.beginEdit()
    page.placeItem(block(11, '14:00', '14:30'))
    server.putError = status
    assert.equal(await page.saveEdit(), false)
    assert.equal(page.dirty.value, true)
    assert.equal(page.state.plan.items.length, 2)
    assert.equal(page.state.localItems, null)
    assert.equal([...storage.values.keys()].some(key => key.startsWith('perfect-day.schedule-edit.')), false)
    assert.equal(page.state.saving, false)
    page.dispose()
  }
})

test('historical blocks are protected, and an explicitly saved local variant reopens only for its account and server snapshot', async () => {
  const { page, server, storage } = await fixture({ items: [task(10, 60, 'done'), task(11, 30)] })
  page.beginEdit()
  assert.equal(page.removeItem('task:10'), false)
  assert.equal(page.placeItem(block(10, '11:00', '12:00'), 'task:10'), false)
  assert.equal(page.placeItem(block(11, '14:00', '14:30')), true)
  assert.equal(await page.saveEdit(), false)
  assert.equal(server.calls.filter(call => call.method === 'PUT').length, 0)
  assert.equal(await page.saveEdit({ local: true }), true)
  assert.equal(page.state.localStatus, 'saved')
  assert.equal(page.state.plan.items.length, 2)
  assert.equal(page.displayedItems.value.length, 3)
  assert.equal(readLocalSchedule(storage, server.plan).items.length, 3)
  assert.equal(readLocalSchedule(storage, { ...server.plan, user_id: 4 }).status, 'none')
  const saved = storage.values.get('perfect-day.schedule-edit.3.8')
  assert.equal(saved.includes('test-token'), false)
  assert.equal(readLocalSchedule(storage, { ...server.plan, items: [block(10, '11:00', '12:00'), server.plan.items[1]] }).status, 'stale')
  await page.open({ id: 8, date }, { force: true })
  assert.equal(page.displayedItems.value.length, 3)
  assert.equal(page.discardLocal(), true)
  assert.equal(page.displayedItems.value.length, 2)
  page.dispose()
})

test('a status change discovered at save time requires a new explicit local-save decision', async () => {
  const { page, server } = await fixture()
  page.beginEdit()
  page.placeItem(block(11, '14:00', '14:30'))
  server.tasks = [task(10, 60, 'done'), task(11, 30)]
  assert.equal(await page.saveEdit(), false)
  assert.equal(page.editValidation.value.localReasons.length, 1)
  assert.equal(page.state.draft.length, 3)
  assert.equal(server.calls.filter(call => call.method === 'PUT').length, 0)
  page.dispose()
})

test('a task becoming historical after it was unplaced cannot be silently removed by a full PUT or a restored local variant', async () => {
  for (const changed of [task(10, 60, 'done'), task(10, 60, 'cancelled'), task(10, 75)]) {
    const { page, server, storage } = await fixture()
    page.beginEdit()
    assert.equal(page.removeItem('task:10'), true)
    server.tasks = [changed, task(11, 30)]
    assert.equal(await page.saveEdit(), false)
    assert.match(page.state.saveError, /должен остаться/)
    assert.equal(server.calls.filter(call => call.method === 'PUT').length, 0)
    assert.equal(page.dirty.value, true)
    saveLocalSchedule(storage, server.plan, page.state.draft)
    await page.open({ id: 8, date }, { force: true })
    assert.equal(page.state.localStatus, 'invalid')
    assert.equal(page.state.localItems, null)
    assert.equal(page.displayedItems.value.length, 2)
    page.dispose()
  }
})

test('blocked local storage cannot report success, and corrupt or obsolete variants never override the server plan', async () => {
  const { page, storage, server } = await fixture({ items: [task(10, 60, 'cancelled'), task(11, 30)] })
  page.beginEdit()
  page.placeItem(block(11, '14:00', '14:30'))
  storage.setItem = () => { throw new Error('Quota exceeded') }
  assert.equal(await page.saveEdit({ local: true }), false)
  assert.equal(page.dirty.value, true)
  assert.equal(page.state.localStatus, 'none')
  storage.values.set('perfect-day.schedule-edit.3.8', '{broken')
  assert.equal(readLocalSchedule(storage, server.plan).status, 'invalid')
  await page.open({ id: 8, date }, { force: true })
  assert.equal(page.state.localItems, null)
  assert.equal(page.state.localStatus, 'invalid')
  page.dispose()
})

test('a restored local variant is rejected if its newly placed task is no longer planned', async () => {
  const storage = storageFixture()
  const plan = originalPlan()
  saveLocalSchedule(storage, plan, [...plan.items, block(11, '14:00', '14:30')])
  const { page } = await fixture({ storage, items: [task(10), task(11, 30, 'cancelled')] })
  assert.equal(page.state.localItems, null)
  assert.equal(page.state.localStatus, 'invalid')
  page.dispose()
})

test('leaving while save preflight is pending prevents a late PUT', async () => {
  const { page } = await fixture()
  page.beginEdit()
  page.placeItem(block(11, '14:00', '14:30'))
  let finish
  const calls = []
  globalThis.fetch = async (path, request) => {
    calls.push(request.method)
    if (path === '/api/tasks/') return json(tasks())
    return new Promise(resolve => { finish = resolve })
  }
  const saving = page.saveEdit()
  assert.equal(await page.saveEdit(), false)
  page.dispose()
  finish(json(originalPlan()))
  assert.equal(await saving, false)
  assert.equal(calls.includes('PUT'), false)
})

test('an expired save preflight requests authentication and does not offer a local fallback', async () => {
  let expired = 0
  const { page } = await fixture({ onUnauthorized: () => { expired++ } })
  page.beginEdit()
  page.placeItem(block(11, '14:00', '14:30'))
  globalThis.fetch = async () => json({}, 401)
  assert.equal(await page.saveEdit(), false)
  assert.equal(expired, 1)
  assert.equal(page.state.localItems, null)
})
