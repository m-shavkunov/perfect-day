const defaults = { shiftRoutineToEvening: false, increaseRest: false }

function storageKey(userId) {
  if (!Number.isInteger(userId) || userId < 1) throw new Error('Не удалось определить пользователя.')
  return `perfect-day.planning.${userId}`
}

export function getPlanningStorage() {
  try { return globalThis.localStorage || null } catch { return null }
}

export function readPlanningPreferences(storage, userId) {
  try {
    const value = JSON.parse(storage?.getItem(storageKey(userId)) || 'null')
    return {
      shiftRoutineToEvening: value?.shiftRoutineToEvening === true,
      increaseRest: value?.increaseRest === true,
    }
  } catch { return { ...defaults } }
}

export function savePlanningPreferences(storage, userId, preferences) {
  if (!storage) throw new Error('Хранилище браузера недоступно.')
  storage.setItem(storageKey(userId), JSON.stringify({
    shiftRoutineToEvening: preferences.shiftRoutineToEvening === true,
    increaseRest: preferences.increaseRest === true,
  }))
}
