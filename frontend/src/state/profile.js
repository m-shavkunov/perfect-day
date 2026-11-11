import { reactive, watch } from 'vue'
import { updateProfile } from '../api/profile.js'
import { isDateString } from '../utils/dates.js'
import { getPlanningStorage, readPlanningPreferences, savePlanningPreferences } from '../utils/planningPreferences.js'

export function createProfileState({ user, getToken, onProfileUpdated, onUnauthorized, storage = getPlanningStorage() }) {
  const state = reactive({
    chronotype: user.chronotype || '', ...readPlanningPreferences(storage, user.id),
    isSaving: false, message: '', error: '',
  })
  let disposed = false
  let controller
  const stopWatching = watch(() => [state.chronotype, state.shiftRoutineToEvening, state.increaseRest], () => {
    state.message = ''
    state.error = ''
  }, { flush: 'sync' })

  function dispose() {
    disposed = true
    controller?.abort()
    stopWatching()
  }

  async function save() {
    if (disposed || state.isSaving) return false
    state.message = ''
    state.error = ''
    if (!['lark', 'owl', 'dove'].includes(state.chronotype)) {
      state.error = 'Выберите хронотип.'
      return false
    }
    if (!isDateString(user.birth_date) || !Number.isInteger(user.id) || user.id < 1) {
      state.error = 'Не удалось загрузить данные профиля. Обновите страницу.'
      return false
    }
    const token = getToken()
    if (!token) {
      await onUnauthorized()
      return false
    }
    const snapshot = { chronotype: state.chronotype, shiftRoutineToEvening: state.shiftRoutineToEvening, increaseRest: state.increaseRest }
    controller = new AbortController()
    state.isSaving = true
    try {
      const updated = await updateProfile({ birthDate: user.birth_date, chronotype: snapshot.chronotype, token, signal: controller.signal })
      if (disposed || getToken() !== token) return false
      if (updated.id !== user.id) throw new Error('Сервер вернул данные другого профиля. Обновите страницу.')
      onProfileUpdated(updated)
      try {
        savePlanningPreferences(storage, user.id, snapshot)
      } catch {
        state.error = 'Хронотип сохранён. Приоритеты планирования не удалось сохранить в этом браузере. Разрешите локальное хранилище и повторите сохранение.'
        return false
      }
      state.message = 'Параметры сохранены. Приоритеты планирования сохранены в этом браузере.'
      return true
    } catch (error) {
      if (disposed || getToken() !== token || controller.signal.aborted) return false
      if (error.status === 401 || error.status === 403) {
        await onUnauthorized()
        return false
      }
      state.error = error.message || 'Не удалось сохранить параметры. Попробуйте ещё раз.'
      return false
    } finally {
      if (!disposed) state.isSaving = false
    }
  }

  return { state, save, dispose }
}
