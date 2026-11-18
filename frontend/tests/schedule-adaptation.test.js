import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createScheduleState } from '../src/state/schedule.js'
import { adaptScheduleRemainder, adaptationUnavailable, staleAdaptationReason } from '../src/utils/scheduleAdaptation.js'
import { sameScheduleItems, validateScheduleEdit } from '../src/utils/scheduleEditing.js'

const date = '2026-11-18'
const at = (hour, minute = 0, second = 0) => new Date(2026, 10, 18, hour, minute, second)
const task = (id, duration_min, priority = 'medium', status = 'planned', deadline = null) => ({
  id, user_id: 3, title: 'Задача ' + id, duration_min, priority, status, deadline, type: 'intellectual', description: null,
})
const block = (task_id, start_time, end_time, id = task_id ?? 100) => ({
  id, schedule_id: 8, task_id, item_type: task_id === null ? 'break' : 'task', start_time, end_time,
})
const adapt = (items, tasks, now = at(10, 30)) => adaptScheduleRemainder({ date, items, tasks, now })

test('adaptation retains past tasks, the current task and a started break, and only rearranges planned work', () => {
  const items = [block(1, '09:00', '09:20'), block(null, '09:20', '09:30'), block(2, '09:30', '11:00'), block(3, '14:00', '15:00')]
  const tasks = [task(1, 20, 'medium', 'done'), task(2, 90), task(3, 60, 'low'), task(4, 30, 'high'), task(5, 30, 'high', 'cancelled')]
  const before = JSON.stringify({ items, tasks })
  const result = adapt(items, tasks)
  for (const original of items.slice(0, 3)) assert.ok(result.items.some(item => sameScheduleItems([item], [original])))
  assert.equal(result.items.find(item => item.task_id === 4).start_time, '11:10')
  assert.equal(result.items.find(item => item.task_id === 3).start_time, '11:50')
  assert.equal(result.items.some(item => item.task_id === 5), false)
  assert.equal(result.frozenCount, 3)
  assert.deepEqual(validateScheduleEdit(result.items, tasks, items).errors, [])
  assert.equal(JSON.stringify({ items, tasks }), before)
})

test('lunch stays free and smaller work can use a gap that cannot fit a higher priority task', () => {
  const result = adapt([], [task(1, 30, 'high'), task(2, 10, 'low')], at(12, 50))
  assert.equal(result.items.find(item => item.task_id === 2).start_time, '12:50')
  assert.equal(result.items.find(item => item.task_id === 1).start_time, '14:00')
  assert.deepEqual(validateScheduleEdit(result.items, [task(1, 30, 'high'), task(2, 10, 'low')]).errors, [])
})

test('priority and deadline determine the order, and missed deadlines are reported without fabricating completion', () => {
  const tasks = [task(1, 30, 'high', 'planned', at(16).toISOString()), task(2, 30, 'high', 'planned', at(14, 20).toISOString()),
    task(3, 20, 'low', 'planned', at(9).toISOString())]
  const result = adapt([], tasks, at(14))
  assert.deepEqual(result.items.filter(item => item.item_type === 'task').map(item => item.task_id), [2, 1, 3])
  assert.match(result.deadlineWarnings.find(item => item.task_id === 2).reason, /позже/)
  assert.match(result.deadlineWarnings.find(item => item.task_id === 3).reason, /уже прошёл/)
  assert.equal(tasks[2].status, 'planned')
})

test('oversized work remains unplaced, breaks are exactly ten minutes, and a final task may end exactly at 18:00', () => {
  const tasks = [task(1, 9999, 'high'), task(2, 10), task(3, 40)]
  const result = adapt([], tasks, at(17))
  assert.deepEqual(result.unplaced.map(item => item.task_id), [1])
  assert.deepEqual(result.items.map(item => [item.item_type, item.start_time, item.end_time]), [
    ['task', '17:00', '17:10'], ['break', '17:10', '17:20'], ['task', '17:20', '18:00'],
  ])
  assert.deepEqual(validateScheduleEdit(result.items, tasks).errors, [])
})

test('future history remains anchored, with breaks around it, and a current break is not duplicated', () => {
  const items = [block(null, '10:00', '10:10'), block(1, '11:00', '12:00')]
  const tasks = [task(1, 60, 'medium', 'cancelled'), task(2, 40, 'high'), task(3, 30)]
  const result = adapt(items, tasks, at(10, 5))
  assert.equal(result.items.find(item => item.task_id === 2).start_time, '10:10')
  assert.equal(result.items.find(item => item.task_id === 3).start_time, '12:10')
  assert.equal(result.items.filter(item => item.start_time === '10:00').length, 1)
  assert.ok(result.items.some(item => sameScheduleItems([item], [items[1]])))
  assert.deepEqual(validateScheduleEdit(result.items, tasks, items).errors, [])
})

test('seconds round new starts forward, and the preview expires if a new start or an original block has passed', () => {
  const result = adapt([], [task(1, 30)], at(10, 30, 1))
  assert.equal(result.items[0].start_time, '10:31')
  assert.equal(staleAdaptationReason(result, result.items, date, at(10, 30, 50)), '')
  assert.match(staleAdaptationReason(result, result.items, date, at(10, 31, 1)), /время начала уже прошло/)
  const items = [block(2, '11:00', '12:00')]
  const proposal = adapt(items, [task(2, 60)], at(10))
  assert.match(staleAdaptationReason(proposal, proposal.items, date, at(11, 1)), /исходных блоков/)
})

test('adaptation is limited to today and working hours, and before work it starts at 09:00', () => {
  assert.match(adaptationUnavailable('2026-11-19', at(10)), /на сегодня/)
  assert.throws(() => adapt([], [task(1, 30)], at(18)), /Рабочий день завершён/)
  assert.equal(adapt([], [task(1, 30)], at(7)).items[0].start_time, '09:00')
  assert.equal(adapt([], [task(1, 30)], at(13, 20)).items[0].start_time, '14:00')
})

test('unchanged times reuse break identities and repeated calculations produce the same result', () => {
  const tasks = [task(1, 30), task(2, 30)]
  const items = [block(1, '14:00', '14:30'), block(null, '14:30', '14:40'), block(2, '14:40', '15:10')]
  const first = adapt(items, tasks, at(14))
  const second = adapt(items, tasks, at(14))
  assert.ok(sameScheduleItems(first.items, items))
  assert.equal(first.items.find(item => item.item_type === 'break').key, 'break:100')
  assert.deepEqual(first, second)
})

test('new break keys cannot collide with keys retained from a previously saved browser variant', () => {
  const items = [{ ...block(null, '14:30', '14:40'), key: 'adapted-break:1' }]
  const result = adapt(items, [task(1, 30), task(2, 30), task(3, 30)], at(14))
  assert.equal(new Set(result.items.map(item => item.key)).size, result.items.length)
})

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
const json = (value, status = 200) => new Response(JSON.stringify(value), { status })

async function fixture({ history = false, onUnauthorized = () => {} } = {}) {
  const server = {
    now: at(10, 30), error: 0, calls: [],
    tasks: [task(1, 60, 'medium', history ? 'done' : 'planned'), task(2, 60), task(3, 60, 'low'), task(4, 30, 'high'), task(5, 9999)],
    plan: { id: 8, user_id: 3, date, items: [block(1, '09:00', '10:00'), block(2, '10:00', '11:00'), block(3, '14:00', '15:00')] },
  }
  const values = new Map()
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  globalThis.fetch = async (path, request) => {
    server.calls.push({ path, method: request.method, body: request.body && JSON.parse(request.body) })
    if (server.error) return json({}, server.error)
    if (path.startsWith('/api/recommendations/')) return json({ date, items: [] })
    if (path === '/api/tasks/') return json(server.tasks)
    if (path === '/api/schedules/8' && request.method === 'GET') return json(server.plan)
    if (path === '/api/schedules/8' && request.method === 'PUT') {
      const body = JSON.parse(request.body)
      server.plan = { ...server.plan, items: body.items.map((item, index) => ({ ...item, id: index + 200, schedule_id: 8 })) }
      return json(server.plan)
    }
    throw new Error('Unexpected API call: ' + path)
  }
  const page = createScheduleState({ userId: 3, getToken: () => 'test-token', storage, getNow: () => server.now, onUnauthorized })
  await page.loadTasks()
  await page.open({ date, id: 8 })
  return { page, server, values }
}

test('preparing and cancelling adaptation performs only GET requests and leaves the saved plan intact', async () => {
  const { page, server } = await fixture()
  const before = JSON.stringify(page.state.plan)
  assert.equal(await page.adaptRemainder(), true)
  assert.equal(page.state.adaptation.frozenCount, 2)
  assert.deepEqual(page.state.adaptation.unplaced.map(item => item.task_id), [5])
  assert.equal(page.placeItem(block(4, '16:00', '16:30')), false)
  assert.equal(page.removeItem('task:2'), false)
  assert.equal(JSON.stringify(page.state.plan), before)
  assert.equal(server.calls.some(call => call.method === 'POST' || call.method === 'PUT'), false)
  assert.equal(page.cancelEdit(), true)
  assert.equal(page.state.adaptation, null)
  assert.equal(JSON.stringify(page.state.plan), before)
  page.dispose()
})

test('confirmed adaptation uses a full PUT with past and current blocks unchanged, never full generation', async () => {
  const { page, server } = await fixture()
  const frozen = server.plan.items.slice(0, 2)
  await page.adaptRemainder()
  assert.equal(await page.saveEdit(), true)
  const writes = server.calls.filter(call => call.method === 'PUT')
  assert.equal(writes.length, 1)
  for (const item of frozen) assert.ok(writes[0].body.items.some(saved => sameScheduleItems([item], [saved])))
  assert.equal(server.calls.some(call => call.method === 'POST'), false)
  assert.equal(page.state.adaptation, null)
  page.dispose()
})

test('time advancing during preview blocks the save and recalculation freezes newly started original blocks', async () => {
  const { page, server } = await fixture()
  await page.adaptRemainder()
  server.now = at(14, 10)
  assert.equal(await page.saveEdit(), false)
  assert.equal(page.state.adaptationStale, true)
  assert.equal(server.calls.some(call => call.method === 'PUT'), false)
  assert.equal(await page.adaptRemainder(), true)
  assert.ok(page.state.draft.some(item => sameScheduleItems([item], [server.plan.items[2]])))
  assert.equal(page.state.adaptationStale, false)
  assert.equal(await page.saveEdit(), true)
  page.dispose()
})

test('fresh task changes require another calculation, and completed history still needs explicit browser saving', async () => {
  const { page, server, values } = await fixture({ history: true })
  await page.adaptRemainder()
  server.tasks = server.tasks.map(item => item.id === 3 ? { ...item, priority: 'high' } : item)
  assert.equal(await page.saveEdit({ local: true }), false)
  assert.equal(page.state.adaptationStale, true)
  assert.equal(values.has('perfect-day.schedule-edit.3.8'), false)
  await page.adaptRemainder()
  assert.equal(await page.saveEdit(), false)
  assert.equal(await page.saveEdit({ local: true }), true)
  assert.equal(page.state.localStatus, 'saved')
  assert.equal(server.calls.some(call => call.method === 'PUT'), false)
  page.dispose()
})

test('adaptation preflight failures preserve the plan, do not write, and handle expired sessions', async () => {
  for (const status of [500, 401]) {
    let expired = 0
    const { page, server } = await fixture({ onUnauthorized: () => { expired++ } })
    const before = JSON.stringify(page.state.plan)
    server.error = status
    assert.equal(await page.adaptRemainder(), false)
    assert.equal(JSON.stringify(page.state.plan), before)
    assert.equal(page.state.draft, null)
    assert.equal(expired, status === 401 ? 1 : 0)
    assert.equal(server.calls.some(call => call.method === 'PUT'), false)
    page.dispose()
  }
})

test('a server change during adaptation preflight blocks replacing the plan with a stale proposal', async () => {
  const { page, server } = await fixture()
  server.plan = { ...server.plan, items: server.plan.items.map(item => ({ ...item, id: item.id + 100 })) }
  assert.equal(await page.adaptRemainder(), false)
  assert.equal(page.state.saveConflict, true)
  assert.equal(page.state.draft, null)
  assert.equal(server.calls.some(call => call.method === 'PUT'), false)
  page.dispose()
})

test('pending adaptation blocks duplicate actions, and leaving the page ignores its late proposal', async () => {
  const { page, server } = await fixture()
  let finish
  globalThis.fetch = async path => path === '/api/tasks/' ? json(server.tasks) : new Promise(resolve => { finish = resolve })
  const adapting = page.adaptRemainder()
  assert.equal(page.state.adapting, true)
  assert.equal(await page.adaptRemainder(), false)
  assert.equal(page.beginEdit(), false)
  assert.equal(await page.generate(), null)
  page.dispose()
  finish(json(server.plan))
  assert.equal(await adapting, false)
  assert.equal(page.state.draft, null)
})

test('an unchanged adaptation can be reviewed and cancelled without a write', async () => {
  const { page, server } = await fixture()
  server.tasks = server.tasks.slice(0, 2)
  server.plan = { ...server.plan, items: server.plan.items.slice(0, 2) }
  await page.open({ date, id: 8 }, { force: true })
  assert.equal(await page.adaptRemainder(), true)
  assert.equal(page.dirty.value, false)
  assert.deepEqual(page.state.adaptation.unplaced, [])
  assert.equal(await page.saveEdit(), false)
  assert.equal(page.cancelEdit(), true)
  assert.equal(server.calls.some(call => call.method === 'PUT'), false)
  page.dispose()
})
