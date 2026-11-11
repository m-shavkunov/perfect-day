import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { updateProfile } from '../src/api/profile.js'
import { createProfileState } from '../src/state/profile.js'
import { readPlanningPreferences, savePlanningPreferences } from '../src/utils/planningPreferences.js'

const originalFetch = globalThis.fetch
const user = { id: 7, email: 'profile@example.com', birth_date: '2004-02-29', chronotype: 'dove' }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const createStorage = () => {
  const values = new Map()
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}
beforeEach(() => { globalThis.fetch = originalFetch })
after(() => { globalThis.fetch = originalFetch })

test('profile update uses the existing API and only sends birth_date and chronotype', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/users/me')
    assert.equal(options.method, 'PUT')
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    assert.deepEqual(JSON.parse(options.body), { birth_date: user.birth_date, chronotype: 'owl' })
    return json({ ...user, chronotype: 'owl' })
  }
  assert.deepEqual(await updateProfile({ birthDate: user.birth_date, chronotype: 'owl', token: 'test-token', firstName: 'Не отправлять', increaseRest: true }), { ...user, chronotype: 'owl' })
})

test('profile update rejects malformed or unconfirmed server data', async () => {
  for (const response of [{}, { ...user, id: 0 }, { ...user, email: null }, { ...user, birth_date: '2026-11-31' }, { ...user, chronotype: 'owl' }]) {
    globalThis.fetch = async () => json(response)
    await assert.rejects(updateProfile({ birthDate: user.birth_date, chronotype: 'dove', token: 'test-token' }), /не подтвердил сохранение/)
  }
})

test('planning preferences are isolated by user, contain only booleans and tolerate bad storage', () => {
  const storage = createStorage()
  savePlanningPreferences(storage, 7, { shiftRoutineToEvening: true, increaseRest: false, email: user.email })
  assert.deepEqual(readPlanningPreferences(storage, 7), { shiftRoutineToEvening: true, increaseRest: false })
  assert.deepEqual(readPlanningPreferences(storage, 8), { shiftRoutineToEvening: false, increaseRest: false })
  assert.equal([...storage.values.values()][0].includes(user.email), false)
  storage.values.set('perfect-day.planning.7', '{broken')
  assert.deepEqual(readPlanningPreferences(storage, 7), { shiftRoutineToEvening: false, increaseRest: false })
  storage.values.set('perfect-day.planning.7', JSON.stringify({ shiftRoutineToEvening: 'true', increaseRest: 1 }))
  assert.deepEqual(readPlanningPreferences(storage, 7), { shiftRoutineToEvening: false, increaseRest: false })
  assert.deepEqual(readPlanningPreferences({ getItem() { throw new Error('blocked') } }, 7), { shiftRoutineToEvening: false, increaseRest: false })
})

test('save updates the profile and persists both local options after success, blocking duplicate submission', async () => {
  const storage = createStorage()
  let resolve
  let calls = 0
  let updated
  globalThis.fetch = async () => { calls++; return new Promise(done => { resolve = done }) }
  const profile = createProfileState({ user, storage, getToken: () => 'test-token', onUnauthorized: () => {}, onProfileUpdated: value => { updated = value } })
  Object.assign(profile.state, { chronotype: 'lark', shiftRoutineToEvening: true, increaseRest: true })
  const saving = profile.save()
  assert.equal(profile.state.isSaving, true)
  assert.equal(await profile.save(), false)
  assert.equal(calls, 1)
  assert.equal(storage.values.size, 0)
  resolve(json({ ...user, chronotype: 'lark' }))
  assert.equal(await saving, true)
  assert.equal(updated.chronotype, 'lark')
  assert.deepEqual(readPlanningPreferences(storage, user.id), { shiftRoutineToEvening: true, increaseRest: true })
  assert.match(profile.state.message, /в этом браузере/)
  assert.equal(profile.state.isSaving, false)
  profile.state.increaseRest = false
  assert.equal(profile.state.message, '')
  profile.dispose()
})

test('API errors preserve edited fields and do not save local options or update the authenticated profile', async () => {
  const storage = createStorage()
  let updates = 0
  globalThis.fetch = async () => json({}, 503)
  const profile = createProfileState({ user, storage, getToken: () => 'test-token', onUnauthorized: () => {}, onProfileUpdated: () => { updates++ } })
  profile.state.chronotype = 'owl'
  profile.state.increaseRest = true
  assert.equal(await profile.save(), false)
  assert.equal(updates, 0)
  assert.equal(storage.values.size, 0)
  assert.equal(profile.state.chronotype, 'owl')
  assert.equal(profile.state.increaseRest, true)
  assert.equal(profile.state.isSaving, false)
  assert.match(profile.state.error, /Сервер временно недоступен/)
  profile.dispose()
})

test('storage failure reports partial success without claiming the local settings were saved', async () => {
  const storage = { getItem: () => null, setItem() { throw new Error('blocked') } }
  let updated = false
  globalThis.fetch = async () => json(user)
  const profile = createProfileState({ user, storage, getToken: () => 'test-token', onUnauthorized: () => {}, onProfileUpdated: () => { updated = true } })
  assert.equal(await profile.save(), false)
  assert.equal(updated, true)
  assert.equal(profile.state.message, '')
  assert.match(profile.state.error, /Хронотип сохранён.*не удалось сохранить/)
  profile.dispose()
})

test('expired sessions are handled without writing local preferences', async () => {
  const storage = createStorage()
  let unauthorized = 0
  globalThis.fetch = async () => json({}, 401)
  const profile = createProfileState({ user, storage, getToken: () => 'expired', onUnauthorized: () => { unauthorized++ }, onProfileUpdated: () => assert.fail('Unexpected profile update') })
  assert.equal(await profile.save(), false)
  assert.equal(unauthorized, 1)
  assert.equal(storage.values.size, 0)
  profile.dispose()
})

test('leaving the page or changing accounts prevents a late response from updating profile and preferences', async () => {
  for (const stop of ['dispose', 'change-account']) {
    const storage = createStorage()
    let resolve
    let token = 'first-token'
    globalThis.fetch = async () => new Promise(done => { resolve = done })
    const profile = createProfileState({ user, storage, getToken: () => token, onUnauthorized: () => assert.fail('Unexpected redirect'), onProfileUpdated: () => assert.fail('Unexpected profile update') })
    const saving = profile.save()
    if (stop === 'dispose') profile.dispose()
    else token = 'second-token'
    resolve(json(user))
    assert.equal(await saving, false)
    assert.equal(storage.values.size, 0)
    profile.dispose()
  }
})

test('an unknown chronotype is not replaced silently and blocks invalid requests', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; return json(user) }
  const profile = createProfileState({ user: { ...user, chronotype: 'custom' }, storage: createStorage(), getToken: () => 'test-token', onUnauthorized: () => {}, onProfileUpdated: () => {} })
  assert.equal(profile.state.chronotype, 'custom')
  assert.equal(await profile.save(), false)
  assert.equal(calls, 0)
  assert.equal(profile.state.error, 'Выберите хронотип.')
  profile.dispose()
})
