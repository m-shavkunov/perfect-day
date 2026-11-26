import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createSettingsState } from '../src/state/settings.js'
import { prepareWorkSettings, workSettingsForm } from '../src/utils/workSettings.js'

const originalFetch = globalThis.fetch
const defaults = {
  work_start: '09:00:00', work_end: '18:00:00', lunch_start: '13:00:00', lunch_end: '14:00:00',
  break_duration_min: 10, work_before_break_min: 50,
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status })
const settings = (values = defaults, userId = 7) => ({ id: 4, user_id: userId, ...values })
const createState = (options = {}) => createSettingsState({
  userId: 7, getToken: () => 'settings-token', onUnauthorized() {}, ...options,
})
afterEach(() => { globalThis.fetch = originalFetch })

test('settings validate the day, lunch and positive integer durations', () => {
  const { errors } = prepareWorkSettings({
    ...defaults, work_start: '15:00', work_end: '11:00', lunch_end: '12:00',
    break_duration_min: 0, work_before_break_min: 2.5,
  })
  assert.deepEqual(Object.keys(errors).sort(), ['break_duration_min', 'lunch_end', 'lunch_start', 'work_before_break_min', 'work_end'])
  assert.deepEqual(prepareWorkSettings({ ...defaults, lunch_start: '09:00', lunch_end: '18:00' }).errors, {})
  assert.ok(prepareWorkSettings({ ...defaults, lunch_end: '24:00' }).errors.lunch_end)
  assert.ok(prepareWorkSettings({ ...defaults, break_duration_min: 2147483648 }).errors.break_duration_min)
})

test('unchanged time controls preserve the precision of previously saved values', () => {
  const previous = { ...defaults, work_start: '09:00:12.123456', lunch_start: '13:00:01' }
  const form = workSettingsForm(previous)
  assert.equal(form.work_start, '09:00')
  assert.deepEqual(prepareWorkSettings({ ...form, lunch_start: '12:30' }, previous), {
    body: { ...previous, lunch_start: '12:30:00' }, errors: {},
  })
})

test('settings load with JWT and save exactly six fields in a single request', async () => {
  const editor = createState()
  assert.equal(await editor.save(), false)
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/settings/')
    assert.equal(options.method, 'GET')
    assert.equal(options.headers.Authorization, 'Bearer settings-token')
    return json(settings())
  }
  await editor.load()
  assert.equal(editor.state.status, 'ready')
  assert.equal(editor.state.form.work_start, '09:00')

  const expected = { ...defaults, work_start: '10:00:00', break_duration_min: 15 }
  let finish
  globalThis.fetch = (url, options) => {
    assert.equal(url, '/api/settings/')
    assert.equal(options.method, 'PUT')
    assert.equal(options.headers.Authorization, 'Bearer settings-token')
    assert.deepEqual(JSON.parse(options.body), expected)
    return new Promise(resolve => { finish = resolve })
  }
  Object.assign(editor.state.form, { work_start: '10:00', break_duration_min: 15 })
  const saving = editor.save()
  assert.equal(editor.state.saving, true)
  assert.equal(await editor.save(), false)
  finish(json(settings(expected)))
  assert.equal(await saving, true)
  assert.equal(editor.state.saved, true)
  editor.clearFeedback()
  assert.equal(editor.state.saved, false)
})

test('loading rejects another account, permits retry and never supplies fake defaults', async () => {
  const editor = createState()
  globalThis.fetch = async () => json(settings(defaults, 8))
  await editor.load()
  assert.equal(editor.state.status, 'error')
  assert.equal(editor.state.form, null)
  assert.match(editor.state.loadError, /некорректные/)
  globalThis.fetch = async () => json(settings())
  await editor.load()
  assert.equal(editor.state.status, 'ready')
  assert.equal(editor.state.loadError, '')
})

test('invalid local fields skip PUT, and 422 or unconfirmed saves preserve the draft', async () => {
  const editor = createState()
  globalThis.fetch = async () => json(settings())
  await editor.load()
  editor.state.form.break_duration_min = 0
  let calls = 0
  globalThis.fetch = async () => { calls++; return json({}, 422) }
  assert.equal(await editor.save(), false)
  assert.ok(editor.state.fieldErrors.break_duration_min)
  assert.equal(calls, 0)
  editor.state.form.break_duration_min = 15
  assert.equal(await editor.save(), false)
  assert.match(editor.state.saveError, /не принял данные/)
  assert.equal(editor.state.form.break_duration_min, 15)

  globalThis.fetch = async () => json(settings())
  assert.equal(await editor.save(), false)
  assert.match(editor.state.saveError, /не подтвердил/)
  assert.equal(editor.state.form.break_duration_min, 15)
})

test('authorization errors invoke the session handler on load and save', async () => {
  let expired = 0
  const editor = createState({ onUnauthorized: () => { expired++ } })
  globalThis.fetch = async () => json({}, 401)
  await editor.load()
  assert.equal(expired, 1)
  globalThis.fetch = async () => json(settings())
  await editor.load()
  globalThis.fetch = async () => json({}, 403)
  assert.equal(await editor.save(), false)
  assert.equal(expired, 2)
})

test('leaving the page cancels the request and ignores a late response', async () => {
  const editor = createState()
  let finish
  let signal
  globalThis.fetch = (url, options) => {
    signal = options.signal
    return new Promise(resolve => { finish = resolve })
  }
  const loading = editor.load()
  editor.dispose()
  assert.equal(signal.aborted, true)
  finish(json(settings()))
  await loading
  assert.equal(editor.state.form, null)
})
