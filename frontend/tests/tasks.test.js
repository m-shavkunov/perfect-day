import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { apiRequest } from '../src/api/client.js'
import { getTasks } from '../src/api/tasks.js'
import { createTasksState } from '../src/state/tasks.js'
import { prepareTask, taskFormValues } from '../src/utils/tasks.js'

const task = {
  id: 8, user_id: 3, title: 'Подготовить отчёт', type: 'intellectual',
  duration_min: 60, priority: 'medium', status: 'planned', description: null, deadline: null,
}
const options = { userId: 3, token: 'test-token' }
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

test('task form validates required values and preserves an untouched deadline with seconds', () => {
  const invalid = prepareTask({ ...taskFormValues(), title: '  ', duration_min: 1.5 })
  assert.deepEqual(Object.keys(invalid.errors), ['title', 'type', 'duration_min'])
  const original = { ...task, deadline: '2026-11-19T08:30:15Z' }
  const edit = taskFormValues(original)
  assert.deepEqual(prepareTask({ ...edit, title: ' Новый отчёт ' }, original), {
    body: { title: 'Новый отчёт' }, errors: {},
  })
  assert.deepEqual(prepareTask({ ...edit, deadline: '' }, original), {
    body: { deadline: null }, errors: {},
  })
})

test('creating a task sends a local deadline as an instant and omits status', () => {
  const deadline = '2026-11-19T13:30'
  const result = prepareTask({
    ...taskFormValues(), title: 'Отчёт', type: 'intellectual', duration_min: '60', deadline,
  })
  assert.deepEqual(result, {
    body: {
      title: 'Отчёт', type: 'intellectual', duration_min: 60, priority: 'medium',
      deadline: new Date(deadline).toISOString(), description: null,
    },
    errors: {},
  })
})

test('task writes enforce API limits while partial edits omit untouched fields', () => {
  const atLimit = { ...taskFormValues(task), title: '🙂'.repeat(200), description: 'я'.repeat(2000), duration_min: 1440 }
  assert.deepEqual(prepareTask(atLimit).errors, {})
  const overLimit = { ...atLimit, title: atLimit.title + '🙂', description: atLimit.description + 'я', duration_min: 1441 }
  assert.deepEqual(Object.keys(prepareTask(overLimit).errors).sort(), ['description', 'duration_min', 'title'])

  const original = { ...task, ...overLimit, title: ' Старое название ', deadline: null, description: 'Описание' }
  assert.deepEqual(prepareTask({ ...taskFormValues(original), description: '', status: 'done' }, original), {
    body: { description: null, status: 'done' }, errors: {},
  })
})

test('task list rejects duplicate IDs and tasks from another account', async () => {
  for (const data of [[task, task], [{ ...task, user_id: 10 }]]) {
    globalThis.fetch = async () => json(data)
    await assert.rejects(getTasks(options), /некорректный список задач/)
  }
})

test('update sends a partial change, successful 204 removes the task and GET still expects JSON', async () => {
  const tasks = createTasksState({ userId: 3, getToken: () => options.token })
  globalThis.fetch = async (path, request) => {
    assert.equal(request.headers.Authorization, 'Bearer test-token')
    if (request.method === 'GET') {
      assert.equal(path, '/api/tasks/')
      return json([task])
    }
    assert.equal(path, '/api/tasks/8')
    if (request.method === 'PUT') {
      assert.deepEqual(JSON.parse(request.body), { status: 'done' })
      return json({ ...task, status: 'done' })
    }
    assert.equal(request.method, 'DELETE')
    return new Response(null, { status: 204 })
  }

  await tasks.load()
  assert.equal(await tasks.update(8, { status: 'done' }), true)
  assert.equal(tasks.state.items[0].status, 'done')
  assert.equal(await tasks.remove(8), true)
  assert.deepEqual(tasks.state.items, [])

  globalThis.fetch = async () => new Response(null, { status: 204 })
  await assert.rejects(apiRequest('/tasks/'), /неожиданный ответ/)
})

test('one pending mutation blocks another and a failed delete keeps the task visible', async () => {
  const tasks = createTasksState({ userId: 3, getToken: () => options.token })
  globalThis.fetch = async () => json([task])
  await tasks.load()

  let finish
  globalThis.fetch = () => new Promise(resolve => { finish = resolve })
  const deleting = tasks.remove(8)
  assert.equal(await tasks.update(8, { status: 'done' }), false)
  finish(json({}, 500))
  assert.equal(await deleting, false)
  assert.deepEqual(tasks.state.items, [task])
  assert.match(tasks.state.error, /Сервер не смог удалить задачу/)
  assert.equal(tasks.state.failedDeleteId, 8)
})

test('a failed delete does not cancel a task, and a later explicit cancellation uses only the task API', async () => {
  const tasks = createTasksState({ userId: 3, getToken: () => options.token })
  globalThis.fetch = async () => json([task])
  await tasks.load()
  const calls = []
  globalThis.fetch = async (path, request) => {
    calls.push({ path, method: request.method })
    assert.equal(path, '/api/tasks/8')
    if (request.method === 'DELETE') return json({}, 500)
    assert.equal(request.method, 'PUT')
    assert.deepEqual(JSON.parse(request.body), { status: 'cancelled' })
    return json({ ...task, status: 'cancelled' })
  }

  assert.equal(await tasks.remove(8), false)
  assert.deepEqual(tasks.state.items, [task])
  assert.deepEqual(calls, [{ path: '/api/tasks/8', method: 'DELETE' }])
  assert.equal(tasks.state.failedDeleteId, 8)
  assert.equal(tasks.state.busy, false)
  assert.equal(await tasks.update(8, { status: 'cancelled' }), true)
  assert.equal(tasks.state.items[0].status, 'cancelled')
  assert.equal(tasks.state.failedDeleteId, null)
  assert.equal(tasks.state.error, '')
})

test('temporary server outages during delete keep their own error and do not suggest a schedule conflict', async () => {
  const tasks = createTasksState({ userId: 3, getToken: () => options.token })
  globalThis.fetch = async () => json([task])
  await tasks.load()
  globalThis.fetch = async () => json({}, 503)
  assert.equal(await tasks.remove(8), false)
  assert.equal(tasks.state.failedDeleteId, null)
  assert.match(tasks.state.error, /Сервер временно недоступен/)
  assert.deepEqual(tasks.state.items, [task])
})
